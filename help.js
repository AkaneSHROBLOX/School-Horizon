const { EmbedBuilder } = require('discord.js');
const { themeColor } = require('../utils/embed');

module.exports = {
  test: (i) => i.isStringSelectMenu() && i.customId === 'help_select',
  async execute(client, interaction) {
    const cat = interaction.values[0];
    const names = client.categories.get(cat) || [];
    const lines = names.map(n => {
      const cmd = client.commands.get(n);
      return `• \`${n}\`${cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : ''}`;
    }).join('\n');
    const e = new EmbedBuilder()
      .setColor(themeColor(interaction.guild?.id))
      .setTitle(`📖 ${cat}`)
      .setDescription(lines || 'Aucune commande.');
    await interaction.update({ embeds: [e] }).catch(() => {});
  },
};
