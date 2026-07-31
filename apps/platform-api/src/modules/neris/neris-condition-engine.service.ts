import { Injectable } from "@nestjs/common";
import { evaluateRule, type RuleContext, type RuleNode } from "@forge/neris";
import { ForgeError } from "@forge/errors";

/**
 * Evaluates stored NERIS condition rule trees. Never uses eval or dynamic code.
 */
@Injectable()
export class NerisConditionEngine {
  evaluate(rule: RuleNode | null | undefined, context: RuleContext): boolean {
    if (!rule) return true;
    return evaluateRule(rule, context);
  }

  assertNoEval(rule: unknown): void {
    const serialized = JSON.stringify(rule ?? null);
    if (serialized.includes("Function(") || serialized.includes("eval(")) {
      throw new ForgeError("BAD_REQUEST", "Dynamic code is not permitted in NERIS conditions");
    }
  }

  isVisible(rule: RuleNode | null | undefined, context: RuleContext): boolean {
    if (!rule) return true;
    if ("kind" in rule && rule.kind === "unparsed") {
      // Conservative: unparsed prose does not force-hide, but callers should
      // treat NEEDS_REVIEW separately in validation UIs.
      return true;
    }
    return this.evaluate(rule, context);
  }
}
