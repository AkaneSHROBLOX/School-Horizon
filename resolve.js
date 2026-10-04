// Resolution des parametres : noms, mentions ou IDs.
// Si ce ne sont pas des mentions, ils doivent etre separes par ",," (comme Crow Bots).

// Decoupe une chaine d'arguments en cibles multiples separees par ",,"
function splitTargets(str) {
  if (!str) return [];
  return str.split(',,').map(s => s.trim()).filter(Boolean);
}

// --- MEMBRES ---
async function resolveMember(guild, query) {
  if (!query) return null;
  query = query.trim();
  // Mention <@id> ou <@!id>
  const mention = query.match(/^<@!?(\d+)>$/);
  if (mention) return guild.members.fetch(mention[1]).catch(() => null);
  // ID pur
  if (/^\d{16,20}$/.test(query)) {
    const byId = await guild.members.fetch(query).catch(() => null);
    if (byId) return byId;
  }
  // Nom / pseudo (recherche dans le cache, sinon fetch)
  const lower = query.toLowerCase();
  let found = guild.members.cache.find(m =>
    m.user.username.toLowerCase() === lower ||
    (m.nickname && m.nickname.toLowerCase() === lower) ||
    m.user.tag.toLowerCase() === lower
  );
  if (found) return found;
  // Recherche approximative via l'API
  const search = await guild.members.fetch({ query, limit: 1 }).catch(() => null);
  if (search && search.size) return search.first();
  return null;
}

async function resolveMembers(guild, str) {
  const targets = splitTargets(str);
  const results = [];
  for (const t of targets) {
    const m = await resolveMember(guild, t);
    if (m) results.push(m);
  }
  return results;
}

// --- ROLES ---
function resolveRole(guild, query) {
  if (!query) return null;
  query = query.trim();
  const mention = query.match(/^<@&(\d+)>$/);
  if (mention) return guild.roles.cache.get(mention[1]) || null;
  if (/^\d{16,20}$/.test(query)) {
    const byId = guild.roles.cache.get(query);
    if (byId) return byId;
  }
  const lower = query.toLowerCase();
  return guild.roles.cache.find(r => r.name.toLowerCase() === lower)
      || guild.roles.cache.find(r => r.name.toLowerCase().includes(lower))
      || null;
}

// --- SALONS ---
function resolveChannel(guild, query) {
  if (!query) return null;
  query = query.trim();
  const mention = query.match(/^<#(\d+)>$/);
  if (mention) return guild.channels.cache.get(mention[1]) || null;
  if (/^\d{16,20}$/.test(query)) {
    const byId = guild.channels.cache.get(query);
    if (byId) return byId;
  }
  const lower = query.toLowerCase();
  return guild.channels.cache.find(c => c.name.toLowerCase() === lower)
      || guild.channels.cache.find(c => c.name.toLowerCase().includes(lower))
      || null;
}

module.exports = {
  splitTargets,
  resolveMember, resolveMembers,
  resolveRole, resolveChannel,
};
