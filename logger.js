const db = require('./db');

// Envoie un embed dans le salon de log configure pour un type donne.
function sendLog(guild, key, embedObj, channelIdOfEvent) {
  if (!guild) return;
  const logs = db.getGuild(guild.id).logs || {};
  const chId = logs[key];
  if (!chId) return;
  if (channelIdOfEvent && logs.excluded?.includes(channelIdOfEvent)) return; // salon exclu
  const ch = guild.channels.cache.get(chId);
  if (ch) ch.send({ embeds: [embedObj] }).catch(() => {});
}

module.exports = { sendLog };
