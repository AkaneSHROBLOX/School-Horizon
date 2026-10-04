const { PermissionFlagsBits } = require('discord.js');
const db = require('../src/utils/db');
const { embed, ok, error } = require('../src/utils/embed');
const { resolveChannel } = require('../src/utils/resolve');
const { parseDuration, formatDuration } = require('../src/utils/time');

const CAT = 'Configuration';
const cfg = (o) => ({ category: CAT, permission: 'admin', ...o });

module.exports = [
  // ---------- prefix ----------
  cfg({
    name: 'prefix',
    async execute({ message, args }) {
      if (!args[0]) {
        const p = db.getGuild(message.guild.id).prefix || db.getGlobal().mainPrefix;
        return message.reply({ embeds: [embed(message.guild.id).setDescription(`Prefixe actuel : \`${p}\``)] });
      }
      db.updateGuild(message.guild.id, d => { d.prefix = args[0]; });
      message.reply({ embeds: [ok(message.guild.id, `Prefixe du serveur change en \`${args[0]}\`.`)] });
    },
  }),

  // ---------- slowmode ----------
  cfg({
    name: 'slowmode', aliases: ['slow'], permission: 'mod',
    async execute({ message, args }) {
      const duration = parseDuration(args[0]);
      if (duration === null) return message.reply({ embeds: [error('Usage : `slowmode <duree>` (ex: 5s, 10m, max 6h)')] });
      const seconds = Math.min(Math.floor(duration / 1000), 21600);
      const ch = args[1] ? resolveChannel(message.guild, args.slice(1).join(' ')) : message.channel;
      await ch.setRateLimitPerUser(seconds).catch(() => {});
      message.reply({ embeds: [ok(message.guild.id, `Mode lent de ${ch} regle sur ${formatDuration(seconds * 1000)}.`)] });
    },
  }),

  // ---------- perms ----------
  cfg({
    name: 'perms',
    async execute({ message }) {
      const perms = db.getGuild(message.guild.id).perms || {};
      const entries = Object.entries(perms);
      if (!entries.length) return message.reply({ embeds: [embed(message.guild.id).setDescription('Aucune permission custom configuree. Utilise `set perm`.')] });
      const list = entries.map(([id, lvl]) => `• <@&${id}> / <@${id}> → \`${lvl}\``).join('\n');
      message.reply({ embeds: [embed(message.guild.id).setTitle('🔐 Permissions du bot').setDescription(list)] });
    },
  }),

  // ---------- timeout (toggle) ----------
  cfg({
    name: 'timeout',
    async execute({ message, args }) {
      const on = (args[0] || '').toLowerCase() === 'on';
      db.updateGuild(message.guild.id, d => { d.moderation = d.moderation || {}; d.moderation.timeout = on; });
      message.reply({ embeds: [ok(message.guild.id, `Timeout Discord ${on ? 'active' : 'desactive'} pour les mutes.`)] });
    },
  }),

  // ---------- muterole (creation) ----------
  cfg({
    name: 'muterole',
    async execute({ message }) {
      const guild = message.guild;
      let role = guild.roles.cache.find(r => ['muted', 'muet'].includes(r.name.toLowerCase()));
      if (!role) role = await guild.roles.create({ name: 'Muted', color: 0x546E7A, reason: 'Role muet du bot' });
      let errors = 0;
      for (const ch of guild.channels.cache.values()) {
        const done = await ch.permissionOverwrites.edit(role, {
          SendMessages: false, AddReactions: false, Speak: false, SendMessagesInThreads: false,
        }).then(() => true).catch(() => false);
        if (!done) errors++;
      }
      db.updateGuild(guild.id, d => { d.moderation = d.moderation || {}; d.moderation.muteRoleId = role.id; });
      message.reply({ embeds: [ok(guild.id, `Role muet ${role} pret.${errors ? ` (${errors} salon(s) non configurable(s))` : ''}`)] });
    },
  }),

  // ---------- antispam (config) ----------
  cfg({
    name: 'antispam',
    async execute({ message, args }) {
      const a = (args[0] || '').toLowerCase();
      if (a === 'on' || a === 'off') {
        db.updateGuild(message.guild.id, d => { d.moderation = d.moderation || {}; d.moderation.antispam = a === 'on'; });
        return message.reply({ embeds: [ok(message.guild.id, `Antispam ${a === 'on' ? 'active' : 'desactive'}.`)] });
      }
      const ratio = a.match(/^(\d+)\/(\d+)$/);
      if (ratio) {
        db.updateGuild(message.guild.id, d => { d.moderation = d.moderation || {}; d.moderation.antispamRate = { count: +ratio[1], seconds: +ratio[2] }; });
        return message.reply({ embeds: [ok(message.guild.id, `Sensibilite antispam : ${ratio[1]} messages / ${ratio[2]}s.`)] });
      }
      message.reply({ embeds: [error('Usage : `antispam <on/off>` ou `antispam <nombre>/<duree>`')] });
    },
  }),

  // ---------- antilink (config) ----------
  cfg({
    name: 'antilink',
    async execute({ message, args }) {
      const a = (args[0] || '').toLowerCase();
      if (a === 'on' || a === 'off') {
        db.updateGuild(message.guild.id, d => { d.moderation = d.moderation || {}; d.moderation.antilink = a === 'on'; });
        return message.reply({ embeds: [ok(message.guild.id, `Antilink ${a === 'on' ? 'active' : 'desactive'}.`)] });
      }
      if (a === 'invite' || a === 'all') {
        db.updateGuild(message.guild.id, d => { d.moderation = d.moderation || {}; d.moderation.antilinkMode = a; });
        return message.reply({ embeds: [ok(message.guild.id, `Antilink regle sur \`${a}\`.`)] });
      }
      message.reply({ embeds: [error('Usage : `antilink <on/off>` ou `antilink <invite/all>`')] });
    },
  }),

  // ---------- badwords ----------
  cfg({
    name: 'badwords',
    async execute({ message, args }) {
      const a = (args[0] || '').toLowerCase();
      const conf = db.getGuild(message.guild.id);
      if (a === 'on' || a === 'off') {
        db.updateGuild(message.guild.id, d => { d.moderation = d.moderation || {}; d.moderation.badwordsOn = a === 'on'; });
        return message.reply({ embeds: [ok(message.guild.id, `Filtre de mots ${a === 'on' ? 'active' : 'desactive'}.`)] });
      }
      if (a === 'add') {
        const word = args.slice(1).join(' ').toLowerCase();
        if (!word) return message.reply({ embeds: [error('Usage : `badwords add <mot>`')] });
        db.updateGuild(message.guild.id, d => { d.badwords = d.badwords || []; if (!d.badwords.includes(word)) d.badwords.push(word); });
        return message.reply({ embeds: [ok(message.guild.id, `\`${word}\` ajoute aux mots interdits.`)] });
      }
      if (a === 'del') {
        const word = args.slice(1).join(' ').toLowerCase();
        db.updateGuild(message.guild.id, d => { d.badwords = (d.badwords || []).filter(w => w !== word); });
        return message.reply({ embeds: [ok(message.guild.id, `\`${word}\` retire.`)] });
      }
      if (a === 'list') {
        const list = (conf.badwords || []).map(w => `\`${w}\``).join(', ') || 'Aucun.';
        return message.reply({ embeds: [embed(message.guild.id).setTitle('🚫 Mots interdits').setDescription(list)] });
      }
      message.reply({ embeds: [error('Usage : `badwords <on/off/add/del/list>`')] });
    },
  }),

  // ---------- settings ----------
  cfg({
    name: 'settings', aliases: ['config'], permission: 'mod',
    async execute({ message }) {
      const c = db.getGuild(message.guild.id);
      const mod = c.moderation || {};
      const logs = c.logs || {};
      const e = embed(message.guild.id)
        .setTitle(`⚙️ Parametres — ${message.guild.name}`)
        .addFields(
          { name: 'Prefixe', value: `\`${c.prefix || db.getGlobal().mainPrefix}\``, inline: true },
          { name: 'Theme', value: c.theme || db.getGlobal().theme, inline: true },
          { name: 'Mute via timeout', value: mod.timeout ? 'Oui' : 'Non', inline: true },
          { name: 'Antispam', value: mod.antispam ? 'On' : 'Off', inline: true },
          { name: 'Antilink', value: mod.antilink ? `On (${mod.antilinkMode || 'all'})` : 'Off', inline: true },
          { name: 'Filtre mots', value: mod.badwordsOn ? `On (${(c.badwords || []).length})` : 'Off', inline: true },
          { name: 'Modlog', value: logs.modlog ? `<#${logs.modlog}>` : 'Off', inline: true },
          { name: 'Messagelog', value: logs.messagelog ? `<#${logs.messagelog}>` : 'Off', inline: true },
          { name: 'Voicelog', value: logs.voicelog ? `<#${logs.voicelog}>` : 'Off', inline: true },
        );
      message.reply({ embeds: [e] });
    },
  }),
];
