/**
 * Safe NERIS condition rule tree (no eval / Function / dynamic code).
 * Spec operators: all, any, not, equals, notEquals, contains, exists, in,
 * greaterThan, lessThan.
 */

export type FieldValue = string | number | boolean | null | FieldValue[] | Record<string, unknown>;

export type RuleNode =
  | { all: RuleNode[] }
  | { any: RuleNode[] }
  | { not: RuleNode }
  | {
      field: string;
      equals?: unknown;
      notEquals?: unknown;
      contains?: unknown;
      in?: unknown[];
      exists?: boolean;
      greaterThan?: number;
      lessThan?: number;
    }
  | { kind: "unparsed"; raw: string; status: "NEEDS_REVIEW" };

export type RuleParseStatus = "PARSED" | "NEEDS_REVIEW" | "EMPTY";

export interface ParsedCondition {
  status: RuleParseStatus;
  raw: string | null;
  rule: RuleNode | null;
}

export type RuleContext = Record<string, FieldValue | undefined>;

function asArray(value: FieldValue | undefined): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value).trim();
}

function valuesMatch(left: unknown, right: unknown): boolean {
  return normalizeComparable(left).toUpperCase() === normalizeComparable(right).toUpperCase();
}

function valueContains(haystack: FieldValue | undefined, needle: unknown): boolean {
  if (haystack === undefined || haystack === null) return false;
  const needleNorm = normalizeComparable(needle).toUpperCase();
  if (Array.isArray(haystack)) {
    return haystack.some((item) => normalizeComparable(item).toUpperCase().includes(needleNorm));
  }
  return normalizeComparable(haystack).toUpperCase().includes(needleNorm);
}

/**
 * Evaluates a rule tree against a flat field-value context.
 * Unparsed rules evaluate to false (conservative) — callers should surface
 * NEEDS_REVIEW separately for schema validation.
 */
export function evaluateRule(node: RuleNode, context: RuleContext): boolean {
  if ("kind" in node && node.kind === "unparsed") {
    return false;
  }
  if ("all" in node) {
    return node.all.every((child) => evaluateRule(child, context));
  }
  if ("any" in node) {
    return node.any.some((child) => evaluateRule(child, context));
  }
  if ("not" in node) {
    return !evaluateRule(node.not, context);
  }
  if (!("field" in node)) {
    return false;
  }

  const current = context[node.field];

  if (node.exists !== undefined) {
    const exists =
      current !== undefined &&
      current !== null &&
      !(typeof current === "string" && current.trim() === "") &&
      !(Array.isArray(current) && current.length === 0);
    if (node.exists !== exists) return false;
  }
  if (node.equals !== undefined && !valuesMatch(current, node.equals)) return false;
  if (node.notEquals !== undefined && valuesMatch(current, node.notEquals)) return false;
  if (node.contains !== undefined && !valueContains(current, node.contains)) return false;
  if (node.in !== undefined) {
    const values = asArray(current);
    const matched = node.in.some((candidate) =>
      values.some((value) => valuesMatch(value, candidate)),
    );
    if (!matched) return false;
  }
  if (node.greaterThan !== undefined) {
    const numeric = typeof current === "number" ? current : Number(current);
    if (!Number.isFinite(numeric) || !(numeric > node.greaterThan)) return false;
  }
  if (node.lessThan !== undefined) {
    const numeric = typeof current === "number" ? current : Number(current);
    if (!Number.isFinite(numeric) || !(numeric < node.lessThan)) return false;
  }

  // A bare field node with only `field` and no operators is treated as exists=true.
  const hasOperator =
    node.equals !== undefined ||
    node.notEquals !== undefined ||
    node.contains !== undefined ||
    node.in !== undefined ||
    node.exists !== undefined ||
    node.greaterThan !== undefined ||
    node.lessThan !== undefined;
  if (!hasOperator) {
    return (
      current !== undefined &&
      current !== null &&
      !(typeof current === "string" && current.trim() === "")
    );
  }
  return true;
}
