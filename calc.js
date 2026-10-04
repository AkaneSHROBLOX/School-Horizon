// ============================================================
//  Evaluateur d'expressions mathematiques, sans dependance externe.
//  Remplace mathjs (18 Mo sur le disque, tres lourd en RAM pour un
//  simple "+calc") par un petit analyseur syntaxique maison.
//
//  Supporte : + - * / % ^ (), unaire -/+, decimales,
//  fonctions (sqrt, abs, sin, cos, tan, asin, acos, atan, log,
//  log10, log2, exp, round, floor, ceil, min, max, pow),
//  constantes (pi, e).
//
//  Limite connue (mineure) : pas de multiplication implicite —
//  "2(3+4)" doit s'ecrire "2*(3+4)".
// ============================================================

const FUNCTIONS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  log: Math.log, log10: Math.log10, log2: Math.log2,
  exp: Math.exp,
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  pow: (a, b) => Math.pow(a, b),
};
const CONSTANTS = { pi: Math.PI, e: Math.E };

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (input.slice(i, i + 2) === '**') { tokens.push({ type: 'op', value: '^' }); i += 2; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      const numStr = input.slice(i, j);
      if ((numStr.match(/\./g) || []).length > 1) throw new Error('Nombre invalide');
      tokens.push({ type: 'num', value: parseFloat(numStr) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < input.length && /[a-zA-Z_0-9]/.test(input[j])) j++;
      tokens.push({ type: 'ident', value: input.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/%^(),'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }
    throw new Error(`Caractere inattendu : ${c}`);
  }
  return tokens;
}

class Parser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }
  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }
  isOp(v) { const t = this.peek(); return !!t && t.type === 'op' && t.value === v; }
  expectOp(op) {
    const t = this.next();
    if (!t || t.type !== 'op' || t.value !== op) throw new Error(`"${op}" attendu`);
  }

  parseExpression() { return this.parseAddSub(); }

  parseAddSub() {
    let left = this.parseMulDiv();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().value;
      const right = this.parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  parseMulDiv() {
    let left = this.parseUnary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.next().value;
      const right = this.parseUnary();
      if (op === '*') left *= right;
      else if (op === '/') left /= right;
      else left %= right;
    }
    return left;
  }

  parseUnary() {
    if (this.isOp('-') || this.isOp('+')) {
      const op = this.next().value;
      const val = this.parseUnary();
      return op === '-' ? -val : val;
    }
    return this.parsePow();
  }

  parsePow() {
    const base = this.parsePrimary();
    if (this.isOp('^')) {
      this.next();
      const exp = this.parseUnary(); // associativite a droite, autorise 2^-2
      return Math.pow(base, exp);
    }
    return base;
  }

  parsePrimary() {
    const t = this.peek();
    if (!t) throw new Error('Expression incomplete');
    if (t.type === 'num') { this.next(); return t.value; }
    if (this.isOp('(')) {
      this.next();
      const val = this.parseExpression();
      this.expectOp(')');
      return val;
    }
    if (t.type === 'ident') {
      this.next();
      const name = t.value.toLowerCase();
      if (this.isOp('(')) {
        this.next();
        const args = [];
        if (!this.isOp(')')) {
          args.push(this.parseExpression());
          while (this.isOp(',')) { this.next(); args.push(this.parseExpression()); }
        }
        this.expectOp(')');
        const fn = FUNCTIONS[name];
        if (!fn) throw new Error(`Fonction inconnue : ${name}`);
        return fn(...args);
      }
      if (name in CONSTANTS) return CONSTANTS[name];
      throw new Error(`Symbole inconnu : ${name}`);
    }
    throw new Error('Expression invalide');
  }
}

function evaluate(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Expression vide');
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  const result = parser.parseExpression();
  if (parser.pos !== tokens.length) throw new Error('Expression invalide (caracteres en trop)');
  if (typeof result !== 'number' || Number.isNaN(result)) throw new Error('Resultat invalide');
  return result;
}

module.exports = { evaluate };
