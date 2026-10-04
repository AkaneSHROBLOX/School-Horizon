const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { drafts, buildEmbed } = require('../src/utils/embedStore');

// Rangees de boutons du builder (exporte pour reutilisation dans les interactions)
function builderRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('embed_title').setLabel('Titre').setEmoji('📝').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_description').setLabel('Description').setEmoji('📄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_color').setLabel('Couleur').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_author').setLabel('Auteur').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('embed_image').setLabel('Image').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_thumbnail').setLabel('Miniature').setEmoji('🔳').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_footer').setLabel('Footer').setEmoji('🦶').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('embed_field').setLabel('Ajouter un champ').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('embed_send').setLabel('Envoyer').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('embed_reset').setLabel('Réinitialiser').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    ),
  ];
}

module.exports = {
  name: 'embed', category: 'Gestion du serveur', permission: 'admin',
  async execute({ message }) {
    const draft = { fields: [], authorId: message.author.id, channelId: message.channel.id };
    const sent = await message.channel.send({
      content: '**🛠️ Générateur d\'embed** — personnalise puis clique sur **Envoyer**.',
      embeds: [buildEmbed(draft, message.guild.id)],
      components: builderRows(),
    });
    drafts.set(sent.id, draft);
    message.delete().catch(() => {});
  },
};

module.exports.builderRows = builderRows;
