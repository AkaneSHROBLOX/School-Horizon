// Routeur pour la commande +clear (plusieurs usages selon le 1er argument)
//  +clear <nombre> [membre]   -> supprime des messages (mod)
//  +clear sanctions <membre>  -> efface les sanctions d'un membre (mod)
//  +clear owners              -> vide les owners (owner du bot)
//  +clear bl                  -> vide la blacklist (owner du bot)
//  +clear badwords            -> vide les mots interdits (admin)
const db = require('../src/utils/db');
const { ok, error } = require('../src/utils/embed');
const { resolveMember } = require('../src/utils/resolve');
const { isBotOwner } = require('../src/utils/permissions');

module.exports = {
  name: 'clear',
  aliases: ['purge', 'clean'],
  category: 'Moderation',
  permission: 'mod', // les branches sensibles verifient owner en interne
  async execute({ message, args }) {
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'owners' || sub === 'bl' || sub === 'blacklist') {
      if (!isBotOwner(message.author.id)) return message.reply({ embeds: [error('Reserve aux owners du bot.')] });
      const g = db.getGlobal();
      if (sub === 'owners') { g.owners = []; db.saveGlobal(g); return message.reply({ embeds: [ok(message.guild.id, 'Tous les owners supprimes.')] }); }
      g.blacklist = {}; db.saveGlobal(g);
      return message.reply({ embeds: [ok(message.guild.id, 'Blacklist videe.')] });
    }

    if (sub === 'sanctions') {
      const target = await resolveMember(message.guild, args.slice(1).join(' '));
      if (!target) return message.reply({ embeds: [error('Usage : `clear sanctions <membre>`')] });
      db.updateGuild(message.guild.id, d => { if (d.sanctions) delete d.sanctions[target.id]; });
      return message.reply({ embeds: [ok(message.guild.id, `Sanctions de ${target} supprimees.`)] });
    }

    if (sub === 'badwords') {
      db.updateGuild(message.guild.id, d => { d.badwords = []; });
      return message.reply({ embeds: [ok(message.guild.id, 'Mots interdits supprimes.')] });
    }

    if (sub === 'limit') {
      const n = parseInt(args[1]);
      if (!n) return message.reply({ embeds: [error('Usage : `clear limit <nombre>`')] });
      db.updateGuild(message.guild.id, d => { d.moderation = d.moderation || {}; d.moderation.clearLimit = n; });
      return message.reply({ embeds: [ok(message.guild.id, `Limite de clear reglee sur ${n}.`)] });
    }

    // Sinon : clear <nombre> [membre]
    const conf = db.getGuild(message.guild.id);
    const max = conf.moderation?.clearLimit || 100;
    const amount = Math.min(parseInt(args[0]) || 0, max);
    if (!amount) return message.reply({ embeds: [error(`Usage : \`clear <nombre>\` (max ${max})`)] });
    const target = args[1] ? await resolveMember(message.guild, args[1]) : null;
    await message.delete().catch(() => {});
    let messages = await message.channel.messages.fetch({ limit: 100 });
    if (target) messages = messages.filter(msg => msg.author.id === target.id);
    messages = [...messages.values()].slice(0, amount);
    const deleted = await message.channel.bulkDelete(messages, true).catch(() => null);
    const reply = await message.channel.send({ embeds: [ok(message.guild.id, `${deleted?.size || 0} message(s) supprime(s).`)] });
    setTimeout(() => reply.delete().catch(() => {}), 4000);
  },
};
