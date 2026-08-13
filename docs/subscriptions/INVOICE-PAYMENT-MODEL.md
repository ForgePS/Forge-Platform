# Invoice & payment model

## Invoices

Statuses: Draft → Open/Sent → Partially Paid → Paid | Past Due | Void

- Numbers allocated server-side (`FORGE-YYYY-######`) via `commercial_sequences`
- Drafts mutable; finalized invoices are immutable (void or credit memo / replacement)
- Line types: subscription, product, module, implementation, proration, adjustment, credit, custom

## Payments

Manual methods only until provider integration: MANUAL, ACH_EXTERNAL, CHECK, CARD_EXTERNAL, WIRE, OTHER.

- Never store PAN/CVV/bank secrets
- Allocations update invoice `amountPaidCents`, `balanceCents`, status
- Account balance is **derived**: open invoice balances − unapplied payments − remaining credits

## Credits

Append-only ledger. Credits do not rewrite historical invoice totals; they apply to balances.

## PDF

Creator invoice detail provides print/PDF-ready layout (browser print). No AWS/tenant UUIDs on customer-facing document.
