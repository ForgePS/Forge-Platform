"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exchangeCodeForTokens, useAuth, validateOAuthState } from "@forge/web-kit";
import styles from "../../page.module.css";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Guard against React remount / searchParams identity churn double-running
    // OAuth exchange (would clear PKCE state and bounce back to login).
    if (started.current) return;
    started.current = true;

    async function completeSignIn() {
      const oauthError = searchParams.get("error");
      const oauthDescription = searchParams.get("error_description");
      if (oauthError) {
        setError(oauthDescription ?? oauthError);
        return;
      }

      const code = searchParams.get("code");
      const state = searchParams.get("state");
      if (!code) {
        setError("Missing authorization code from Cognito");
        return;
      }
      if (!validateOAuthState(state)) {
        setError("Invalid OAuth state — restart sign-in from the login page");
        return;
      }

      try {
        await exchangeCodeForTokens(code);
        await refresh();
        router.replace("/select-tenant/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed");
      }
    }

    void completeSignIn();
  }, [refresh, router, searchParams]);

  if (error) {
    return (
      <section className={styles.page}>
        <h1>Sign-in failed</h1>
        <p className={styles.error}>{error}</p>
        <p className={styles.muted}>
          <a href="/login/">Return to login</a>
        </p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1>Completing sign-in</h1>
      <p className={styles.muted}>Exchanging authorization code…</p>
    </section>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <section className={styles.page}>
          <p className={styles.muted}>Loading…</p>
        </section>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
