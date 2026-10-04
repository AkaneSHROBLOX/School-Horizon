// Routeur pour +del
//  +del sanction <membre> <numero> -> supprime une sanction (mod)
//  +del perm <role>                -> retire les permissions bot d'un role (admin)
const db = require('../src/utils/db');
const { ok, error } = require('../src/utils/embed');
const { resolveMember, resolveRole } = require('../src/utils/resolve');

module.exports = {
  name: 'del',
  category: 'Configuration',
  permission: 'mod',
  async execute({ message, args }) {
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'sanction') {
      const target = await resolveMember(message.guild, args[1] || '');
      const num = parseInt(args[2]);
      if (!target || !num) return message.reply({ embeds: [error('Usage : `del sanction <membre> <numero>`')] });
      db.updateGuild(message.guild.id, d => { if (d.sanctions?.[target.id]) d.sanctions[target.id].splice(num - 1, 1); });
      return message.reply({ embeds: [ok(message.guild.id, `Sanction #${num} de ${target} supprimee.`)] });
    }

    if (sub === 'perm') {
      const role = resolveRole(message.guild, args.slice(1).join(' '));
      const member = role ? null : await resolveMember(message.guild, args.slice(1).join(' '));
      const id = role?.id || member?.id;
      if (!id) return message.reply({ embeds: [error('Usage : `del perm <role/membre>`')] });
      db.updateGuild(message.guild.id, d => { if (d.perms) delete d.perms[id]; if (d.permGroups) delete d.permGroups[id]; });
      return message.reply({ embeds: [ok(message.guild.id, `Permissions et grade retires a ${role || member}.`)] });
    }

    // Dans un ticket : "del <membre>" retire le membre du ticket
    const { ticketOpenerId } = require('./tickets');
    if (ticketOpenerId(message.channel)) {
      const member = await resolveMember(message.guild, args.join(' '));
      if (!member) return message.reply({ embeds: [error('Usage : `del <membre>` (dans un ticket)')] });
      await message.channel.permissionOverwrites.delete(member.id).catch(() => {});
      return message.reply({ embeds: [ok(message.guild.id, `${member} retiré du ticket.`)] });
    }

    return message.reply({ embeds: [error('Usage : `del sanction ...`, `del perm ...`, ou `del <membre>` dans un ticket')] });
  },
};
