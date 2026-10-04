const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageUpdate',
  execute(client, oldMsg, newMsg) {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    const e = new EmbedBuilder()
      .setColor('#FEE75C')
      .setAuthor({ name: newMsg.author.tag, iconURL: newMsg.author.displayAvatarURL() })
      .setDescription(`✏️ Message edite dans ${newMsg.channel} — [aller au message](${newMsg.url})`)
      .addFields(
        { name: 'Avant', value: (oldMsg.content || '*vide*').slice(0, 1024) },
        { name: 'Apres', value: (newMsg.content || '*vide*').slice(0, 1024) },
      )
      .setTimestamp();
    sendLog(newMsg.guild, 'messagelog', e, newMsg.channel.id);
  },
};
