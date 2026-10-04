const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { evaluate } = require('../src/utils/calc');
const { embed, error } = require('../src/utils/embed');
const { resolveMember, resolveRole, resolveChannel } = require('../src/utils/resolve');

const CAT = 'Utilitaire';
const u = (o) => ({ category: CAT, permission: 'public', ...o });

module.exports = [
  // ---------- serverinfo ----------
  u({
    name: 'serverinfo', aliases: ['si', 'server-info'],
    async execute({ message }) {
      const g = message.guild;
      await g.members.fetch().catch(() => {});
      const bots = g.members.cache.filter(m => m.user.bot).size;
      const humans = g.memberCount - bots;
      const e = embed(g.id)
        .setTitle(g.name)
        .setThumbnail(g.iconURL({ size: 1024 }))
        .addFields(
          { name: '🆔 ID', value: g.id, inline: true },
          { name: '👑 Proprietaire', value: `<@${g.ownerId}>`, inline: true },
          { name: '📅 Cree le', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '👥 Membres', value: `${g.memberCount} (${humans} humains, ${bots} bots)`, inline: true },
          { name: '💬 Salons', value: `${g.channels.cache.size}`, inline: true },
          { name: '🎭 Roles', value: `${g.roles.cache.size}`, inline: true },
          { name: '😀 Emojis', value: `${g.emojis.cache.size}`, inline: true },
          { name: '🚀 Boosts', value: `${g.premiumSubscriptionCount || 0} (niveau ${g.premiumTier})`, inline: true },
        );
      if (g.bannerURL()) e.setImage(g.bannerURL({ size: 1024 }));
      message.reply({ embeds: [e] });
    },
  }),

  // ---------- vocinfo ----------
  u({
    name: 'vocinfo',
    async execute({ message }) {
      const g = message.guild;
      const voice = g.channels.cache.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice);
      let inVoice = 0, muted = 0, streaming = 0;
      voice.forEach(c => c.members.forEach(m => {
        inVoice++;
        if (m.voice.selfMute || m.voice.serverMute) muted++;
        if (m.voice.streaming) streaming++;
      }));
      const e = embed(g.id)
        .setTitle('🔊 Activite vocale')
        .addFields(
          { name: 'Salons vocaux', value: `${voice.size}`, inline: true },
          { name: 'En vocal', value: `${inVoice}`, inline: true },
          { name: 'Mute', value: `${muted}`, inline: true },
          { name: 'En stream', value: `${streaming}`, inline: true },
        );
      message.reply({ embeds: [e] });
    },
  }),

  // ---------- user ----------
  u({
    name: 'user', aliases: ['userinfo', 'ui'],
    async execute({ message, args }) {
      const member = args[0] ? await resolveMember(message.guild, args.join(' ')) : message.member;
      const user = member ? member.user : message.author;
      await user.fetch(true).catch(() => {});
      const e = embed(message.guild.id)
        .setTitle(user.tag)
        .setThumbnail(user.displayAvatarURL({ size: 1024 }))
        .addFields(
          { name: '🆔 ID', value: user.id, inline: true },
          { name: '🤖 Bot', value: user.bot ? 'Oui' : 'Non', inline: true },
          { name: '📅 Compte cree', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        );
      if (user.hexAccentColor) e.setColor(user.hexAccentColor);
      message.reply({ embeds: [e] });
    },
  }),

  // ---------- member ----------
  u({
    name: 'member', aliases: ['mi'],
    async execute({ message, args }) {
      const member = args[0] ? await resolveMember(message.guild, args.join(' ')) : message.member;
      if (!member) return message.reply({ embeds: [error('Membre introuvable.')] });
      const roles = member.roles.cache.filter(r => r.id !== message.guild.id)
        .sort((a, b) => b.position - a.position).map(r => r.toString()).slice(0, 20).join(' ') || 'Aucun';
      const e = embed(message.guild.id)
        .setTitle(member.user.tag)
        .setThumbnail(member.displayAvatarURL({ size: 1024 }))
        .addFields(
          { name: '🆔 ID', value: member.id, inline: true },
          { name: '📅 A rejoint', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
          { name: '🚀 Booste', value: member.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : 'Non', inline: true },
          { name: `🎭 Roles (${member.roles.cache.size - 1})`, value: roles },
        );
      if (member.displayHexColor && member.displayHexColor !== '#000000') e.setColor(member.displayHexColor);
      message.reply({ embeds: [e] });
    },
  }),

  // ---------- role ----------
  u({
    name: 'role', aliases: ['roleinfo'],
    async execute({ message, args }) {
      const role = resolveRole(message.guild, args.join(' '));
      if (!role) return message.reply({ embeds: [error('Role introuvable. Usage : `role <role>`')] });
      const perms = role.permissions.has(PermissionFlagsBits.Administrator)
        ? 'Administrateur'
        : role.permissions.toArray().slice(0, 10).join(', ') || 'Aucune';
      const e = embed(message.guild.id)
        .setTitle(`Role : ${role.name}`)
        .setColor(role.hexColor === '#000000' ? undefined : role.hexColor)
        .addFields(
          { name: '🆔 ID', value: role.id, inline: true },
          { name: '👥 Membres', value: `${role.members.size}`, inline: true },
          { name: '🎨 Couleur', value: role.hexColor, inline: true },
          { name: '📌 Position', value: `${role.position}`, inline: true },
          { name: '🔗 Mentionnable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
          { name: '📅 Cree', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '🔐 Permissions', value: perms },
        );
      message.reply({ embeds: [e] });
    },
  }),

  // ---------- channel ----------
  u({
    name: 'channel', aliases: ['channelinfo', 'salon'],
    async execute({ message, args }) {
      const ch = args[0] ? resolveChannel(message.guild, args.join(' ')) : message.channel;
      if (!ch) return message.reply({ embeds: [error('Salon introuvable.')] });
      const types = { 0: 'Textuel', 2: 'Vocal', 4: 'Categorie', 5: 'Annonces', 13: 'Stage', 15: 'Forum' };
      const e = embed(message.guild.id)
        .setTitle(`Salon : ${ch.name}`)
        .addFields(
          { name: '🆔 ID', value: ch.id, inline: true },
          { name: '📁 Type', value: types[ch.type] || `${ch.type}`, inline: true },
          { name: '📅 Cree', value: `<t:${Math.floor(ch.createdTimestamp / 1000)}:R>`, inline: true },
        );
      if (ch.topic) e.addFields({ name: '📝 Sujet', value: ch.topic.slice(0, 1024) });
      message.reply({ embeds: [e] });
    },
  }),

  // ---------- pic (avatar) ----------
  u({
    name: 'pic', aliases: ['avatar', 'av'],
    async execute({ message, args }) {
      const member = args[0] ? await resolveMember(message.guild, args.join(' ')) : message.member;
      const user = member ? member.user : message.author;
      const e = embed(message.guild.id)
        .setTitle(`Avatar de ${user.username}`)
        .setImage(user.displayAvatarURL({ size: 4096 }));
      message.reply({ embeds: [e] });
    },
  }),

  // ---------- banner ----------
  u({
    name: 'banner', aliases: ['banniere'],
    async execute({ message, args }) {
      const member = args[0] ? await resolveMember(message.guild, args.join(' ')) : message.member;
      const user = member ? member.user : message.author;
      const full = await user.fetch(true).catch(() => null);
      if (!full || !full.banner) return message.reply({ embeds: [error('Cet utilisateur n\'a pas de banniere.')] });
      const e = embed(message.guild.id)
        .setTitle(`Banniere de ${user.username}`)
        .setImage(full.bannerURL({ size: 4096 }));
      message.reply({ embeds: [e] });
    },
  }),

  // ---------- server (pic / banner) ----------
  u({
    name: 'server', aliases: ['serveur'],
    async execute({ message, args }) {
      const sub = (args[0] || '').toLowerCase();
      const g = message.guild;
      if (sub === 'pic' || sub === 'icon' || sub === 'icone') {
        if (!g.iconURL()) return message.reply({ embeds: [error('Ce serveur n\'a pas d\'icone.')] });
        return message.reply({ embeds: [embed(g.id).setTitle(`Icone de ${g.name}`).setImage(g.iconURL({ size: 4096 }))] });
      }
      if (sub === 'banner' || sub === 'banniere') {
        if (!g.bannerURL()) return message.reply({ embeds: [error('Ce serveur n\'a pas de banniere.')] });
        return message.reply({ embeds: [embed(g.id).setTitle(`Banniere de ${g.name}`).setImage(g.bannerURL({ size: 4096 }))] });
      }
      return message.reply({ embeds: [error('Usage : `server pic` ou `server banner`')] });
    },
  }),

  // ---------- allbots ----------
  u({
    name: 'allbots',
    async execute({ message }) {
      await message.guild.members.fetch().catch(() => {});
      const bots = message.guild.members.cache.filter(m => m.user.bot);
      const list = bots.map(b => `• ${b} \`${b.id}\``).join('\n').slice(0, 4000) || 'Aucun bot.';
      message.reply({ embeds: [embed(message.guild.id).setTitle(`🤖 Bots (${bots.size})`).setDescription(list)] });
    },
  }),

  // ---------- alladmins ----------
  u({
    name: 'alladmins',
    async execute({ message }) {
      await message.guild.members.fetch().catch(() => {});
      const admins = message.guild.members.cache.filter(m => !m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator));
      const list = admins.map(a => `• ${a} \`${a.id}\``).join('\n').slice(0, 4000) || 'Aucun.';
      message.reply({ embeds: [embed(message.guild.id).setTitle(`🛡️ Admins (${admins.size})`).setDescription(list)] });
    },
  }),

  // ---------- botadmins ----------
  u({
    name: 'botadmins',
    async execute({ message }) {
      await message.guild.members.fetch().catch(() => {});
      const admins = message.guild.members.cache.filter(m => m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator));
      const list = admins.map(a => `• ${a} \`${a.id}\``).join('\n').slice(0, 4000) || 'Aucun.';
      message.reply({ embeds: [embed(message.guild.id).setTitle(`🤖 Bots admins (${admins.size})`).setDescription(list)] });
    },
  }),

  // ---------- boosters ----------
  u({
    name: 'boosters',
    async execute({ message }) {
      await message.guild.members.fetch().catch(() => {});
      const boosters = message.guild.members.cache.filter(m => m.premiumSince);
      const list = boosters.map(b => `• ${b} — depuis <t:${Math.floor(b.premiumSinceTimestamp / 1000)}:R>`).join('\n').slice(0, 4000) || 'Aucun booster.';
      message.reply({ embeds: [embed(message.guild.id).setTitle(`🚀 Boosters (${boosters.size})`).setDescription(list)] });
    },
  }),

  // ---------- rolemembers ----------
  u({
    name: 'rolemembers', aliases: ['inrole'],
    async execute({ message, args }) {
      const role = resolveRole(message.guild, args.join(' '));
      if (!role) return message.reply({ embeds: [error('Usage : `rolemembers <role>`')] });
      await message.guild.members.fetch().catch(() => {});
      const list = role.members.map(m => `• ${m} \`${m.id}\``).join('\n').slice(0, 4000) || 'Aucun membre.';
      message.reply({ embeds: [embed(message.guild.id).setTitle(`🎭 ${role.name} (${role.members.size})`).setDescription(list)] });
    },
  }),

  // ---------- snipe ----------
  u({
    name: 'snipe',
    async execute({ message, client }) {
      const snipe = client.snipes?.get(message.channel.id);
      if (!snipe) return message.reply({ embeds: [error('Aucun message supprime recemment ici.')] });
      const e = embed(message.guild.id)
        .setAuthor({ name: snipe.author.tag, iconURL: snipe.author.displayAvatarURL() })
        .setDescription(snipe.content || '*Aucun texte*')
        .setTimestamp(snipe.date);
      if (snipe.image) e.setImage(snipe.image);
      message.reply({ embeds: [e] });
    },
  }),

  // ---------- emoji ----------
  u({
    name: 'emoji', aliases: ['emote'],
    async execute({ message, args }) {
      const arg = args[0];
      if (!arg) return message.reply({ embeds: [error('Usage : `emoji <emoji>`')] });
      const custom = arg.match(/<(a?):\w+:(\d+)>/);
      if (custom) {
        const ext = custom[1] === 'a' ? 'gif' : 'png';
        const url = `https://cdn.discordapp.com/emojis/${custom[2]}.${ext}?size=4096`;
        return message.reply({ embeds: [embed(message.guild.id).setTitle('Emoji').setImage(url)] });
      }
      // Emoji unicode -> lien twemoji
      const code = [...arg].map(c => c.codePointAt(0).toString(16)).join('-');
      const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/72x72/${code}.png`;
      message.reply({ embeds: [embed(message.guild.id).setTitle('Emoji').setImage(url)] });
    },
  }),

  // ---------- calc ----------
  u({
    name: 'calc', aliases: ['math', 'calcul'],
    async execute({ message, args }) {
      if (!args.length) return message.reply({ embeds: [error('Usage : `calc <calcul>`')] });
      try {
        const result = evaluate(args.join(' '));
        message.reply({ embeds: [embed(message.guild.id).setTitle('🧮 Calcul').addFields(
          { name: 'Expression', value: `\`${args.join(' ')}\`` },
          { name: 'Resultat', value: `\`${result}\`` },
        )] });
      } catch {
        message.reply({ embeds: [error('Calcul invalide.')] });
      }
    },
  }),

  // ---------- wiki ----------
  u({
    name: 'wiki', aliases: ['wikipedia'],
    async execute({ message, args }) {
      if (!args.length) return message.reply({ embeds: [error('Usage : `wiki <mot-cle>`')] });
      const q = encodeURIComponent(args.join(' '));
      try {
        const res = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${q}`);
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        const e = embed(message.guild.id)
          .setTitle(data.title)
          .setURL(data.content_urls?.desktop?.page)
          .setDescription(data.extract?.slice(0, 2000) || 'Aucun resume.');
        if (data.thumbnail?.source) e.setThumbnail(data.thumbnail.source);
        message.reply({ embeds: [e] });
      } catch {
        message.reply({ embeds: [error('Aucun article Wikipedia trouve.')] });
      }
    },
  }),

  // ---------- search wiki ----------
  u({
    name: 'search',
    async execute({ message, args }) {
      if ((args[0] || '').toLowerCase() !== 'wiki' || args.length < 2) {
        return message.reply({ embeds: [error('Usage : `search wiki <mot-cle>`')] });
      }
      const q = encodeURIComponent(args.slice(1).join(' '));
      try {
        const res = await fetch(`https://fr.wikipedia.org/w/api.php?action=opensearch&limit=8&format=json&search=${q}`);
        const data = await res.json();
        const titles = data[1] || [];
        if (!titles.length) throw new Error();
        const desc = titles.map((t, i) => `**${i + 1}.** [${t}](${data[3][i]})`).join('\n');
        message.reply({ embeds: [embed(message.guild.id).setTitle(`Articles pour "${args.slice(1).join(' ')}"`).setDescription(desc)] });
      } catch {
        message.reply({ embeds: [error('Aucun resultat.')] });
      }
    },
  }),

  // ---------- image (Google Custom Search) ----------
  u({
    name: 'image', aliases: ['img'],
    async execute({ message, args }) {
      if (!args.length) return message.reply({ embeds: [error('Usage : `image <mot-cle>`')] });
      const key = process.env.GOOGLE_API_KEY, cx = process.env.GOOGLE_CX;
      if (!key || !cx) return message.reply({ embeds: [error('Recherche image non configuree (GOOGLE_API_KEY / GOOGLE_CX manquants dans .env).')] });
      const q = encodeURIComponent(args.join(' '));
      try {
        const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&searchType=image&num=1&q=${q}`);
        const data = await res.json();
        const item = data.items?.[0];
        if (!item) throw new Error();
        message.reply({ embeds: [embed(message.guild.id).setTitle(args.join(' ')).setImage(item.link)] });
      } catch {
        message.reply({ embeds: [error('Aucune image trouvee.')] });
      }
    },
  }),

  // ---------- ping ----------
  u({
    name: 'ping',
    async execute({ message, client }) {
      const sent = await message.reply('🏓 ...');
      sent.edit({ content: null, embeds: [embed(message.guild.id).setTitle('🏓 Pong').addFields(
        { name: 'Latence API', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Latence message', value: `${sent.createdTimestamp - message.createdTimestamp}ms`, inline: true },
      )] });
    },
  }),
];
