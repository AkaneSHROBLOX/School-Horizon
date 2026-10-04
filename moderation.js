const { PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../src/utils/db');
const { embed, ok, error, warn } = require('../src/utils/embed');
const { resolveMember, resolveMembers, resolveRole, resolveChannel } = require('../src/utils/resolve');
const { parseDuration, formatDuration } = require('../src/utils/time');

const CAT = 'Moderation';
const m = (o) => ({ category: CAT, permission: 'mod', ...o });

// Recupere cibles (mentions/IDs multiples, ou noms separes par ,,) + raison
async function getTargets(message, args) {
  const guild = message.guild;
  const targets = [];
  let i = 0;
  while (i < args.length && /^(<@!?\d+>|\d{16,20})$/.test(args[i])) {
    const mem = await resolveMember(guild, args[i]);
    if (mem) targets.push(mem);
    i++;
  }
  if (targets.length) return { targets, reason: args.slice(i).join(' ') || 'Aucune raison' };
  const rest = args.join(' ');
  if (rest.includes(',,')) return { targets: await resolveMembers(guild, rest), reason: 'Aucune raison' };
  const single = args[0] ? await resolveMember(guild, args[0]) : null;
  return { targets: single ? [single] : [], reason: args.slice(1).join(' ') || 'Aucune raison' };
}

function addSanction(guildId, userId, sanction) {
  db.updateGuild(guildId, d => {
    d.sanctions = d.sanctions || {};
    d.sanctions[userId] = d.sanctions[userId] || [];
    d.sanctions[userId].push({ ...sanction, date: Date.now() });
  });
}

async function getMuteRole(guild) {
  const conf = db.getGuild(guild.id);
  let role = conf.moderation?.muteRoleId ? guild.roles.cache.get(conf.moderation.muteRoleId) : null;
  if (!role) role = guild.roles.cache.find(r => ['muted', 'muet'].includes(r.name.toLowerCase()));
  if (!role) {
    role = await guild.roles.create({ name: 'Muted', color: 0x546E7A, reason: 'Role mute du bot' });
    for (const ch of guild.channels.cache.values()) {
      await ch.permissionOverwrites.edit(role, {
        SendMessages: false, AddReactions: false, Speak: false, SendMessagesInThreads: false,
      }).catch(() => {});
    }
  }
  db.updateGuild(guild.id, d => { d.moderation = d.moderation || {}; d.moderation.muteRoleId = role.id; });
  return role;
}

module.exports = [
  // ---------- warn ----------
  m({
    name: 'warn',
    async execute({ message, args }) {
      const { targets, reason } = await getTargets(message, args);
      if (!targets.length) return message.reply({ embeds: [error('Usage : `warn <membre> [raison]`')] });
      for (const t of targets) {
        addSanction(message.guild.id, t.id, { type: 'warn', reason, by: message.author.id });
        t.send({ embeds: [warn(`Tu as recu un avertissement sur **${message.guild.name}** : ${reason}`)] }).catch(() => {});
      }
      message.reply({ embeds: [ok(message.guild.id, `⚠️ ${targets.map(t => t.toString()).join(', ')} averti(s) — ${reason}`)] });
    },
  }),

  // ---------- mute ----------
  m({
    name: 'mute',
    async execute({ message, args }) {
      const { targets, reason } = await getTargets(message, args);
      if (!targets.length) return message.reply({ embeds: [error('Usage : `mute <membre> [raison]`')] });
      const conf = db.getGuild(message.guild.id);
      const useTimeout = conf.moderation?.timeout;
      const role = useTimeout ? null : await getMuteRole(message.guild);
      for (const t of targets) {
        if (useTimeout) await t.timeout(28 * 24 * 60 * 60 * 1000, reason).catch(() => {});
        else await t.roles.add(role, reason).catch(() => {});
        addSanction(message.guild.id, t.id, { type: 'mute', reason, by: message.author.id });
      }
      message.reply({ embeds: [ok(message.guild.id, `🔇 ${targets.map(t => t.toString()).join(', ')} rendu(s) muet(s) — ${reason}`)] });
    },
  }),

  // ---------- tempmute ----------
  m({
    name: 'tempmute',
    async execute({ message, args }) {
      const duration = parseDuration(args[1]);
      const target = await resolveMember(message.guild, args[0] || '');
      if (!target || !duration) return message.reply({ embeds: [error('Usage : `tempmute <membre> <duree> [raison]` (ex: 10m, 2h, 1d)')] });
      const reason = args.slice(2).join(' ') || 'Aucune raison';
      const conf = db.getGuild(message.guild.id);
      if (conf.moderation?.timeout && duration <= 28 * 24 * 60 * 60 * 1000) {
        await target.timeout(duration, reason).catch(() => {});
      } else {
        const role = await getMuteRole(message.guild);
        await target.roles.add(role, reason).catch(() => {});
        setTimeout(() => target.roles.remove(role).catch(() => {}), duration);
      }
      addSanction(message.guild.id, target.id, { type: 'tempmute', reason, by: message.author.id, duration });
      message.reply({ embeds: [ok(message.guild.id, `🔇 ${target} rendu muet pour ${formatDuration(duration)} — ${reason}`)] });
    },
  }),

  // ---------- unmute ----------
  m({
    name: 'unmute',
    async execute({ message, args }) {
      const { targets } = await getTargets(message, args);
      if (!targets.length) return message.reply({ embeds: [error('Usage : `unmute <membre>`')] });
      const role = await getMuteRole(message.guild);
      for (const t of targets) {
        await t.roles.remove(role).catch(() => {});
        if (t.isCommunicationDisabled()) await t.timeout(null).catch(() => {});
      }
      message.reply({ embeds: [ok(message.guild.id, `🔊 ${targets.map(t => t.toString()).join(', ')} demute(s).`)] });
    },
  }),

  // ---------- mutelist ----------
  m({
    name: 'mutelist',
    async execute({ message }) {
      const role = await getMuteRole(message.guild);
      await message.guild.members.fetch().catch(() => {});
      const muted = message.guild.members.cache.filter(mem => mem.roles.cache.has(role.id) || mem.isCommunicationDisabled());
      const list = muted.map(mem => `• ${mem}`).join('\n').slice(0, 4000) || 'Aucun mute en cours.';
      message.reply({ embeds: [embed(message.guild.id).setTitle(`🔇 Mutes (${muted.size})`).setDescription(list)] });
    },
  }),

  // ---------- kick ----------
  m({
    name: 'kick',
    async execute({ message, args }) {
      const { targets, reason } = await getTargets(message, args);
      if (!targets.length) return message.reply({ embeds: [error('Usage : `kick <membre> [raison]`')] });
      let done = 0;
      for (const t of targets) {
        if (!t.kickable) continue;
        t.send({ embeds: [error(`Tu as ete expulse de **${message.guild.name}** : ${reason}`)] }).catch(() => {});
        if (await t.kick(reason).then(() => true).catch(() => false)) {
          addSanction(message.guild.id, t.id, { type: 'kick', reason, by: message.author.id });
          done++;
        }
      }
      message.reply({ embeds: [ok(message.guild.id, `👢 ${done} membre(s) expulse(s) — ${reason}`)] });
    },
  }),

  // ---------- ban ----------
  m({
    name: 'ban', permission: 'mod',
    async execute({ message, args }) {
      const { targets, reason } = await getTargets(message, args);
      if (!targets.length) return message.reply({ embeds: [error('Usage : `ban <membre> [raison]`')] });
      let done = 0;
      for (const t of targets) {
        t.send?.({ embeds: [error(`Tu as ete banni de **${message.guild.name}** : ${reason}`)] }).catch(() => {});
        if (await message.guild.members.ban(t.id, { reason }).then(() => true).catch(() => false)) {
          addSanction(message.guild.id, t.id, { type: 'ban', reason, by: message.author.id });
          done++;
        }
      }
      message.reply({ embeds: [ok(message.guild.id, `🔨 ${done} membre(s) banni(s) — ${reason}`)] });
    },
  }),

  // ---------- tempban ----------
  m({
    name: 'tempban',
    async execute({ message, args }) {
      const resolved = await resolveMember(message.guild, args[0] || '');
      const id = resolved?.id || (args[0] || '').replace(/\D/g, '');
      const duration = parseDuration(args[1]);
      if (!id || !duration) return message.reply({ embeds: [error('Usage : `tempban <membre> <duree> [raison]`')] });
      const reason = args.slice(2).join(' ') || 'Aucune raison';
      await message.guild.members.ban(id, { reason }).catch(() => {});
      addSanction(message.guild.id, id, { type: 'tempban', reason, by: message.author.id, duration });
      setTimeout(() => message.guild.members.unban(id).catch(() => {}), duration);
      message.reply({ embeds: [ok(message.guild.id, `🔨 <@${id}> banni pour ${formatDuration(duration)} — ${reason}`)] });
    },
  }),

  // ---------- unban ----------
  m({
    name: 'unban',
    async execute({ message, args }) {
      const id = (args[0] || '').replace(/\D/g, '');
      if (!id) return message.reply({ embeds: [error('Usage : `unban <ID>`')] });
      const done = await message.guild.members.unban(id).then(() => true).catch(() => false);
      message.reply({ embeds: done ? [ok(message.guild.id, `<@${id}> debanni.`)] : [error('Impossible de debannir (ID invalide ou non banni).')] });
    },
  }),

  // ---------- banlist ----------
  m({
    name: 'banlist',
    async execute({ message }) {
      const bans = await message.guild.bans.fetch().catch(() => null);
      if (!bans) return message.reply({ embeds: [error('Impossible de recuperer les bannissements.')] });
      const list = bans.map(b => `• ${b.user.tag} \`${b.user.id}\``).join('\n').slice(0, 4000) || 'Aucun bannissement.';
      message.reply({ embeds: [embed(message.guild.id).setTitle(`🔨 Bannissements (${bans.size})`).setDescription(list)] });
    },
  }),

  // ---------- lock / unlock ----------
  m({
    name: 'lock',
    async execute({ message, args }) {
      const ch = args[0] ? resolveChannel(message.guild, args.join(' ')) : message.channel;
      await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false, Connect: false }).catch(() => {});
      message.reply({ embeds: [ok(message.guild.id, `🔒 ${ch} verrouille.`)] });
    },
  }),
  m({
    name: 'unlock',
    async execute({ message, args }) {
      const ch = args[0] ? resolveChannel(message.guild, args.join(' ')) : message.channel;
      await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null, Connect: null }).catch(() => {});
      message.reply({ embeds: [ok(message.guild.id, `🔓 ${ch} deverrouille.`)] });
    },
  }),

  // ---------- hide / unhide ----------
  m({
    name: 'hide',
    async execute({ message, args }) {
      const ch = args[0] ? resolveChannel(message.guild, args.join(' ')) : message.channel;
      await ch.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false }).catch(() => {});
      message.reply({ embeds: [ok(message.guild.id, `🙈 ${ch} cache.`)] });
    },
  }),
  m({
    name: 'unhide',
    async execute({ message, args }) {
      const ch = args[0] ? resolveChannel(message.guild, args.join(' ')) : message.channel;
      await ch.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: null }).catch(() => {});
      message.reply({ embeds: [ok(message.guild.id, `👁️ ${ch} de nouveau visible.`)] });
    },
  }),

  // ---------- addrole / delrole ----------
  m({
    name: 'addrole',
    async execute({ message, args }) {
      const role = resolveRole(message.guild, args[args.length - 1]);
      const targets = await resolveMembers(message.guild, args.slice(0, -1).join(' '));
      if (!role || !targets.length) return message.reply({ embeds: [error('Usage : `addrole <membre> <role>`')] });
      for (const t of targets) await t.roles.add(role).catch(() => {});
      message.reply({ embeds: [ok(message.guild.id, `Role ${role} ajoute a ${targets.length} membre(s).`)] });
    },
  }),
  m({
    name: 'delrole',
    async execute({ message, args }) {
      const role = resolveRole(message.guild, args[args.length - 1]);
      const targets = await resolveMembers(message.guild, args.slice(0, -1).join(' '));
      if (!role || !targets.length) return message.reply({ embeds: [error('Usage : `delrole <membre> <role>`')] });
      for (const t of targets) await t.roles.remove(role).catch(() => {});
      message.reply({ embeds: [ok(message.guild.id, `Role ${role} retire de ${targets.length} membre(s).`)] });
    },
  }),

  // ---------- derank ----------
  m({
    name: 'derank',
    async execute({ message, args }) {
      const { targets } = await getTargets(message, args);
      if (!targets.length) return message.reply({ embeds: [error('Usage : `derank <membre>`')] });
      for (const t of targets) {
        const roles = t.roles.cache.filter(r => r.id !== message.guild.id && r.editable);
        await t.roles.remove(roles).catch(() => {});
      }
      message.reply({ embeds: [ok(message.guild.id, `${targets.map(t => t.toString()).join(', ')} derank(s).`)] });
    },
  }),

  // ---------- sanctions ----------
  m({
    name: 'sanctions', aliases: ['casier'],
    async execute({ message, args }) {
      const target = args[0] ? await resolveMember(message.guild, args.join(' ')) : message.member;
      if (!target) return message.reply({ embeds: [error('Membre introuvable.')] });
      const list = (db.getGuild(message.guild.id).sanctions?.[target.id]) || [];
      if (!list.length) return message.reply({ embeds: [embed(message.guild.id).setDescription(`✅ ${target} n'a aucune sanction.`)] });
      const desc = list.map((s, i) => `**${i + 1}.** \`${s.type}\` — ${s.reason} • par <@${s.by}> • <t:${Math.floor(s.date / 1000)}:R>`).join('\n').slice(0, 4000);
      message.reply({ embeds: [embed(message.guild.id).setTitle(`Sanctions de ${target.user.tag} (${list.length})`).setDescription(desc)] });
    },
  }),

];
