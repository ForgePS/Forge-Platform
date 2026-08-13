import { Injectable } from "@nestjs/common";
import {
  commercialSequences,
  type DatabaseTransaction,
} from "@forge/database";
import type { CommercialSequenceKey } from "@forge/contracts";
import { ForgeError } from "@forge/errors";
import { eq, sql } from "drizzle-orm";
import { padSeq } from "./commercial-money.js";

/**
 * Platform-global commercial document numbers.
 * Uses row-lock UPDATE ... RETURNING on commercial_sequences.
 *
 * Formats:
 * - SUBSCRIPTION → SUB-0000123
 * - INVOICE → FORGE-2026-000123 (year from issue date / now)
 * - PAYMENT → PAY-0000123
 * - CREDIT → CR-0000123
 * - CONTRACT → CTR-0000123
 */
@Injectable()
export class CommercialSequencesService {
  async nextNumber(
    tx: DatabaseTransaction,
    key: CommercialSequenceKey,
    opts?: { at?: Date },
  ): Promise<string> {
    const [row] = await tx
      .update(commercialSequences)
      .set({
        lastValue: sql`${commercialSequences.lastValue} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(commercialSequences.sequenceKey, key))
      .returning();

    if (!row) {
      throw new ForgeError("INTERNAL_ERROR", `Commercial sequence missing for key ${key}`);
    }

    const n = Number(row.lastValue);
    const padded = padSeq(n);

    switch (key) {
      case "INVOICE": {
        const year = (opts?.at ?? new Date()).getUTCFullYear();
        return `FORGE-${year}-${padded}`;
      }
      case "SUBSCRIPTION":
        return `SUB-${padded}`;
      case "PAYMENT":
        return `PAY-${padded}`;
      case "CREDIT":
        return `CR-${padded}`;
      case "CONTRACT":
        return `CTR-${padded}`;
      default: {
        const _exhaustive: never = key;
        return _exhaustive;
      }
    }
  }
}
