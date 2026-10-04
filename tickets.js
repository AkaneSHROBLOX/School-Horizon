const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const db = require('../src/utils/db');
const { embed, ok, error } = require('../src/utils/embed');
const { resolveChannel, resolveRole, resolveMember } = require('../src/utils/resolve');
const { toEmoji } = require('../src/utils/emoji');

const CAT = 'Tickets';

// Un salon est un ticket si son sujet commence par "TICKET|<userId>"
function ticketOpenerId(channel) {
  const m = (channel.topic || '').match(/^TICKET\|(\d+)/);
  return m ? m[1] : null;
}

// Transforme un nom en identifiant simple
function slugify(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '').slice(0, 30);
}

// Construit les rangees de boutons du panneau (un bouton par type)
function panelRows(types) {
  const entries = Object.entries(types);
  const rows = [];
  for (let i = 0; i < entries.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const [slug, type] of entries.slice(i, i + 5)) {
      const btn = new ButtonBuilder().setCustomId(`ticket_create|${slug}`).setLabel(type.label || slug).setStyle(ButtonStyle.Primary);
      try { btn.setEmoji(toEmoji(type.emoji || '🎫')); } catch { /* ignore */ }
      row.addComponents(btn);
    }
    rows.push(row);
  }
  return rows;
}

