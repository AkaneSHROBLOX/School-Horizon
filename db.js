// Stockage simple en JSON (aucune base de donnees externe requise).
// -> data/global.json  : owners, blacklist, profil du bot, theme global
// -> data/guilds/<id>.json : config par serveur (prefixe, logs, antiraid, sanctions...)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const GUILDS_DIR = path.join(DATA_DIR, 'guilds');

for (const dir of [DATA_DIR, GUILDS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return structuredClone(fallback);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------- Global ----------
const GLOBAL_FILE = path.join(DATA_DIR, 'global.json');
const GLOBAL_DEFAULT = {
  owners: [],        // IDs owners du bot
  blacklist: {},     // { userId: { reason, date, by } }
  theme: '#5865F2',  // couleur par defaut des embeds
  profile: {},       // infos profil bot
  mainPrefix: process.env.DEFAULT_PREFIX || '+',
};

function getGlobal() {
  return readJSON(GLOBAL_FILE, GLOBAL_DEFAULT);
}
function saveGlobal(data) {
  writeJSON(GLOBAL_FILE, data);
}

// ---------- Guild ----------
const GUILD_DEFAULT = {
  prefix: null,          // null => utilise mainPrefix global
  theme: null,           // null => theme global
  logs: {},              // { modlog, messagelog, voicelog, boostlog, rolelog, raidlog }
  antiraid: {},          // parametres antiraid
  moderation: {},        // muterole, timeout, antispam, antilink...
  sanctions: {},         // { userId: [ {type, reason, by, date} ] }
  mutes: {},             // { userId: {until, roleMute:true} }
  whitelist: [],         // wl antiraid
  perms: {},             // { roleOrUserId: level }  permissions bot
  badwords: [],
  customCommands: {},
  snipe: null,           // dernier message supprime (en memoire persiste)
};

function guildFile(id) {
  return path.join(GUILDS_DIR, `${id}.json`);
}
function getGuild(id) {
  return readJSON(guildFile(id), GUILD_DEFAULT);
}
function saveGuild(id, data) {
  writeJSON(guildFile(id), data);
}
// Helper: modifie et sauvegarde en un appel
function updateGuild(id, mutator) {
  const data = getGuild(id);
  mutator(data);
  saveGuild(id, data);
  return data;
}

module.exports = {
  getGlobal, saveGlobal,
  getGuild, saveGuild, updateGuild,
  GUILD_DEFAULT, GLOBAL_DEFAULT,
};
