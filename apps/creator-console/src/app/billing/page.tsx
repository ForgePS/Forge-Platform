import { redirect } from "next/navigation";

/** Legacy billing hub — Subscription-S1 lives under Business. */
export default function BillingHubRedirectPage() {
  redirect("/business");
}
