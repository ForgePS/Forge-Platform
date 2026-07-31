import type { ParsedCondition, RuleNode } from "./rules.js";

const TRUE_FALSE = /^(TRUE|FALSE)$/i;

function stripParens(input: string): string {
  let value = input.trim();
  while (value.startsWith("(") && value.endsWith(")")) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function splitTopLevel(input: string, separators: string[]): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  const upper = input.toUpperCase();
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const matched = separators.find((sep) => upper.startsWith(sep, i));
      if (matched) {
        parts.push(current.trim());
        current = "";
        i += matched.length - 1;
        continue;
      }
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts.length > 1 && parts.every((part) => part.length > 0) ? parts : null;
}

function parseAtomic(expression: string): RuleNode | null {
  const expr = stripParens(expression);
  if (!expr) return null;

  // field is null / field is not null
  let match = expr.match(/^([A-Za-z0-9_.]+)\s+is\s+null$/i);
  if (match) {
    return { field: match[1]!, exists: false };
  }
  match = expr.match(/^([A-Za-z0-9_.]+)\s+is\s+not\s+null$/i);
  if (match) {
    return { field: match[1]!, exists: true };
  }

  // field includes X / field contains X
  match = expr.match(/^([A-Za-z0-9_.]+)\s+(includes|contains)\s+(.+)$/i);
  if (match) {
    return { field: match[1]!, contains: unquote(match[3]!) };
  }

  // field in (a, b, c)
  match = expr.match(/^([A-Za-z0-9_.]+)\s+in\s*\((.+)\)$/i);
  if (match) {
    const values = match[2]!
      .split(",")
      .map((part) => unquote(part.trim()))
      .filter((part) => part.length > 0);
    return { field: match[1]!, in: values };
  }

  // field != value / field <> value
  match = expr.match(/^([A-Za-z0-9_.]+)\s*(!=|<>)\s*(.+)$/);
  if (match) {
    return { field: match[1]!, notEquals: coerceLiteral(unquote(match[3]!)) };
  }

  // field = value / field == value
  match = expr.match(/^([A-Za-z0-9_.]+)\s*(==|=)\s*(.+)$/);
  if (match) {
    return { field: match[1]!, equals: coerceLiteral(unquote(match[3]!)) };
  }

  // field > n / field < n
  match = expr.match(/^([A-Za-z0-9_.]+)\s*>\s*(-?\d+(?:\.\d+)?)$/);
  if (match) {
    return { field: match[1]!, greaterThan: Number(match[2]) };
  }
  match = expr.match(/^([A-Za-z0-9_.]+)\s*<\s*(-?\d+(?:\.\d+)?)$/);
  if (match) {
    return { field: match[1]!, lessThan: Number(match[2]) };
  }

  // field value_1 = X  (treated as field contains X)
  match = expr.match(/^([A-Za-z0-9_.]+)\s+value_1\s*=\s*(.+)$/i);
  if (match) {
    return { field: match[1]!, contains: unquote(match[2]!) };
  }

  return null;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function coerceLiteral(value: string): string | boolean | number {
  if (TRUE_FALSE.test(value)) {
    return value.toUpperCase() === "TRUE";
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

function parseExpression(expression: string): RuleNode | null {
  const expr = stripParens(expression);
  if (!expr) return null;

  // NOT ...
  const notMatch = expr.match(/^not\s+(.+)$/i);
  if (notMatch) {
    const inner = parseExpression(notMatch[1]!);
    return inner ? { not: inner } : null;
  }

  const andParts = splitTopLevel(expr, [" AND ", " & ", "&&"]);
  if (andParts) {
    const children = andParts.map((part) => parseExpression(part));
    if (children.every((child): child is RuleNode => child !== null)) {
      return { all: children };
    }
    return null;
  }

  const orParts = splitTopLevel(expr, [" OR ", "||"]);
  if (orParts) {
    const children = orParts.map((part) => parseExpression(part));
    if (children.every((child): child is RuleNode => child !== null)) {
      return { any: children };
    }
    return null;
  }

  return parseAtomic(expr);
}

/**
 * Convert a source `possible_if` / conditional-required expression into a
 * structured rule tree. Prose that cannot be safely parsed is returned as
 * `{ kind: "unparsed", status: "NEEDS_REVIEW" }` — never evaluated via eval.
 */
export function parseConditionExpression(raw: string | null | undefined): ParsedCondition {
  if (raw === null || raw === undefined) {
    return { status: "EMPTY", raw: null, rule: null };
  }
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return { status: "EMPTY", raw: null, rule: null };
  }

  const rule = parseExpression(trimmed);
  if (rule) {
    return { status: "PARSED", raw: trimmed, rule };
  }
  return {
    status: "NEEDS_REVIEW",
    raw: trimmed,
    rule: { kind: "unparsed", raw: trimmed, status: "NEEDS_REVIEW" },
  };
}
