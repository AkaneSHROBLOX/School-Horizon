const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

// Memorise le dernier message supprime (pour +snipe) et l'envoie dans les logs
module.exports = {
  name: 'messageDelete',
  execute(client, message) {
    if (!message.guild || message.author?.bot) return;
    if (!client.snipes) client.snipes = new Map();
    client.snipes.set(message.channel.id, {
      content: message.content || '',
      author: message.author,
      image: message.attachments.first()?.proxyURL || null,
      date: Date.now(),
    });

    const e = new EmbedBuilder()
      .setColor('#ED4245')
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription(`🗑️ Message supprime dans ${message.channel}\n${message.content || '*aucun texte*'}`)
      .setTimestamp();
    sendLog(message.guild, 'messagelog', e, message.channel.id);
  },
};
