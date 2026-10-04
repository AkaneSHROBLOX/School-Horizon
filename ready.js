const { ActivityType } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`✅ Connecte en tant que ${client.user.tag}`);
    console.log(`🌐 ${client.guilds.cache.size} serveur(s)`);

    // Restaure l'activite sauvegardee si presente
    const profile = db.getGlobal().profile || {};
    if (profile.activity) {
      const map = { playing: 0, listening: 2, watching: 3, competing: 5, streaming: 1 };
      client.user.setActivity(profile.activity.text, {
        type: map[profile.activity.type] ?? ActivityType.Playing,
      });
    }
    if (profile.status) client.user.setStatus(profile.status);
  },
};
