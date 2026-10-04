const { ActivityType } = require('discord.js');
const db = require('../src/utils/db');
const { embed, ok, error } = require('../src/utils/embed');
const { resolveMember, resolveChannel } = require('../src/utils/resolve');

const CAT = 'Controle du bot';
const c = (o) => ({ category: CAT, permission: 'owner', ...o });

const ACTIVITY_TYPES = {
  playto: ActivityType.Playing,
  listen: ActivityType.Listening,
  watch: ActivityType.Watching,
  compet: ActivityType.Competing,
  stream: ActivityType.Streaming,
};

module.exports = [
  // ---------- theme ----------
  c({
    name: 'theme', permission: 'admin',
    async execute({ message, args }) {
      const color = args[0];
      if (!color || !/^#?[0-9a-fA-F]{6}$/.test(color)) {
        return message.reply({ embeds: [error('Usage : `theme <couleur hex>` (ex: #FF0000)')] });
      }
      const hex = color.startsWith('#') ? color : `#${color}`;
      db.updateGuild(message.guild.id, d => { d.theme = hex; });
      message.reply({ embeds: [embed(message.guild.id).setDescription(`✅ Theme des embeds change en \`${hex}\`.`)] });
    },
  }),

  // ---------- activites (playto/listen/watch/compet/stream) ----------
  ...Object.keys(ACTIVITY_TYPES).map(key => c({
    name: key,
    async execute({ message, args, client }) {
      const text = args.join(' ') || 'discord.js';
      const phrases = text.split(',,').map(s => s.trim()).filter(Boolean);
      // Sauvegarde
      db.saveGlobal({ ...db.getGlobal(), profile: { ...db.getGlobal().profile, activity: { type: key, text: phrases[0] } } });
      client.user.setActivity(phrases[0], { type: ACTIVITY_TYPES[key], url: 'https://twitch.tv/discord' });
      // Rotation si plusieurs phrases
      if (client._activityTimer) clearInterval(client._activityTimer);
      if (phrases.length > 1) {
        let idx = 0;
        client._activityTimer = setInterval(() => {
          idx = (idx + 1) % phrases.length;
          client.user.setActivity(phrases[idx], { type: ACTIVITY_TYPES[key], url: 'https://twitch.tv/discord' });
        }, 15000);
      }
      message.reply({ embeds: [ok(message.guild.id, `Activite mise a jour (${phrases.length} phrase(s)).`)] });
    },
  })),

  // ---------- remove activity ----------
  c({
    name: 'remove',
    async execute({ message, args, client }) {
      if ((args[0] || '').toLowerCase() !== 'activity') return message.reply({ embeds: [error('Usage : `remove activity`')] });
      if (client._activityTimer) clearInterval(client._activityTimer);
      client.user.setActivity(null);
      db.saveGlobal({ ...db.getGlobal(), profile: { ...db.getGlobal().profile, activity: null } });
      message.reply({ embeds: [ok(message.guild.id, 'Activite supprimee.')] });
    },
  }),

  // ---------- statuts (online/idle/dnd/invisible) ----------
  ...['online', 'idle', 'dnd', 'invisible'].map(status => c({
    name: status,
    async execute({ message, client }) {
      client.user.setStatus(status);
      db.saveGlobal({ ...db.getGlobal(), profile: { ...db.getGlobal().profile, status } });
      message.reply({ embeds: [ok(message.guild.id, `Statut change en \`${status}\`.`)] });
    },
  })),

  // ---------- say (parler a la place du bot) ----------
  c({
    name: 'say', aliases: ['send'], permission: 'admin',
    async execute({ message, args }) {
      if (!args.length) return message.reply({ embeds: [error('Usage : `say [salon] <message>`')] });
      // Si le 1er argument est un salon, on envoie dedans
      let target = message.channel;
      let content = args.join(' ');
      const maybeChannel = resolveChannel(message.guild, args[0]);
      if (maybeChannel && maybeChannel.isTextBased?.()) {
        target = maybeChannel;
        content = args.slice(1).join(' ');
      }
      if (!content) return message.reply({ embeds: [error('Message vide.')] });
      await message.delete().catch(() => {});
      const sent = await target.send({
        content,
        files: [...message.attachments.values()].map(a => a.url),
      }).catch(() => null);
      if (!sent) message.channel.send({ embeds: [error('Envoi impossible (permissions ?).')] });
    },
  }),

  // ---------- mainprefix ----------
  c({
    name: 'mainprefix',
    async execute({ message, args }) {
      if (!args[0]) return message.reply({ embeds: [error('Usage : `mainprefix <prefixe>`')] });
      db.saveGlobal({ ...db.getGlobal(), mainPrefix: args[0] });
      message.reply({ embeds: [ok(message.guild.id, `Prefixe global change en \`${args[0]}\`.`)] });
    },
  }),

  // ---------- owner / unowner / owners / clear owners ----------
  c({
    name: 'owner',
    async execute({ message, args }) {
      const g = db.getGlobal();
      if (!args.length) {
        const list = g.owners.map(id => `• <@${id}> \`${id}\``).join('\n') || 'Aucun owner supplementaire.';
        return message.reply({ embeds: [embed(message.guild.id).setTitle('👑 Owners du bot').setDescription(`Owner principal : <@${process.env.OWNER_ID}>\n${list}`)] });
      }
      const target = await resolveMember(message.guild, args.join(' ')).catch(() => null) || { id: args[0].replace(/\D/g, '') };
      if (!target.id) return message.reply({ embeds: [error('Membre introuvable.')] });
      if (!g.owners.includes(target.id)) g.owners.push(target.id);
      db.saveGlobal(g);
      message.reply({ embeds: [ok(message.guild.id, `<@${target.id}> est maintenant owner du bot.`)] });
    },
  }),
  c({
    name: 'unowner',
    async execute({ message, args }) {
      const id = (args[0] || '').replace(/\D/g, '');
      const g = db.getGlobal();
      g.owners = g.owners.filter(o => o !== id);
      db.saveGlobal(g);
      message.reply({ embeds: [ok(message.guild.id, `<@${id}> n'est plus owner.`)] });
    },
  }),
  // ---------- blacklist (bl / unbl / blinfo) ----------
  c({
    name: 'bl', aliases: ['blacklist'],
    async execute({ message, args }) {
      const g = db.getGlobal();
      if (!args.length) {
        const entries = Object.entries(g.blacklist);
        const list = entries.map(([id, d]) => `• <@${id}> \`${id}\` — ${d.reason || 'aucune raison'}`).join('\n').slice(0, 4000) || 'Blacklist vide.';
        return message.reply({ embeds: [embed(message.guild.id).setTitle(`⛔ Blacklist (${entries.length})`).setDescription(list)] });
      }
      const id = (args[0] || '').replace(/\D/g, '');
      if (!id) return message.reply({ embeds: [error('Usage : `bl <@membre/ID> [raison]`')] });
      g.blacklist[id] = { reason: args.slice(1).join(' ') || 'Aucune raison', date: Date.now(), by: message.author.id };
      db.saveGlobal(g);
      message.reply({ embeds: [ok(message.guild.id, `<@${id}> ajoute a la blacklist. Il sera banni des serveurs du bot.`)] });
    },
  }),
  c({
    name: 'unbl',
    async execute({ message, args }) {
      const id = (args[0] || '').replace(/\D/g, '');
      const g = db.getGlobal();
      delete g.blacklist[id];
      db.saveGlobal(g);
      message.reply({ embeds: [ok(message.guild.id, `<@${id}> retire de la blacklist.`)] });
    },
  }),
  c({
    name: 'blinfo',
    async execute({ message, args }) {
      const id = (args[0] || '').replace(/\D/g, '');
      const entry = db.getGlobal().blacklist[id];
      if (!entry) return message.reply({ embeds: [error('Ce membre n\'est pas blacklist.')] });
      message.reply({ embeds: [embed(message.guild.id).setTitle('⛔ Info blacklist').addFields(
        { name: 'Membre', value: `<@${id}> \`${id}\`` },
        { name: 'Raison', value: entry.reason || 'Aucune' },
        { name: 'Par', value: `<@${entry.by}>`, inline: true },
        { name: 'Date', value: `<t:${Math.floor(entry.date / 1000)}:F>`, inline: true },
      )] });
    },
  }),

  // ---------- server list ----------
  c({
    name: 'server-list', aliases: ['serverlist'],
    permission: 'owner',
    async execute({ message, client }) {
      const guilds = [...client.guilds.cache.values()];
      const list = guilds.map((g, i) => `**${i + 1}.** ${g.name} — \`${g.id}\` (${g.memberCount} membres)`).join('\n').slice(0, 4000);
      message.reply({ embeds: [embed(message.guild.id).setTitle(`🌐 Serveurs (${guilds.length})`).setDescription(list)] });
    },
  }),

  // ---------- leave ----------
  c({
    name: 'leave',
    async execute({ message, args, client }) {
      const id = (args[0] || '').replace(/\D/g, '') || message.guild.id;
      const g = client.guilds.cache.get(id);
      if (!g) return message.reply({ embeds: [error('Serveur introuvable.')] });
      await message.reply({ embeds: [ok(message.guild.id, `Le bot quitte **${g.name}**.`)] });
      g.leave().catch(() => {});
    },
  }),

  // ---------- mp (DM a un membre) ----------
  c({
    name: 'mp', permission: 'owner',
    async execute({ message, args }) {
      const target = await resolveMember(message.guild, args[0] || '');
      const text = args.slice(1).join(' ');
      if (!target || !text) return message.reply({ embeds: [error('Usage : `mp <membre> <message>`')] });
      const done = await target.send(text).then(() => true).catch(() => false);
      message.reply({ embeds: done ? [ok(message.guild.id, `MP envoye a ${target}.`)] : [error('Impossible d\'envoyer le MP (DM fermes).')] });
    },
  }),
];
