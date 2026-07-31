"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@forge/web-kit";
import styles from "../app/page.module.css";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { me, loading } = useAuth();

  useEffect(() => {
    if (!loading && !me) {
      router.replace("/login/");
    }
  }, [loading, me, router]);

  if (loading) {
    return <p className={styles.muted}>Checking session…</p>;
  }

  if (!me) {
    return null;
  }

  return children;
}
