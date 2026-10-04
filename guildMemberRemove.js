const { sendWelcome } = require('../../commands/welcome');

// Message d'au revoir quand un membre quitte
module.exports = {
  name: 'guildMemberRemove',
  async execute(client, member) {
    sendWelcome(member, 'goodbye').catch(() => {});
  },
};
