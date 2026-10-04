const db = require('../utils/db');
const { sendWelcome } = require('../../commands/welcome');

// Blacklist globale + message de bienvenue
module.exports = {
  name: 'guildMemberAdd',
  async execute(client, member) {
    const bl = db.getGlobal().blacklist;
    if (bl[member.id]) {
      await member.ban({ reason: `Blacklist globale du bot : ${bl[member.id].reason || 'aucune raison'}` })
        .catch(() => {});
      return;
    }
    sendWelcome(member, 'welcome').catch(() => {});
  },
};
