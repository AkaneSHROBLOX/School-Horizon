// Convertit une saisie utilisateur en emoji utilisable par setEmoji()
// - emoji custom <:nom:id> ou <a:nom:id> -> objet { id, name, animated }
// - emoji unicode (😀) -> la chaine telle quelle
function toEmoji(str) {
  if (!str) return null;
  const custom = String(str).match(/<(a?):(\w+):(\d+)>/);
  if (custom) return { animated: custom[1] === 'a', name: custom[2], id: custom[3] };
  return String(str).trim();
}

module.exports = { toEmoji };
