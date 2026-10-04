require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection, Options } = require('discord.js');

if (!process.env.TOKEN) {
  console.error('❌ Aucun TOKEN trouve. Copie .env.example en .env et renseigne ton token.');
  process.exit(1);
}

// ------------------------------------------------------------
// RAM : le cache par defaut de discord.js garde TOUS les messages
// de TOUS les salons indefiniment, ce qui peut a lui seul faire
// gonfler la RAM tres au-dela de 100 Mo sur un serveur actif.
// Aucune commande ne relit l'historique en cache (verifie), mais les
// logs d'edition/suppression (+ +snipe) ont besoin d'un minimum de
// messages recents en memoire pour retrouver l'ancien contenu.
// On limite donc a 50 messages recents par salon plutot que 0/illimite.
// ------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.DirectMessages,
    // GuildPresences retire : jamais utilise nulle part dans le code,
    // et c'est l'intent le plus couteux en RAM (un objet de presence
    // par membre, mis a jour en continu).
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User],
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 50,           // 50 messages recents par salon (pas illimite)
    ReactionManager: 0,           // jamais lu depuis le cache
    GuildStickerManager: 0,
    PresenceManager: 0,           // plus d'intent presence de toute facon
    GuildScheduledEventManager: 0,
    AutoModerationRuleManager: 0,
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: {
      interval: 1800,             // toutes les 30 min
      lifetime: 3600,             // supprime les messages en cache de plus d'1h
    },
  },
});

// --- Chargement des commandes ---
client.commands = new Collection(); // nom -> commande
client.aliases = new Collection();  // alias -> nom
client.categories = new Map();      // categorie -> [noms]

function registerCommand(cmd) {
  if (!cmd || !cmd.name || typeof cmd.execute !== 'function') return;
  client.commands.set(cmd.name, cmd);
  (cmd.aliases || []).forEach(a => client.aliases.set(a, cmd.name));
  const cat = cmd.category || 'Autre';
  if (!client.categories.has(cat)) client.categories.set(cat, []);
  client.categories.get(cat).push(cmd.name);
}

const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const mod = require(path.join(commandsPath, file));
  if (Array.isArray(mod)) mod.forEach(registerCommand);
  else registerCommand(mod);
}
console.log(`📦 ${client.commands.size} commandes chargees.`);

// --- Chargement des gestionnaires d'interactions (boutons, menus, modals) ---
client.interactionHandlers = [];
const interPath = path.join(__dirname, 'src', 'interactions');
if (fs.existsSync(interPath)) {
  for (const file of fs.readdirSync(interPath).filter(f => f.endsWith('.js'))) {
    client.interactionHandlers.push(require(path.join(interPath, file)));
  }
  console.log(`🔘 ${client.interactionHandlers.length} gestionnaires d'interactions charges.`);
}

// --- Chargement des evenements ---
const eventsPath = path.join(__dirname, 'src', 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) client.once(event.name, (...args) => event.execute(client, ...args));
  else client.on(event.name, (...args) => event.execute(client, ...args));
}

process.on('unhandledRejection', err => console.error('unhandledRejection:', err));
client.login(process.env.TOKEN);
