const { ActionRowBuilder, StringSelectMenuBuilder, OAuth2Scopes, PermissionsBitField } = require('discord.js');
const { embed } = require('../src/utils/embed');
const db = require('../src/utils/db');

const CAT = 'General';

// Notes de mise a jour (modifie librement)
const CHANGELOGS = [
  { version: '2.1.0', date: '2026-07-08', notes: [
    '🎫 Systeme de tickets (panneau, claim, close, rename, add/del)',
    '👋 Messages de bienvenue et d\'au revoir personnalisables',
    '🛠️ Generateur d\'embed interactif ultra-customisable',
    '📋 Formulaires avec reponses envoyees dans un salon',
  ] },
  { version: '2.0.0', date: '2026-07-08', notes: [
    'Base du bot de gestion : Utilitaire, Moderation, Controle, Logs, Config',
    'Systeme de permissions (public/mod/admin/owner)',
    'Auto-moderation : antilink, antispam, filtre de mots',
    'Logs de messages, vocaux, boosts et roles',
  ] },
];

module.exports = [
  // ---------- help ----------
  {
    name: 'help', aliases: ['aide', 'h'], category: CAT, permission: 'public',
    async execute({ message, client, prefix }) {
      const categories = [...client.categories.keys()];
      const e = embed(message.guild.id)
        .setTitle('📖 Menu d\'aide')
        .setDescription(`Prefixe : \`${prefix}\`\nSelectionne une categorie dans le menu ci-dessous.\n\n${categories.map(c => `• **${c}** (${client.categories.get(c).length})`).join('\n')}`)
        .setFooter({ text: `${client.commands.size} commandes au total` });
      const menu = new StringSelectMenuBuilder()
        .setCustomId('help_select')
        .setPlaceholder('Choisis une categorie...')
        .addOptions(categories.map(c => ({ label: c, value: c, description: `${client.categories.get(c).length} commandes` })));
      message.reply({ embeds: [e], components: [new ActionRowBuilder().addComponents(menu)] });
    },
  },

  // ---------- changelogs ----------
  {
    name: 'changelogs', aliases: ['changelog', 'maj'], category: CAT, permission: 'public',
    async execute({ message }) {
      const e = embed(message.guild.id).setTitle('📝 Notes de mise a jour');
      for (const log of CHANGELOGS) {
        e.addFields({ name: `Version ${log.version} — ${log.date}`, value: log.notes.map(n => `• ${n}`).join('\n') });
      }
      message.reply({ embeds: [e] });
    },
  },

  // ---------- crowbots (support) ----------
  {
    name: 'crowbots', aliases: ['support'], category: CAT, permission: 'public',
    async execute({ message }) {
      message.reply({ embeds: [embed(message.guild.id).setTitle('💬 Support')
        .setDescription('Ce bot est un projet perso inspire de Crow Bots.\nAjoute ici le lien de ton serveur de support quand tu en auras un.')] });
    },
  },

  // ---------- invite (lien d'ajout du bot) ----------
  {
    name: 'invite', aliases: ['add'], category: CAT, permission: 'public',
    async execute({ message, client }) {
      const url = client.generateInvite({
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
        permissions: [PermissionsBitField.Flags.Administrator],
      });
      message.reply({ embeds: [embed(message.guild.id).setTitle('➕ Ajouter le bot').setDescription(`[Clique ici pour m'inviter](${url})`)] });
    },
  },

  // ---------- botinfo ----------
  {
    name: 'botinfo', aliases: ['bi', 'stats'], category: CAT, permission: 'public',
    async execute({ message, client }) {
      const uptime = Math.floor(process.uptime());
      const e = embed(message.guild.id).setTitle(`🤖 ${client.user.username}`)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: 'Serveurs', value: `${client.guilds.cache.size}`, inline: true },
          { name: 'Utilisateurs', value: `${client.users.cache.size}`, inline: true },
          { name: 'Commandes', value: `${client.commands.size}`, inline: true },
          { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
          { name: 'Uptime', value: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`, inline: true },
          { name: 'discord.js', value: require('discord.js').version, inline: true },
        );
      message.reply({ embeds: [e] });
    },
  },
];
