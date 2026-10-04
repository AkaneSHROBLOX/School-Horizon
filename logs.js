const { ChannelType } = require('discord.js');
const db = require('../src/utils/db');
const { embed, ok, error } = require('../src/utils/embed');
const { resolveChannel } = require('../src/utils/resolve');

const CAT = 'Logs';

// Fabrique une commande de log "<type>log on/off [salon]"
function logCommand(name, key, label) {
  return {
    name, category: CAT, permission: 'admin',
    async execute({ message, args }) {
      const state = (args[0] || '').toLowerCase();
      if (state === 'off') {
        db.updateGuild(message.guild.id, d => { d.logs = d.logs || {}; delete d.logs[key]; });
        return message.reply({ embeds: [ok(message.guild.id, `${label} desactive(s).`)] });
      }
      if (state === 'on' || !state) {
        const ch = args[1] ? resolveChannel(message.guild, args.slice(1).join(' ')) : message.channel;
        if (!ch) return message.reply({ embeds: [error('Salon introuvable.')] });
        db.updateGuild(message.guild.id, d => { d.logs = d.logs || {}; d.logs[key] = ch.id; });
        return message.reply({ embeds: [ok(message.guild.id, `${label} active(s) dans ${ch}.`)] });
      }
      message.reply({ embeds: [error(`Usage : \`${name} on [salon]\` ou \`${name} off\``)] });
    },
  };
}

module.exports = [
  logCommand('modlog', 'modlog', 'Logs de moderation'),
  logCommand('messagelog', 'messagelog', 'Logs de messages'),
  logCommand('voicelog', 'voicelog', 'Logs vocaux'),
  logCommand('boostlog', 'boostlog', 'Logs de boost'),
  logCommand('rolelog', 'rolelog', 'Logs de roles'),
  logCommand('raidlog', 'raidlog', 'Logs antiraid'),

  // ---------- autoconfiglog ----------
  {
    name: 'autoconfiglog', category: CAT, permission: 'admin',
    async execute({ message }) {
      const guild = message.guild;
      const cat = await guild.channels.create({ name: '📋・logs', type: ChannelType.GuildCategory }).catch(() => null);
      const types = { modlog: 'mod-logs', messagelog: 'message-logs', voicelog: 'voice-logs', boostlog: 'boost-logs', rolelog: 'role-logs', raidlog: 'raid-logs' };
      const created = {};
      for (const [key, chName] of Object.entries(types)) {
        const ch = await guild.channels.create({ name: chName, type: ChannelType.GuildText, parent: cat?.id }).catch(() => null);
        if (ch) created[key] = ch.id;
      }
      db.updateGuild(guild.id, d => { d.logs = { ...(d.logs || {}), ...created }; });
      message.reply({ embeds: [ok(guild.id, `${Object.keys(created).length} salons de logs crees.`)] });
    },
  },

  // ---------- nolog (exclure des salons) ----------
  {
    name: 'nolog', category: CAT, permission: 'admin',
    async execute({ message, args }) {
      const action = (args[0] || '').toLowerCase();
      const ch = args[1] ? resolveChannel(message.guild, args.slice(1).join(' ')) : message.channel;
      if (!['add', 'del'].includes(action) || !ch) return message.reply({ embeds: [error('Usage : `nolog <add/del> [salon]`')] });
      db.updateGuild(message.guild.id, d => {
        d.logs = d.logs || {}; d.logs.excluded = d.logs.excluded || [];
        if (action === 'add' && !d.logs.excluded.includes(ch.id)) d.logs.excluded.push(ch.id);
        if (action === 'del') d.logs.excluded = d.logs.excluded.filter(x => x !== ch.id);
      });
      message.reply({ embeds: [ok(message.guild.id, `${ch} ${action === 'add' ? 'exclu des' : 'reintegre aux'} logs.`)] });
    },
  },
];
