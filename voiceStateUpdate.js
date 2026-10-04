const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { handleBureauVoiceUpdate } = require('../utils/bureaux');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(client, oldState, newState) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    // Salons vocaux temporaires "Bureau" (creation/suppression automatique)
    await handleBureauVoiceUpdate(oldState, newState).catch(() => {});

    let text = null;
    if (!oldState.channel && newState.channel) text = `🔊 ${member} a rejoint ${newState.channel}`;
    else if (oldState.channel && !newState.channel) text = `🔇 ${member} a quitte ${oldState.channel}`;
    else if (oldState.channelId !== newState.channelId) text = `➡️ ${member} : ${oldState.channel} → ${newState.channel}`;
    if (!text) return;
    const e = new EmbedBuilder().setColor('#5865F2').setDescription(text).setTimestamp();
    sendLog(newState.guild, 'voicelog', e);
  },
};
