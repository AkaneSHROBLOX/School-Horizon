const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { drafts, buildEmbed } = require('../utils/embedStore');
const { builderRows } = require('../../commands/embed');

// Champs simples -> un seul input dans le modal
const SIMPLE = {
  embed_title: { label: 'Titre', style: TextInputStyle.Short, max: 256, key: 'title' },
  embed_description: { label: 'Description', style: TextInputStyle.Paragraph, max: 4000, key: 'description' },
  embed_color: { label: 'Couleur (hex, ex: #FF0000)', style: TextInputStyle.Short, max: 7, key: 'color' },
  embed_author: { label: 'Auteur', style: TextInputStyle.Short, max: 256, key: 'author' },
  embed_image: { label: "Lien de l'image", style: TextInputStyle.Short, max: 500, key: 'image' },
  embed_thumbnail: { label: 'Lien de la miniature', style: TextInputStyle.Short, max: 500, key: 'thumbnail' },
  embed_footer: { label: 'Footer', style: TextInputStyle.Short, max: 2048, key: 'footer' },
};

module.exports = {
  test: (i) =>
    (i.isButton() && i.customId.startsWith('embed_')) ||
    (i.isModalSubmit() && i.customId.startsWith('embedmodal|')),

  async execute(client, interaction) {
    // ---- Soumission d'un modal ----
    if (interaction.isModalSubmit()) {
      const [, field, msgId] = interaction.customId.split('|');
      const draft = drafts.get(msgId);
      if (!draft) return interaction.reply({ content: '❌ Ce générateur a expiré, relance `+embed`.', ephemeral: true });

      if (field === 'field') {
        const name = interaction.fields.getTextInputValue('name');
        const value = interaction.fields.getTextInputValue('value');
        const inline = interaction.fields.getTextInputValue('inline').toLowerCase().startsWith('o');
        draft.fields = draft.fields || [];
        draft.fields.push({ name, value, inline });
      } else if (field === 'color') {
        let c = interaction.fields.getTextInputValue('value').trim();
        if (c && !c.startsWith('#')) c = '#' + c;
        draft.color = /^#[0-9a-fA-F]{6}$/.test(c) ? c : draft.color;
      } else {
        const val = interaction.fields.getTextInputValue('value').trim();
        draft[field] = val || null;
      }

      const msg = await interaction.channel.messages.fetch(msgId).catch(() => null);
      if (msg) await msg.edit({ embeds: [buildEmbed(draft, interaction.guild.id)], components: builderRows() }).catch(() => {});
      return interaction.reply({ content: '✅ Mis à jour.', ephemeral: true });
    }

    // ---- Boutons ----
    const draft = drafts.get(interaction.message.id);
    if (!draft) return interaction.reply({ content: '❌ Ce générateur a expiré, relance `+embed`.', ephemeral: true });
    // Seul le créateur peut manipuler
    if (interaction.user.id !== draft.authorId) return interaction.reply({ content: '❌ Seul le créateur de cet embed peut le modifier.', ephemeral: true });

    // Envoyer
    if (interaction.customId === 'embed_send') {
      try {
        await interaction.channel.send({ embeds: [buildEmbed(draft, interaction.guild.id)] });
        drafts.delete(interaction.message.id);
        await interaction.message.delete().catch(() => {});
        return interaction.reply({ content: '✅ Embed envoyé !', ephemeral: true });
      } catch (e) {
        return interaction.reply({ content: `❌ Envoi impossible : ${e.message}`, ephemeral: true });
      }
    }

    // Reset
    if (interaction.customId === 'embed_reset') {
      drafts.set(interaction.message.id, { fields: [], authorId: draft.authorId, channelId: draft.channelId });
      await interaction.message.edit({ embeds: [buildEmbed(drafts.get(interaction.message.id), interaction.guild.id)], components: builderRows() }).catch(() => {});
      return interaction.reply({ content: '🗑️ Réinitialisé.', ephemeral: true });
    }

    // Ajouter un champ -> modal a 3 inputs
    if (interaction.customId === 'embed_field') {
      const modal = new ModalBuilder().setCustomId(`embedmodal|field|${interaction.message.id}`).setTitle('Ajouter un champ');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Nom du champ').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel('Contenu du champ').setStyle(TextInputStyle.Paragraph).setMaxLength(1024).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inline').setLabel('En ligne ? (oui/non)').setStyle(TextInputStyle.Short).setMaxLength(3).setRequired(false).setPlaceholder('non')),
      );
      return interaction.showModal(modal);
    }

    // Champs simples -> modal a 1 input
    const spec = SIMPLE[interaction.customId];
    if (spec) {
      const input = new TextInputBuilder().setCustomId('value').setLabel(spec.label).setStyle(spec.style).setMaxLength(spec.max).setRequired(false);
      const current = draft[spec.key];
      if (current) input.setValue(String(current).slice(0, spec.max));
      const modal = new ModalBuilder().setCustomId(`embedmodal|${spec.key}|${interaction.message.id}`).setTitle(spec.label.slice(0, 45))
        .addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }
  },
};
