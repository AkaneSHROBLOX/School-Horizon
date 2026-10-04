const db = require('../utils/db');
const { hasPermission, isBlacklisted } = require('../utils/permissions');
const { groupAllows } = require('../utils/permGroups');
const { error } = require('../utils/embed');
const { runAutomod } = require('../utils/automod');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot || !message.guild) return;

    // Auto-moderation (antilink, badwords, antispam) sur tous les messages
    if (await runAutomod(message)) return;

    const guildConf = db.getGuild(message.guild.id);
    const prefix = guildConf.prefix || db.getGlobal().mainPrefix || process.env.DEFAULT_PREFIX || '+';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();

    const command = client.commands.get(cmdName)
      || client.commands.get(client.aliases.get(cmdName));
    if (!command) return;

    // Blacklist globale : l'utilisateur ne peut rien faire
    if (isBlacklisted(message.author.id)) return;

    // Verification des permissions : niveau standard OU grade custom autorisant cette commande
    const allowed = hasPermission(message.member, command.permission)
      || groupAllows(guildConf, message.member, command.name);
    if (!allowed) {
      return message.reply({
        embeds: [error(`Tu n'as pas la permission d'utiliser cette commande (niveau requis : \`${command.permission}\`).`)],
      }).catch(() => {});
    }

    try {
      await command.execute({ client, message, args, prefix, guildConf });
    } catch (err) {
      console.error(`Erreur commande ${cmdName}:`, err);
      message.reply({ embeds: [error('Une erreur est survenue lors de l\'execution de la commande.')] }).catch(() => {});
    }
  },
};
