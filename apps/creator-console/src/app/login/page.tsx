"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  clearAuthStorage,
  parseDevPrincipal,
  setBearerToken,
  setDevPrincipal,
} from "@/lib/auth-storage";
import styles from "../page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { refresh, me, loading, error: authError } = useAuth();
  const [userId, setUserId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [bearerToken, setBearerTokenValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onDevLogin(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      setDevPrincipal({ userId: userId.trim(), tenantId: tenantId.trim() });
      await refresh();
      router.push("/select-tenant");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCognitoLogin(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      setBearerToken(bearerToken.trim());
      await refresh();
      router.push("/select-tenant");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  function onClearSession() {
    clearAuthStorage();
    void refresh();
  }

  const envPrincipal = process.env.NEXT_PUBLIC_DEV_PRINCIPAL;
  const parsedEnv = envPrincipal ? parseDevPrincipal(envPrincipal) : null;

  return (
    <section className={styles.page}>
      <h1>Login</h1>
      <p className={styles.lead}>
        Local development uses <code>x-forge-dev-principal</code>. Production uses Cognito bearer
        tokens.
      </p>

      {authError ? <p className={styles.error}>{authError}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {!loading && me ? (
        <div className={styles.success}>
          Authenticated as <span className={styles.mono}>{me.userId}</span>.{" "}
          <Link href="/select-tenant">Select tenant</Link> or <Link href="/">go to dashboard</Link>.
        </div>
      ) : null}

      <div className={styles.panel}>
        <h2>Dev principal (local)</h2>
        <p className={styles.muted}>
          Stored in browser local storage and sent as{" "}
          <code>x-forge-dev-principal</code> on each request.
        </p>
        {parsedEnv ? (
          <p className={styles.muted}>
            Build-time default: user <span className={styles.mono}>{parsedEnv.userId}</span>, tenant{" "}
            <span className={styles.mono}>{parsedEnv.tenantId}</span>
          </p>
        ) : null}
        <form className={styles.form} onSubmit={onDevLogin}>
          <div className={styles.formRow}>
            <label htmlFor="userId">User ID</label>
            <input
              id="userId"
              required
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="UUID"
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="tenantId">Tenant ID</label>
            <input
              id="tenantId"
              required
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="UUID"
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in with dev principal"}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.panel}>
        <h2>Cognito (shell)</h2>
        <p className={styles.muted}>
          Paste an access token from your Cognito hosted UI or SDK flow. The console sends it as an
          Authorization bearer header.
        </p>
        <form className={styles.form} onSubmit={onCognitoLogin}>
          <div className={styles.formRow}>
            <label htmlFor="bearerToken">Access token</label>
            <textarea
              id="bearerToken"
              rows={3}
              value={bearerToken}
              onChange={(event) => setBearerTokenValue(event.target.value)}
              placeholder="eyJhbGciOi…"
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.buttonSecondary} type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in with bearer token"}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.buttonSecondary} onClick={onClearSession}>
          Clear local session
        </button>
      </div>
    </section>
  );
}
