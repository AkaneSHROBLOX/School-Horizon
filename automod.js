const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const { warn } = require('./embed');

const INVITE_RE = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i;
const LINK_RE = /(https?:\/\/|www\.)\S+/i;

// Suivi de spam en memoire : userId -> [timestamps]
const spamMap = new Map();

// Retourne true si le message a ete supprime (donc on arrete le traitement)
async function runAutomod(message) {
  const member = message.member;
  if (!member) return false;
  // Les moderateurs/admins ne sont pas filtres
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

  const mod = db.getGuild(message.guild.id).moderation || {};
  const badwords = db.getGuild(message.guild.id).badwords || [];
  const content = message.content.toLowerCase();

  // --- Antilink ---
  if (mod.antilink) {
    const mode = mod.antilinkMode || 'all';
    const hit = mode === 'invite' ? INVITE_RE.test(content) : LINK_RE.test(content);
    if (hit) {
      await message.delete().catch(() => {});
      message.channel.send({ content: `${member}`, embeds: [warn('Les liens ne sont pas autorises ici.')] })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 4000)).catch(() => {});
      return true;
    }
  }

  // --- Badwords ---
  if (mod.badwordsOn && badwords.some(w => content.includes(w))) {
    await message.delete().catch(() => {});
    message.channel.send({ content: `${member}`, embeds: [warn('Ce mot est interdit sur ce serveur.')] })
      .then(m => setTimeout(() => m.delete().catch(() => {}), 4000)).catch(() => {});
    return true;
  }

  // --- Antispam ---
  if (mod.antispam) {
    const rate = mod.antispamRate || { count: 5, seconds: 5 };
    const now = Date.now();
    const arr = (spamMap.get(member.id) || []).filter(t => now - t < rate.seconds * 1000);
    arr.push(now);
    spamMap.set(member.id, arr);
    if (arr.length > rate.count) {
      await message.channel.bulkDelete(arr.length, true).catch(() => {});
      spamMap.set(member.id, []);
      if (member.moderatable) member.timeout(60_000, 'Antispam').catch(() => {});
      message.channel.send({ content: `${member}`, embeds: [warn('Arrete de spam.')] })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 4000)).catch(() => {});
      return true;
    }
  }

  return false;
}

module.exports = { runAutomod };
