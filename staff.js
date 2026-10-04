// ============================================================================
//  Systeme de service du Staff : prise de service, fin de service, convocation
// ============================================================================
const { EmbedBuilder } = require('discord.js');
const db = require('../src/utils/db');
const { error } = require('../src/utils/embed');
const { resolveMember } = require('../src/utils/resolve');
const { isBotOwner } = require('../src/utils/permissions');

const CAT = 'Service';

// ---------------------------------------------------------------------------
// Identifiants fixes du serveur (modifie ici si jamais un ID change un jour)
// ---------------------------------------------------------------------------
const LOG_CHANNEL_ID = '1483904590729576598';        // salon des logs de service
const ROLE_MOD_ACTIF = '1483887299853815838';        // role actif "Moderation"
const ROLE_SUPPORT_ACTIF = '1483887304425734404';    // role actif "Support"
const ROLE_STAFF_AUTORISE = '1483887436948836483';   // role requis pour +onmod/+onsupport/+off
const ROLES_SERVICE = [ROLE_MOD_ACTIF, ROLE_SUPPORT_ACTIF];

// Habillage du message de convocation (modifie librement selon tes besoins)
const NOM_SERVEUR = 'SCHOOL HORIZON';
const NOM_STAFF = 'School Staff';
const SIGNATURE = 'School Horizon | Gestion 🏫';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Un membre peut utiliser +onmod / +onsupport / +off s'il a le role Staff
// autorise (ou s'il est owner du bot / proprio du serveur, comme partout ailleurs).
function estStaffAutorise(member) {
  if (isBotOwner(member.id)) return true;
  if (member.guild.ownerId === member.id) return true;
  return member.roles.cache.has(ROLE_STAFF_AUTORISE);
}

// Heure/date automatiques : c'est toujours le bot qui releve l'heure exacte
// (Date.now()), jamais un membre qui la tape a la main.
//
// On force le fuseau horaire de Paris ici, car si le bot tourne sur un
// serveur d'hebergement (Discloud, VPS...) regle en UTC, "18h30" en France
// s'afficherait sinon comme "16h30" ou "17h30". Cette fonction convertit
// toujours vers l'heure locale francaise, peu importe le fuseau du serveur.
function versHeureParis(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
}

// "18h30" — heure exacte au moment ou la commande est executee
function formatHeure(date = new Date()) {
  const d = versHeureParis(date);
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
}

// ms -> "2h15" — duree calculee automatiquement entre le +onmod/+onsupport et le +off
function formatDureeService(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

// Envoie une copie de l'embed dans le salon de logs fixe
async function envoyerLog(guild, embedObj) {
  let ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!ch) ch = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (ch) ch.send({ embeds: [embedObj] }).catch(() => {});
}

// Logique commune a +onmod / +onsupport
async function prendreService(message, roleId, statutLabel) {
  const member = message.member;
  if (!estStaffAutorise(member)) {
    return message.reply({ embeds: [error('Tu n\'as pas le role Staff autorise pour utiliser cette commande.')] });
  }

  const g = db.getGuild(message.guild.id);
  const dejaEnService = (g.service && g.service[member.id]) || ROLES_SERVICE.some(r => member.roles.cache.has(r));
  if (dejaEnService) {
    return message.reply({ embeds: [error('Tu es deja en service. Utilise `+off` pour terminer ton service en cours.')] });
  }

  await member.roles.add(roleId).catch(() => {});
  const startedAt = Date.now();
  db.updateGuild(message.guild.id, d => {
    d.service = d.service || {};
    d.service[member.id] = { startedAt, roleId, statut: statutLabel };
  });

  const embedObj = new EmbedBuilder()
    .setColor('#57F287')
    .setDescription([
      '🟢PRISE DE SERVICE',
      `👤Staff : ${member}`,
      `🕛Heure : ${formatHeure(new Date(startedAt))}`,
      '📍Statut : En service',
      `🎖️Service : ${statutLabel}`,
    ].join('\n'));

  await message.reply({ embeds: [embedObj] });
  envoyerLog(message.guild, embedObj);
}

// ---------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------
module.exports = [

  // ---------- onmod ----------
  {
    name: 'onmod', category: CAT, permission: 'public',
    async execute({ message }) {
      await prendreService(message, ROLE_MOD_ACTIF, 'Moderation');
    },
  },

  // ---------- onsupport ----------
  {
    name: 'onsupport', category: CAT, permission: 'public',
    async execute({ message }) {
      await prendreService(message, ROLE_SUPPORT_ACTIF, 'Support');
    },
  },

  // ---------- off ----------
  {
    name: 'off', category: CAT, permission: 'public',
    async execute({ message }) {
      const member = message.member;
      if (!estStaffAutorise(member)) {
        return message.reply({ embeds: [error('Tu n\'as pas le role Staff autorise pour utiliser cette commande.')] });
      }

      const g = db.getGuild(message.guild.id);
      const entry = g.service && g.service[member.id];
      if (!entry) {
        return message.reply({ embeds: [error('Tu n\'es pas actuellement en service.')] });
      }

      const endedAt = Date.now();
      const duree = formatDureeService(endedAt - entry.startedAt);

      for (const r of ROLES_SERVICE) {
        if (member.roles.cache.has(r)) await member.roles.remove(r).catch(() => {});
      }
      db.updateGuild(message.guild.id, d => { if (d.service) delete d.service[member.id]; });

      const embedObj = new EmbedBuilder()
        .setColor('#ED4245')
        .setDescription([
          '🔴FIN DE SERVICE',
          `👤Staff : ${member}`,
          `🕛Fin : ${formatHeure(new Date(endedAt))}`,
          `⏱️Duree : ${duree}`,
          '📍Statut : Hors service',
          `🎖️Service : ${entry.statut || 'Inconnu'}`,
        ].join('\n'));

      await message.reply({ embeds: [embedObj] });
      envoyerLog(message.guild, embedObj);
    },
  },

  // ---------- convocation ----------
  // Usage : +convocation <@membre> <date> <heure> [@responsable]
  // Si @responsable est omis, c'est l'auteur de la commande qui convoque.
  {
    name: 'convocation', category: CAT, permission: 'admin',
    async execute({ message, args }) {
      const membre = await resolveMember(message.guild, args[0] || '');
      const date = args[1];
      const heure = args[2];
      const responsable = args[3] ? await resolveMember(message.guild, args[3]) : message.member;

      if (!membre || !date || !heure || !responsable) {
        return message.reply({
          embeds: [error(
            'Usage : `+convocation <@membre> <date> <heure> [@responsable]`\n' +
            'Exemple : `+convocation @Membre 06/09/2026 20h30 @Responsable`'
          )],
        });
      }

      const contenu = [
        `⚠️ CONVOCATION — ${NOM_SERVEUR}`,
        '',
        `Bonjour ${membre},`,
        `Vous êtes convoqué(e) par ${responsable} dans le cadre de vos fonctions au sein du ${NOM_STAFF}.`,
        '',
        `📅 Date : ${date}`,
        `🕐 Heure : ${heure}`,
        `👤 Membre concerné : ${membre}`,
        `👔 Convoqué par : ${responsable}`,
        '',
        'Merci de vous rendre disponible à la date et à l\'heure indiquées.',
        `— ${SIGNATURE}`,
      ].join('\n');

      // On supprime le message de commande (+convocation ...) pour que seul
      // le message genere par le bot reste visible dans le salon.
      await message.delete().catch(() => {});
      message.channel.send({ content: contenu });
    },
  },

];
