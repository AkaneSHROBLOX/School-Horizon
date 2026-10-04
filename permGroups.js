// Grades personnalisés : chaque grade donne accès à une liste précise de commandes.
// On peut attribuer un grade à un rôle ou à un membre avec "+set perm <grade> <rôle/membre>".

// Commandes ticket accessibles a tous les grades
const TICKET = ['claim', 'rename', 'add', 'close'];

const GROUPS = {
  SupportT: [
    'clear', 'warn', 'mute', 'tempmute', 'unmute', 'mutelist', 'sanctions',
    ...TICKET,
  ],
  Support: [
    'clear', 'warn', 'mute', 'tempmute', 'unmute', 'mutelist',
    'tempban', 'banlist', 'sanctions',
    ...TICKET,
  ],
  SupportS: [
    'clear', 'warn', 'mute', 'tempmute', 'unmute', 'mutelist',
    'kick', 'tempban', 'unban', 'banlist', 'sanctions',
    ...TICKET,
  ],
  'Gérant': [
    'clear', 'warn', 'mute', 'tempmute', 'unmute', 'mutelist',
    'kick', 'ban', 'tempban', 'unban', 'banlist',
    'lock', 'unlock', 'hide', 'unhide', 'addrole', 'delrole', 'derank', 'sanctions',
    ...TICKET,
    'candidatures', // droit d'accepter/refuser les candidatures (formulaires)
    'convocation', // droit de convoquer un membre du Staff
  ],
};

// "Pouvoirs" spéciaux qui ne sont pas de vraies commandes mais peuvent être ajoutés à un grade
const SPECIAL = ['candidatures'];

// Retrouve le nom exact d'un grade (insensible à la casse)
function resolveGroupName(input) {
  if (!input) return null;
  return Object.keys(GROUPS).find(g => g.toLowerCase() === String(input).toLowerCase()) || null;
}

// Grades attribués à un membre (via lui-même ou ses rôles)
function memberGroups(guildConf, member) {
  const assigns = guildConf.permGroups || {};
  const groups = new Set();
  if (assigns[member.id]) groups.add(assigns[member.id]);
  for (const roleId of member.roles.cache.keys()) if (assigns[roleId]) groups.add(assigns[roleId]);
  return groups;
}

// Commandes d'un grade = liste de base + commandes ajoutées sur mesure sur ce serveur
function groupCommands(guildConf, group) {
  const extra = (guildConf.gradeExtra || {})[group] || [];
  return [...(GROUPS[group] || []), ...extra];
}

// Le membre a-t-il, via un de ses grades, accès à cette commande/ce pouvoir ?
function groupAllows(guildConf, member, commandName) {
  for (const g of memberGroups(guildConf, member)) {
    if (groupCommands(guildConf, g).includes(commandName)) return true;
  }
  return false;
}

module.exports = { GROUPS, SPECIAL, resolveGroupName, groupAllows, memberGroups, groupCommands };
