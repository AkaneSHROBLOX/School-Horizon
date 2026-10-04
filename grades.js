const db = require('../src/utils/db');
const { embed, ok, error } = require('../src/utils/embed');
const { GROUPS, SPECIAL, resolveGroupName, groupCommands } = require('../src/utils/permGroups');

module.exports = {
  name: 'grades', aliases: ['grade', 'permgroups'], category: 'Configuration', permission: 'admin',
  async execute({ message, args, client }) {
    const sub = (args[0] || '').toLowerCase();

    // +grades add <grade> <commande>
    if (sub === 'add' || sub === 'del' || sub === 'remove') {
      const group = resolveGroupName(args[1]);
      const cmdRaw = (args[2] || '').toLowerCase();
      if (!group) return message.reply({ embeds: [error(`Grade inconnu. Choix : ${Object.keys(GROUPS).join(', ')}`)] });
      if (!cmdRaw) return message.reply({ embeds: [error('Usage : `grades add <grade> <commande>`')] });

      // Résout la commande (nom ou alias) ou un pouvoir spécial
      const base = client.commands.has(cmdRaw) ? cmdRaw
        : (client.aliases.get(cmdRaw) || (SPECIAL.includes(cmdRaw) ? cmdRaw : null));
      if (!base) return message.reply({ embeds: [error(`Commande inconnue : \`${cmdRaw}\`. (Astuce : \`candidatures\` = droit d'accepter/refuser les formulaires.)`)] });

      if (sub === 'add') {
        if (groupCommands(db.getGuild(message.guild.id), group).includes(base)) {
          return message.reply({ embeds: [error(`Le grade **${group}** a déjà accès à \`${base}\`.`)] });
        }
        db.updateGuild(message.guild.id, d => {
          d.gradeExtra = d.gradeExtra || {}; d.gradeExtra[group] = d.gradeExtra[group] || [];
          d.gradeExtra[group].push(base);
        });
        return message.reply({ embeds: [ok(message.guild.id, `\`${base}\` ajouté au grade **${group}**.`)] });
      }
      // del : uniquement possible sur les commandes ajoutées sur mesure
      db.updateGuild(message.guild.id, d => {
        if (d.gradeExtra?.[group]) d.gradeExtra[group] = d.gradeExtra[group].filter(c => c !== base);
      });
      if (GROUPS[group].includes(base)) {
        return message.reply({ embeds: [error(`\`${base}\` fait partie du grade **${group}** par défaut et ne peut pas être retiré (seules les commandes ajoutées avec \`grades add\` peuvent l'être).`)] });
      }
      return message.reply({ embeds: [ok(message.guild.id, `\`${base}\` retiré du grade **${group}**.`)] });
    }

    // Affichage des grades
    const conf = db.getGuild(message.guild.id);
    const assigns = conf.permGroups || {};
    const e = embed(message.guild.id).setTitle('🏷️ Grades (groupes de permissions)');
    for (const name of Object.keys(GROUPS)) {
      const cmds = groupCommands(conf, name);
      const extra = (conf.gradeExtra || {})[name] || [];
      const holders = Object.entries(assigns).filter(([, g]) => g === name).map(([id]) => `<@&${id}>/<@${id}>`).join(', ') || '_personne_';
      const cmdText = cmds.map(c => extra.includes(c) ? `**\`${c}\`**` : `\`${c}\``).join(' ');
      e.addFields({ name: `${name} (${cmds.length} cmd)`, value: `**Commandes :** ${cmdText}\n**Attribué à :** ${holders}` });
    }
    e.setFooter({ text: 'Attribuer : +set perm <grade> <rôle> · Ajouter une cmd : +grades add <grade> <cmd> · en gras = ajouté sur mesure' });
    message.reply({ embeds: [e] });
  },
};
