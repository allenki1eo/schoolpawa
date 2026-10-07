/**
 * A tiny, safe arithmetic expression evaluator for parametric question templates.
 *
 * Content authors write answers like `n * p` or `round(a / b * 100, 1)`. We never use `eval`
 * or `new Function`: expressions are tokenised and parsed by this recursive-descent parser,
 * and only whitelisted functions are callable. Booleans are represented as 1 / 0 so the same
 * evaluator handles template constraints (`a > b && total % 10 == 0`).
 *
 * Grammar (lowest → highest precedence):
 *   or      := and ( "||" and )*
 *   and     := cmp ( "&&" cmp )*
 *   cmp     := add ( ("=="|"!="|"<="|">="|"<"|">") add )?
 *   add     := mul ( ("+"|"-") mul )*
 *   mul     := unary ( ("*"|"/"|"%") unary )*
 *   unary   := ("-"|"!") unary | pow
 *   pow     := primary ( "^" unary )?
 *   primary := NUMBER | IDENT | IDENT "(" args? ")" | "(" or ")"
 */

export type Scope = Readonly<Record<string, number>>;

type Token =
  | { kind: "num"; value: number }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: string }
  | { kind: "eof" };

const OPERATORS = ["||", "&&", "==", "!=", "<=", ">=", "<", ">", "+", "-", "*", "/", "%", "^", "!", "(", ")", ","];

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  round: (x, digits = 0) => {
    const f = 10 ** digits;
    return Math.round((x + Number.EPSILON) * f) / f;
  },
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  sqrt: Math.sqrt,
  min: Math.min,
  max: Math.max,
  gcd: (a, b) => gcd(a, b),
  lcm: (a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd(a, b)),
};

export class ExpressionError extends Error {
  override name = "ExpressionError";
}

function gcd(a: number, b: number): number {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new ExpressionError(`Bad number at ${i}`);
      tokens.push({ kind: "num", value: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      tokens.push({ kind: "ident", value: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExpressionError(`Unexpected character "${ch}" at ${i}`);
    tokens.push({ kind: "op", value: op });
    i += op.length;
  }
  tokens.push({ kind: "eof" });
  return tokens;
}

/** Parsed expression: call with a scope to evaluate. Parse once, evaluate many times. */
export type Compiled = (scope: Scope) => number;

export function compile(src: string): Compiled {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos]!;
  const isOp = (value: string) => {
    const t = peek();
    return t.kind === "op" && t.value === value;
  };
  const expectOp = (value: string) => {
    if (!isOp(value)) throw new ExpressionError(`Expected "${value}" in "${src}"`);
    pos++;
  };

  const binary = (next: () => Compiled, ops: string[], apply: (op: string, a: number, b: number) => number) => {
    return (): Compiled => {
      let left = next();
      for (;;) {
        const t = peek();
        if (t.kind !== "op" || !ops.includes(t.value)) return left;
        pos++;
        const right = next();
        const l = left;
        const op = t.value;
        left = (s) => apply(op, l(s), right(s));
      }
    };
  };

  const primary = (): Compiled => {
    const t = peek();
    if (t.kind === "num") {
      pos++;
      const v = t.value;
      return () => v;
    }
    if (t.kind === "ident") {
      pos++;
      if (isOp("(")) {
        pos++;
        // Own-property check: never resolve names through the prototype chain ("constructor", …).
        const fn = Object.hasOwn(FUNCTIONS, t.value) ? FUNCTIONS[t.value] : undefined;
        if (!fn) throw new ExpressionError(`Unknown function "${t.value}"`);
        const args: Compiled[] = [];
        if (!isOp(")")) {
          args.push(or());
          while (isOp(",")) {
            pos++;
            args.push(or());
          }
        }
        expectOp(")");
        return (s) => fn(...args.map((a) => a(s)));
      }
      const name = t.value;
      return (s) => {
        const v = Object.hasOwn(s, name) ? s[name] : undefined;
        if (typeof v !== "number") throw new ExpressionError(`Unknown variable "${name}"`);
        return v;
      };
    }
    if (isOp("(")) {
      pos++;
      const inner = or();
      expectOp(")");
      return inner;
    }
    throw new ExpressionError(`Unexpected token in "${src}"`);
  };

  const pow = (): Compiled => {
    const base = primary();
    if (isOp("^")) {
      pos++;
      const exp = unary();
      return (s) => base(s) ** exp(s);
    }
    return base;
  };

  const unary = (): Compiled => {
    if (isOp("-")) {
      pos++;
      const inner = unary();
      return (s) => -inner(s);
    }
    if (isOp("!")) {
      pos++;
      const inner = unary();
      return (s) => (inner(s) ? 0 : 1);
    }
    return pow();
  };

  const mul = binary(unary, ["*", "/", "%"], (op, a, b) => (op === "*" ? a * b : op === "/" ? a / b : a % b));
  const add = binary(mul, ["+", "-"], (op, a, b) => (op === "+" ? a + b : a - b));

  const cmp = (): Compiled => {
    const left = add();
    const t = peek();
    if (t.kind === "op" && ["==", "!=", "<=", ">=", "<", ">"].includes(t.value)) {
      pos++;
      const right = add();
      const op = t.value;
      return (s) => {
        const a = left(s);
        const b = right(s);
        const eq = Math.abs(a - b) < 1e-9;
        switch (op) {
          case "==": return eq ? 1 : 0;
          case "!=": return eq ? 0 : 1;
          case "<=": return a <= b || eq ? 1 : 0;
          case ">=": return a >= b || eq ? 1 : 0;
          case "<": return a < b && !eq ? 1 : 0;
          default: return a > b && !eq ? 1 : 0;
        }
      };
    }
    return left;
  };

  const and = binary(cmp, ["&&"], (_op, a, b) => (a && b ? 1 : 0));
  const or: () => Compiled = binary(and, ["||"], (_op, a, b) => (a || b ? 1 : 0));

  const root = or();
  if (peek().kind !== "eof") throw new ExpressionError(`Unexpected trailing input in "${src}"`);
  return root;
}

export function evaluate(src: string, scope: Scope): number {
  return compile(src)(scope);
}

/** Identifiers referenced by an expression (excluding function names) — used to validate templates. */
export function variablesOf(src: string): string[] {
  const tokens = tokenize(src);
  const names = new Set<string>();
  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    if (t.kind === "ident" && !(next?.kind === "op" && next.value === "(")) names.add(t.value);
  });
  return [...names];
}
