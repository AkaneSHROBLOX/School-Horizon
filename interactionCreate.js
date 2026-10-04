// Routeur central : passe l'interaction au premier gestionnaire qui la reconnait.
module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    for (const handler of client.interactionHandlers || []) {
      try {
        if (handler.test(interaction)) {
          await handler.execute(client, interaction);
          return;
        }
      } catch (err) {
        console.error('Erreur interaction:', err);
        const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
        if (interaction.deferred || interaction.replied) interaction.followUp(msg).catch(() => {});
        else interaction.reply(msg).catch(() => {});
        return;
      }
    }
  },
};
