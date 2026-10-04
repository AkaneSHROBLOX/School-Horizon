const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');

// Niveaux de permission (du plus bas au plus haut)
const LEVELS = ['public', 'mod', 'admin', 'owner'];

function isBotOwner(userId) {
  if (userId === process.env.OWNER_ID) return true;
  return db.getGlobal().owners.includes(userId);
}

function isBlacklisted(userId) {
  return Boolean(db.getGlobal().blacklist[userId]);
}

// Renvoie true si le membre satisfait le niveau requis
function hasPermission(member, required) {
  if (!required || required === 'public') return true;
  if (isBotOwner(member.id)) return true;                 // owners du bot = tout
  if (member.guild && member.guild.ownerId === member.id) return true; // proprio serveur

  const perms = member.permissions;
  const isAdmin = perms.has(PermissionFlagsBits.Administrator);
  const isMod = isAdmin
    || perms.has(PermissionFlagsBits.ModerateMembers)
    || perms.has(PermissionFlagsBits.ManageMessages)
    || perms.has(PermissionFlagsBits.KickMembers)
    || perms.has(PermissionFlagsBits.BanMembers);

  // Permissions custom configurees sur le serveur (+set perm)
  const g = db.getGuild(member.guild.id);
  const grants = g.perms || {};
  // Niveau accorde le plus eleve (via le membre ou ses roles)
  const rank = { public: 0, mod: 1, admin: 2, owner: 3 };
  let grantedRank = grants[member.id] ? (rank[grants[member.id]] ?? 0) : 0;
  for (const r of member.roles.cache.values()) {
    if (grants[r.id]) grantedRank = Math.max(grantedRank, rank[grants[r.id]] ?? 0);
  }

  if (required === 'owner') return false; // seulement owners bot (deja gere ci-dessus)
  if (required === 'admin') return isAdmin || grantedRank >= rank.admin;
  if (required === 'mod') return isMod || grantedRank >= rank.mod;
  return false;
}

module.exports = { hasPermission, isBotOwner, isBlacklisted, LEVELS };