module.exports = [
  // ---------- ticket (configuration multi-types) ----------
  {
    name: 'ticket', category: CAT, permission: 'admin',
    async execute({ message, args }) {
      const sub = (args[0] || '').toLowerCase();
      const conf = db.getGuild(message.guild.id);
      const t = conf.tickets || {};
      const types = t.types || {};

      // --- Ajouter un type ---
      if (sub === 'add' || sub === 'create') {
        const name = args.slice(1).join(' ');
        const slug = slugify(name);
        if (!slug) return message.reply({ embeds: [error('Usage : `ticket add <nom>` (ex: `ticket add Support`)')] });
        if (types[slug]) return message.reply({ embeds: [error('Un type de ticket porte déjà ce nom.')] });
        if (Object.keys(types).length >= 25) return message.reply({ embeds: [error('Maximum 25 types de tickets.')] });
        db.updateGuild(message.guild.id, d => {
          d.tickets = d.tickets || {}; d.tickets.types = d.tickets.types || {};
          d.tickets.types[slug] = { name, label: name, emoji: '🎫', categoryId: null, supportRoleId: null, openMessage: null, channelName: `${slug}-{count}` };
        });
        return message.reply({ embeds: [ok(message.guild.id, `Type de ticket **${name}** créé.\nConfigure-le avec \`ticket set ${slug} ...\` puis poste \`ticket panel\`.`)] });
      }

      // --- Supprimer un type ---
      if (sub === 'remove' || sub === 'delete' || sub === 'del') {
        const slug = slugify(args.slice(1).join(' '));
        if (!types[slug]) return message.reply({ embeds: [error('Type introuvable. Vois la liste avec `ticket list`.')] });
        db.updateGuild(message.guild.id, d => { delete d.tickets.types[slug]; });
        return message.reply({ embeds: [ok(message.guild.id, `Type **${slug}** supprimé.`)] });
      }

      // --- Lister les types ---
      if (sub === 'list') {
        const entries = Object.entries(types);
        if (!entries.length) return message.reply({ embeds: [embed(message.guild.id).setDescription('Aucun type de ticket. Crée-en un avec `ticket add <nom>`.')] });
        const list = entries.map(([slug, ty]) =>
          `${ty.emoji || '🎫'} **${ty.label}** \`(${slug})\`\n   • Rôle: ${ty.supportRoleId ? `<@&${ty.supportRoleId}>` : 'admins'} · Catégorie: ${ty.categoryId ? `<#${ty.categoryId}>` : 'auto'} · Salon: \`${ty.channelName}\``
        ).join('\n');
        return message.reply({ embeds: [embed(message.guild.id).setTitle('🎫 Types de tickets').setDescription(list)] });
      }

      // --- Configurer une propriété d'un type ---
      if (sub === 'set') {
        const slug = slugify(args[1] || '');
        const prop = (args[2] || '').toLowerCase();
        const value = args.slice(3).join(' ');
        if (!types[slug]) return message.reply({ embeds: [error('Type introuvable. `ticket list` pour voir, `ticket add <nom>` pour créer.')] });

        const setProp = (mut) => db.updateGuild(message.guild.id, d => mut(d.tickets.types[slug]));

        if (prop === 'label' || prop === 'button' || prop === 'texte') {
          if (!value || value.length > 80) return message.reply({ embeds: [error('Texte du bouton (max 80 caractères).')] });
          setProp(ty => { ty.label = value; });
          return message.reply({ embeds: [ok(message.guild.id, `Texte du bouton de **${slug}** = **${value}**. Reposte \`ticket panel\`.`)] });
        }
        if (prop === 'emoji') {
          try { new ButtonBuilder().setCustomId('t').setStyle(ButtonStyle.Primary).setEmoji(toEmoji(value)); }
          catch { return message.reply({ embeds: [error('Émoji invalide.')] }); }
          setProp(ty => { ty.emoji = value; });
          return message.reply({ embeds: [ok(message.guild.id, `Émoji de **${slug}** = ${value}. Reposte \`ticket panel\`.`)] });
        }
        if (prop === 'role') {
          const role = resolveRole(message.guild, value);
          if (!role) return message.reply({ embeds: [error('Rôle introuvable.')] });
          setProp(ty => { ty.supportRoleId = role.id; });
          return message.reply({ embeds: [ok(message.guild.id, `Rôle support de **${slug}** = ${role}.`)] });
        }
        if (prop === 'category' || prop === 'categorie') {
          const c = resolveChannel(message.guild, value);
          if (!c || c.type !== ChannelType.GuildCategory) return message.reply({ embeds: [error('Catégorie invalide.')] });
          setProp(ty => { ty.categoryId = c.id; });
          return message.reply({ embeds: [ok(message.guild.id, `Catégorie de **${slug}** = **${c.name}**.`)] });
        }
        if (prop === 'message' || prop === 'msg') {
          if (!value) return message.reply({ embeds: [error('Message vide. Variables : {user} {username} {ticket} {server}')] });
          setProp(ty => { ty.openMessage = value; });
          return message.reply({ embeds: [ok(message.guild.id, `Message d'ouverture de **${slug}** enregistré.`)] });
        }
        if (prop === 'name' || prop === 'nom') {
          if (!value) return message.reply({ embeds: [error('Format vide. Variables : {count} {username} {id}')] });
          setProp(ty => { ty.channelName = value; });
          return message.reply({ embeds: [ok(message.guild.id, `Nom des salons de **${slug}** = \`${value}\`.`)] });
        }
        return message.reply({ embeds: [error('Propriété inconnue. Choix : `label` `emoji` `role` `category` `message` `name`')] });
      }

      // --- Poster un panneau (tous les types, ou une sélection) ---
      // Usage : ticket panel [salon] [type type ...]  -> permet plusieurs panneaux différents
      if (sub === 'panel') {
        if (!Object.keys(types).length) return message.reply({ embeds: [error('Crée d\'abord au moins un type avec `ticket add <nom>`.')] });
        let target = message.channel;
        const slugs = [];
        for (const a of args.slice(1)) {
          const ch = resolveChannel(message.guild, a);
          if (ch && ch.isTextBased?.()) { target = ch; continue; }
          slugs.push(slugify(a));
        }
        const selected = slugs.length
          ? Object.fromEntries(Object.entries(types).filter(([s]) => slugs.includes(s)))
          : types;
        if (!Object.keys(selected).length) return message.reply({ embeds: [error('Aucun type ne correspond. Vois `ticket list`.')] });
        const e = embed(message.guild.id)
          .setTitle(t.panelTitle || '🎫 Support — Ouvrir un ticket')
          .setDescription(t.panelDesc || 'Choisis le type de ticket que tu veux ouvrir en cliquant sur un bouton ci-dessous.');
        await target.send({ embeds: [e], components: panelRows(selected) });
        return message.reply({ embeds: [ok(message.guild.id, `Panneau (${Object.keys(selected).length} bouton(s)) envoyé dans ${target}.`)] });
      }

      // --- Personnaliser le titre/description du panneau ---
      if (sub === 'paneltitle') {
        db.updateGuild(message.guild.id, d => { d.tickets = d.tickets || {}; d.tickets.panelTitle = args.slice(1).join(' '); });
        return message.reply({ embeds: [ok(message.guild.id, 'Titre du panneau enregistré. Reposte `ticket panel`.')] });
      }
      if (sub === 'paneldesc') {
        db.updateGuild(message.guild.id, d => { d.tickets = d.tickets || {}; d.tickets.panelDesc = args.slice(1).join(' '); });
        return message.reply({ embeds: [ok(message.guild.id, 'Description du panneau enregistrée. Reposte `ticket panel`.')] });
      }

      // --- Aperçu / aide ---
      const e = embed(message.guild.id).setTitle('🎫 Système de tickets')
        .setDescription([
          `**Types configurés :** ${Object.keys(types).length}`,
          Object.entries(types).map(([s, ty]) => `${ty.emoji || '🎫'} ${ty.label} \`(${s})\``).join('  ·  ') || '_aucun_',
          '',
          '**Gérer les types :**',
          '`ticket add <nom>` — créer un type de ticket',
          '`ticket remove <nom>` — supprimer un type',
          '`ticket list` — voir les types',
          '',
          '**Configurer un type :**',
          '`ticket set <nom> label <texte>` — texte du bouton',
          '`ticket set <nom> emoji <émoji>` — émoji du bouton',
          '`ticket set <nom> role <rôle>` — équipe support',
          '`ticket set <nom> category <catégorie>` — catégorie du salon',
          '`ticket set <nom> message <texte>` — message à l\'ouverture ({user} {ticket})',
          '`ticket set <nom> name <format>` — nom du salon ({count} {username})',
          '',
          '**Panneau(x) :**',
          '`ticket panel [salon]` — poster tous les boutons',
          '`ticket panel [salon] <type> <type>` — panneau avec seulement ces types (permet plusieurs panneaux différents)',
          '`ticket paneltitle <texte>` · `ticket paneldesc <texte>`',
          '',
          'Dans un ticket : `claim`, `close [raison]`, `rename <nom>`, `add <membre>`, `del <membre>`',
        ].join('\n'));
      message.reply({ embeds: [e] });
    },
  },

  // ---------- claim ----------
  {
    name: 'claim', category: CAT, permission: 'mod',
    async execute({ message }) {
      if (!ticketOpenerId(message.channel)) return message.reply({ embeds: [error('Cette commande s\'utilise dans un ticket.')] });
      await message.channel.setName(`✅-${message.channel.name.replace(/^[^-]*-/, '')}`).catch(() => {});
      message.reply({ embeds: [ok(message.guild.id, `Ticket pris en charge par ${message.author}.`)] });
    },
  },

  // ---------- rename ----------
  {
    name: 'rename', category: CAT, permission: 'mod',
    async execute({ message, args }) {
      if (!ticketOpenerId(message.channel)) return message.reply({ embeds: [error('Cette commande s\'utilise dans un ticket.')] });
      const name = args.join('-').toLowerCase();
      if (!name) return message.reply({ embeds: [error('Usage : `rename <nom>`')] });
      await message.channel.setName(name).catch(() => {});
      message.reply({ embeds: [ok(message.guild.id, `Ticket renommé en \`${name}\`.`)] });
    },
  },

  // ---------- add (ajouter un membre au ticket) ----------
  {
    name: 'add', category: CAT, permission: 'mod',
    async execute({ message, args }) {
      if (!ticketOpenerId(message.channel)) return message.reply({ embeds: [error('Cette commande s\'utilise dans un ticket.')] });
      const member = await resolveMember(message.guild, args.join(' '));
      if (!member) return message.reply({ embeds: [error('Usage : `add <membre>`')] });
      await message.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true }).catch(() => {});
      message.reply({ embeds: [ok(message.guild.id, `${member} ajouté au ticket.`)] });
    },
  },

  // ---------- close ----------
  {
    name: 'close', category: CAT, permission: 'mod',
    async execute({ message, args }) {
      if (!ticketOpenerId(message.channel)) return message.reply({ embeds: [error('Cette commande s\'utilise dans un ticket.')] });
      const reason = args.join(' ') || 'Aucune raison';
      await message.channel.send({ embeds: [embed(message.guild.id).setDescription(`🔒 Ticket fermé par ${message.author} — ${reason}\nSuppression dans 5 secondes...`)] });
      setTimeout(() => message.channel.delete().catch(() => {}), 5000);
    },
  },
];

module.exports.ticketOpenerId = ticketOpenerId;
