"use client";

import type { ReactNode } from "react";
import { RequireAuth } from "@/components/require-auth";

export default function IncidentsLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
