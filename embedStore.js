const { EmbedBuilder } = require('discord.js');
const { themeColor } = require('./embed');

// Brouillons d'embed en cours d'edition : messageId du builder -> draft
const drafts = new Map();

// Construit l'aperçu a partir d'un brouillon
function buildEmbed(draft, guildId) {
  const e = new EmbedBuilder().setColor(draft.color || themeColor(guildId));
  if (draft.title) e.setTitle(draft.title);
  if (draft.description) e.setDescription(draft.description);
  if (draft.author) e.setAuthor({ name: draft.author });
  if (draft.footer) e.setFooter({ text: draft.footer });
  if (draft.image) e.setImage(draft.image);
  if (draft.thumbnail) e.setThumbnail(draft.thumbnail);
  for (const f of draft.fields || []) e.addFields({ name: f.name, value: f.value, inline: !!f.inline });
  // Un embed ne peut pas etre totalement vide
  const empty = !draft.title && !draft.description && !draft.author && !draft.image && !draft.thumbnail && !(draft.fields || []).length;
  if (empty) e.setDescription('*Aperçu — utilise les boutons ci-dessous pour personnaliser ton embed.*');
  return e;
}

module.exports = { drafts, buildEmbed };
