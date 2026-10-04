// ============================================================================
//  Salons vocaux temporaires "Bureau" (join to create)
//  Rejoindre le salon HUB cree automatiquement un salon "・Bureau X" et y
//  deplace le membre. Le salon est supprime automatiquement des qu'il
//  redevient vide. Le createur recoit le droit de gerer (donc renommer)
//  son propre salon.
// ============================================================================
const { ChannelType, PermissionFlagsBits, OverwriteType } = require('discord.js');
const db = require('./db');

// Salon vocal a rejoindre pour declencher la creation d'un bureau
const HUB_VOCAL_ID = '1483888466688213013';

// Cree un nouveau salon "Bureau" et y deplace le membre
async function creerBureau(member, hub) {
  const guild = member.guild;
  const g = db.getGuild(guild.id);
  const bureaux = g.bureaux || {};

  // Numero le plus bas disponible : le 1er createur a "Bureau 1", le 5e a
  // "Bureau 5" ; si un bureau est supprime, son numero redevient disponible.
  const numerosUtilises = new Set(Object.values(bureaux).map(b => b.number));
  let numero = 1;
  while (numerosUtilises.has(numero)) numero++;

  // On reprend les permissions de la categorie du hub pour que le bureau
  // garde la meme visibilite que les salons voisins, puis on ajoute le
  // createur avec le droit de gerer (renommer) son propre salon.
  const overwrites = hub.parent
    ? hub.parent.permissionOverwrites.cache.map(ow => ({ id: ow.id, type: ow.type, allow: ow.allow, deny: ow.deny }))
    : [];
  overwrites.push({
    id: member.id,
    type: OverwriteType.Member,
    allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect],
  });

  const salon = await guild.channels.create({
    name: `・Bureau ${numero}`,
    type: ChannelType.GuildVoice,
    parent: hub.parentId || undefined,
    permissionOverwrites: overwrites,
  }).catch(() => null);
  if (!salon) return null;

  db.updateGuild(guild.id, d => {
    d.bureaux = d.bureaux || {};
    d.bureaux[salon.id] = { number: numero, ownerId: member.id };
  });

  await member.voice.setChannel(salon).catch(() => {});
  return salon;
}

// A appeler depuis l'evenement voiceStateUpdate : gere la creation et la
// suppression automatique des bureaux.
async function handleBureauVoiceUpdate(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  // Rejoindre le hub -> creation d'un nouveau bureau + redirection dedans
  if (newState.channelId === HUB_VOCAL_ID && oldState.channelId !== HUB_VOCAL_ID) {
    const hub = newState.channel;
    if (hub) await creerBureau(member, hub);
    return;
  }

  // Quitter (ou changer de) salon -> si c'etait un bureau et qu'il est vide, on le supprime
  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    const guild = oldState.guild;
    const g = db.getGuild(guild.id);
    const bureau = g.bureaux && g.bureaux[oldState.channelId];
    if (bureau && oldState.channel && oldState.channel.members.size === 0) {
      await oldState.channel.delete().catch(() => {});
      db.updateGuild(guild.id, d => { if (d.bureaux) delete d.bureaux[oldState.channelId]; });
    }
  }
}

module.exports = { handleBureauVoiceUpdate, HUB_VOCAL_ID };
