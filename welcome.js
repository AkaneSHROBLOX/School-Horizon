const db = require('../src/utils/db');
const { embed, ok, error } = require('../src/utils/embed');
const { resolveChannel } = require('../src/utils/resolve');
const { applyPlaceholders } = require('../src/utils/placeholders');

const CAT = 'Bienvenue';

// Fabrique les commandes welcome/goodbye (meme logique, cle differente)
function makeSystem(name, key, defaultMsg, label) {
  return {
    name, aliases: name === 'welcome' ? ['join'] : ['bye'],
    category: CAT, permission: 'admin',
    async execute({ message, args }) {
      const sub = (args[0] || '').toLowerCase();
      const conf = db.getGuild(message.guild.id);
      const cur = conf[key] || {};

      if (sub === 'channel' || sub === 'salon') {
        const ch = args[1] ? resolveChannel(message.guild, args.slice(1).join(' ')) : message.channel;
        if (!ch) return message.reply({ embeds: [error('Salon introuvable.')] });
        db.updateGuild(message.guild.id, d => { d[key] = { ...(d[key] || {}), channelId: ch.id, enabled: true }; });
        return message.reply({ embeds: [ok(message.guild.id, `${label} activé dans ${ch}.`)] });
      }
      if (sub === 'message' || sub === 'msg') {
        const txt = args.slice(1).join(' ');
        if (!txt) return message.reply({ embeds: [error(`Usage : \`${name} message <texte>\`\nVariables : {user} {username} {server} {count}`)] });
        db.updateGuild(message.guild.id, d => { d[key] = { ...(d[key] || {}), message: txt }; });
        return message.reply({ embeds: [ok(message.guild.id, 'Message enregistré.')] });
      }
      if (sub === 'embed') {
        const on = (args[1] || '').toLowerCase() === 'on';
        db.updateGuild(message.guild.id, d => { d[key] = { ...(d[key] || {}), embed: on }; });
        return message.reply({ embeds: [ok(message.guild.id, `Format embed ${on ? 'activé' : 'désactivé'}.`)] });
      }
      if (sub === 'off') {
        db.updateGuild(message.guild.id, d => { d[key] = { ...(d[key] || {}), enabled: false }; });
        return message.reply({ embeds: [ok(message.guild.id, `${label} désactivé.`)] });
      }
      if (sub === 'test') {
        return sendWelcome(message.member, key, message.channel);
      }

      // Aide / etat
      const e = embed(message.guild.id).setTitle(`⚙️ ${label}`)
        .setDescription([
          `**État :** ${cur.enabled ? '🟢 Activé' : '🔴 Désactivé'}`,
          `**Salon :** ${cur.channelId ? `<#${cur.channelId}>` : 'aucun'}`,
          `**Format :** ${cur.embed ? 'Embed' : 'Texte'}`,
          `**Message :** ${cur.message || defaultMsg}`,
          '',
          '**Commandes :**',
          `\`${name} channel [salon]\` — définir le salon`,
          `\`${name} message <texte>\` — définir le message`,
          `\`${name} embed <on/off>\` — format embed ou texte`,
          `\`${name} test\` — tester`,
          `\`${name} off\` — désactiver`,
          '',
          '**Variables :** `{user}` `{username}` `{server}` `{count}`',
        ].join('\n'));
      message.reply({ embeds: [e] });
    },
  };
}

// Envoie le message de bienvenue/adieu (utilise aussi par les events)
async function sendWelcome(member, key, forceChannel = null) {
  const conf = db.getGuild(member.guild.id);
  const c = conf[key];
  if (!c || (!c.enabled && !forceChannel)) return;
  const channel = forceChannel || member.guild.channels.cache.get(c.channelId);
  if (!channel) return;
  const defaultMsg = key === 'welcome'
    ? '👋 Bienvenue {user} sur **{server}** ! Tu es le membre n°{count}.'
    : '👋 {username} a quitté **{server}**. À bientôt !';
  const text = applyPlaceholders(c.message || defaultMsg, member);
  if (c.embed) {
    const e = embed(member.guild.id)
      .setDescription(text)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();
    channel.send({ embeds: [e] }).catch(() => {});
  } else {
    channel.send({ content: text }).catch(() => {});
  }
}

module.exports = [
  makeSystem('welcome', 'welcome', 'message par défaut', 'Message de bienvenue'),
  makeSystem('goodbye', 'goodbye', 'message par défaut', "Message d'au revoir"),
];
module.exports.sendWelcome = sendWelcome;
