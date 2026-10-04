const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../src/utils/db');
const { embed, ok, error } = require('../src/utils/embed');
const { resolveChannel } = require('../src/utils/resolve');

const STYLES = {
  bleu: ButtonStyle.Primary, vert: ButtonStyle.Success, rouge: ButtonStyle.Danger, gris: ButtonStyle.Secondary,
};
const styleFrom = (w) => STYLES[(w || '').toLowerCase().trim()] ?? ButtonStyle.Primary;

// Construit les rangées de boutons (un bouton par formulaire, 5 par ligne)
function panelRows(entries) {
  const rows = [];
  for (let i = 0; i < entries.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const [id, f] of entries.slice(i, i + 5)) {
      row.addComponents(new ButtonBuilder().setCustomId(`form_answer|${id}`).setLabel(f.label || 'Répondre').setEmoji('✍️').setStyle(styleFrom(f.color)));
    }
    rows.push(row);
  }
  return rows;
}

module.exports = {
  name: 'formulaire', aliases: ['form'], category: 'Configuration du serveur', permission: 'admin',
  async execute({ message, args }) {
    const sub = (args[0] || '').toLowerCase();
    const conf = db.getGuild(message.guild.id);
    const forms = conf.forms || {};

    // ---- Lister ----
    if (sub === 'list') {
      const entries = Object.entries(forms);
      if (!entries.length) return message.reply({ embeds: [embed(message.guild.id).setDescription('Aucun formulaire. Crée-en un avec `formulaire add`.')] });
      const list = entries.map(([id, f]) => `• **${f.label || 'Répondre'}** — « ${f.title} » \`id:${id}\` (${f.questions.length} question(s)) → <#${f.logChannelId}>`).join('\n');
      return message.reply({ embeds: [embed(message.guild.id).setTitle('📋 Formulaires').setDescription(list)] });
    }

    // ---- Supprimer ----
    if (sub === 'remove' || sub === 'delete') {
      const id = args[1];
      if (!id || !forms[id]) return message.reply({ embeds: [error('Usage : `formulaire remove <id>` (voir `formulaire list`)')] });
      db.updateGuild(message.guild.id, d => { delete d.forms[id]; });
      return message.reply({ embeds: [ok(message.guild.id, `Formulaire \`${id}\` supprimé.`)] });
    }

    // ---- Titre / description du panneau ----
    if (sub === 'paneltitle') {
      db.updateGuild(message.guild.id, d => { d.formPanel = { ...(d.formPanel || {}), title: args.slice(1).join(' ') }; });
      return message.reply({ embeds: [ok(message.guild.id, 'Titre du panneau enregistré. Reposte `formulaire panel`.')] });
    }
    if (sub === 'paneldesc') {
      db.updateGuild(message.guild.id, d => { d.formPanel = { ...(d.formPanel || {}), desc: args.slice(1).join(' ') }; });
      return message.reply({ embeds: [ok(message.guild.id, 'Description du panneau enregistrée. Reposte `formulaire panel`.')] });
    }

    // ---- Poster le panneau (plusieurs boutons côte à côte) ----
    if (sub === 'panel') {
      const all = Object.entries(forms);
      if (!all.length) return message.reply({ embeds: [error('Crée d\'abord au moins un formulaire avec `formulaire add`.')] });
      // Args restants : un éventuel salon + des ids de formulaires à inclure
      let target = message.channel;
      const ids = [];
      for (const a of args.slice(1)) {
        const ch = resolveChannel(message.guild, a);
        if (ch && ch.isTextBased?.()) { target = ch; continue; }
        ids.push(a);
      }
      const entries = ids.length ? all.filter(([id]) => ids.includes(id)) : all;
      if (!entries.length) return message.reply({ embeds: [error('Aucun formulaire ne correspond à ces ids. Vois `formulaire list`.')] });

      const pconf = conf.formPanel || {};
      const e = embed(message.guild.id)
        .setTitle(pconf.title || '📋 Formulaires')
        .setDescription(pconf.desc || 'Choisis ce à quoi tu veux répondre en cliquant sur un bouton ci-dessous.');
      await target.send({ embeds: [e], components: panelRows(entries) });
      return message.reply({ embeds: [ok(message.guild.id, `Panneau (${entries.length} bouton(s)) envoyé dans ${target}.`)] });
    }

    // ---- Défaut / add : bouton pour ouvrir le modal de création ----
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('form_setup').setLabel('Créer un formulaire').setEmoji('➕').setStyle(ButtonStyle.Primary),
    );
    await message.channel.send({
      embeds: [embed(message.guild.id).setTitle('📋 Formulaires')
        .setDescription([
          'Crée plusieurs formulaires, puis regroupe leurs boutons dans **un seul panneau**.',
          '',
          '1️⃣ Clique sur **Créer un formulaire** ci-dessous (autant de fois que tu veux)',
          '2️⃣ `formulaire panel` → poste tous les boutons côte à côte',
          '',
          '**Autres commandes :** `formulaire list` · `formulaire remove <id>` · `formulaire panel <id> <id>` · `formulaire paneltitle <texte>` · `formulaire paneldesc <texte>`',
        ].join('\n'))],
      components: [row],
    });
    message.delete().catch(() => {});
  },
};
