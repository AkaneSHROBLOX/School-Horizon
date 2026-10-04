// Routeur pour +set (plusieurs sous-commandes)
//  +set name/pic/banner <valeur>  -> profil du bot (owner)
//  +set perm <permission/commande> <role/membre> -> donne un acces (admin)
//  +set muterole <role>           -> definit le role muet (admin)
const db = require('../src/utils/db');
const { ok, error } = require('../src/utils/embed');
const { resolveRole, resolveMember } = require('../src/utils/resolve');
const { isBotOwner, LEVELS } = require('../src/utils/permissions');
const { resolveGroupName, GROUPS } = require('../src/utils/permGroups');

module.exports = {
  name: 'set',
  category: 'Configuration',
  permission: 'admin',
  async execute({ message, args, client }) {
    const sub = (args[0] || '').toLowerCase();
    const value = args.slice(1).join(' ');
    const attach = message.attachments.first();

    // --- Profil du bot (owner uniquement) ---
    if (['name', 'pic', 'avatar', 'banner'].includes(sub)) {
      if (!isBotOwner(message.author.id)) return message.reply({ embeds: [error('Reserve aux owners du bot.')] });
      try {
        if (sub === 'name') {
          if (!value) return message.reply({ embeds: [error('Usage : `set name <nom>`')] });
          await client.user.setUsername(value);
          return message.reply({ embeds: [ok(message.guild.id, `Nom du bot change en **${value}**.`)] });
        }
        const url = attach?.url || value;
        if (!url) return message.reply({ embeds: [error('Fournis un lien ou joins une image.')] });
        if (sub === 'banner') await client.user.setBanner(url);
        else await client.user.setAvatar(url);
        return message.reply({ embeds: [ok(message.guild.id, `${sub === 'banner' ? 'Banniere' : 'Avatar'} du bot mis a jour.`)] });
      } catch (e) {
        return message.reply({ embeds: [error(`Echec : ${e.message} (Discord limite a 2 changements/heure).`)] });
      }
    }

    // --- set perm <niveau OU grade> <role/membre> ---
    if (sub === 'perm' || sub === 'grade') {
      const raw = args[1] || '';
      const level = raw.toLowerCase();
      const group = resolveGroupName(raw);
      const targetArg = args.slice(2).join(' ');
      const role = resolveRole(message.guild, targetArg);
      const member = role ? null : await resolveMember(message.guild, targetArg);
      const id = role?.id || member?.id;
      if (!id) return message.reply({ embeds: [error(`Usage : \`set perm <niveau/grade> <role/membre>\`\nNiveaux : ${LEVELS.join(', ')}\nGrades : ${Object.keys(GROUPS).join(', ')}`)] });

      if (LEVELS.includes(level)) {
        db.updateGuild(message.guild.id, d => { d.perms = d.perms || {}; d.perms[id] = level; });
        return message.reply({ embeds: [ok(message.guild.id, `Niveau \`${level}\` accorde a ${role || member}.`)] });
      }
      if (group) {
        db.updateGuild(message.guild.id, d => { d.permGroups = d.permGroups || {}; d.permGroups[id] = group; });
        return message.reply({ embeds: [ok(message.guild.id, `Grade **${group}** accorde a ${role || member} (${GROUPS[group].length} commandes).`)] });
      }
      return message.reply({ embeds: [error(`Niveau/grade invalide.\nNiveaux : ${LEVELS.join(', ')}\nGrades : ${Object.keys(GROUPS).join(', ')}`)] });
    }

    // --- set muterole <role> ---
    if (sub === 'muterole') {
      const role = resolveRole(message.guild, args.slice(1).join(' '));
      if (!role) return message.reply({ embeds: [error('Usage : `set muterole <role>`')] });
      db.updateGuild(message.guild.id, d => { d.moderation = d.moderation || {}; d.moderation.muteRoleId = role.id; });
      return message.reply({ embeds: [ok(message.guild.id, `Role muet defini sur ${role}.`)] });
    }

    return message.reply({ embeds: [error('Usage : `set <name/pic/banner/perm/muterole> ...`')] });
  },
};
