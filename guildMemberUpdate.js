const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

// Logs de boost et de roles
module.exports = {
  name: 'guildMemberUpdate',
  execute(client, oldM, newM) {
    // Boost
    if (!oldM.premiumSince && newM.premiumSince) {
      const e = new EmbedBuilder().setColor('#F47FFF').setDescription(`🚀 ${newM} vient de booster le serveur ! Merci ❤️`).setTimestamp();
      sendLog(newM.guild, 'boostlog', e);
    }
    // Roles
    const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
    const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id));
    if (added.size || removed.size) {
      const parts = [];
      if (added.size) parts.push(`➕ ${added.map(r => r.toString()).join(' ')}`);
      if (removed.size) parts.push(`➖ ${removed.map(r => r.toString()).join(' ')}`);
      const e = new EmbedBuilder().setColor('#5865F2')
        .setAuthor({ name: newM.user.tag, iconURL: newM.user.displayAvatarURL() })
        .setDescription(`🎭 Roles de ${newM} modifies\n${parts.join('\n')}`).setTimestamp();
      sendLog(newM.guild, 'rolelog', e);
    }
  },
};
