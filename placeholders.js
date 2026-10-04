// Remplace les variables {user} {username} {server} {count} dans un texte
function applyPlaceholders(text, member) {
  if (!text) return text;
  return text
    .replace(/{user}/gi, member.toString())
    .replace(/{username}/gi, member.user.username)
    .replace(/{tag}/gi, member.user.tag)
    .replace(/{id}/gi, member.id)
    .replace(/{server}/gi, member.guild.name)
    .replace(/{count}/gi, member.guild.memberCount)
    .replace(/{membercount}/gi, member.guild.memberCount);
}

module.exports = { applyPlaceholders };
