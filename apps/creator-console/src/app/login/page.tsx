"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  InvalidAccessTokenError,
  parseDevPrincipal,
  setBearerToken,
  setDevPrincipal,
  useAuth,
} from "@forge/web-kit";
import styles from "../page.module.css";

const allowDevPrincipal = process.env.NEXT_PUBLIC_ALLOW_DEV_PRINCIPAL === "true";

export default function LoginPage() {
  const router = useRouter();
  const { refresh, me, loading, error: authError, loginWithCognito } = useAuth();
  const [userId, setUserId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [bearerToken, setBearerTokenValue] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onDevLogin(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      setDevPrincipal({ userId: userId.trim(), tenantId: tenantId.trim() });
      await refresh();
      router.push("/select-tenant/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onTokenLogin(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      setBearerToken(bearerToken.trim());
      await refresh();
      router.push("/select-tenant/");
    } catch (err) {
      if (err instanceof InvalidAccessTokenError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onCognitoLogin() {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithCognito();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Redirect to Cognito failed");
      setSubmitting(false);
    }
  }

  const envPrincipal = allowDevPrincipal ? process.env.NEXT_PUBLIC_DEV_PRINCIPAL : undefined;
  const parsedEnv = envPrincipal ? parseDevPrincipal(envPrincipal) : null;

  return (
    <section className={styles.page}>
      <h1>Forge Creator Console</h1>
      <p className={styles.lead}>
        Sign in with your Forge account. Deployed environments use Cognito Hosted UI (email and
        password on Cognito).
      </p>

      {authError ? <p className={styles.error}>{authError}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {!loading && me ? (
        <div className={styles.success}>
          Authenticated as <span className={styles.mono}>{me.userId}</span>.{" "}
          <Link href="/select-tenant/">Select tenant</Link> or <Link href="/">go to dashboard</Link>
          .
        </div>
      ) : null}

      <div className={styles.panel}>
        <h2>Sign in</h2>
        <p className={styles.muted}>
          You will be redirected to Cognito to enter your email and password. The console stores
          only the Cognito <code>access_token</code> JWT — never JWKS public keys.
        </p>
        <button
          className={styles.button}
          type="button"
          disabled={submitting}
          onClick={() => void onCognitoLogin()}
        >
          {submitting ? "Redirecting…" : "Sign In"}
        </button>
      </div>

      {allowDevPrincipal ? (
        <div className={styles.panel}>
          <h2>Dev principal (local / emulator only)</h2>
          <p className={styles.muted}>
            Sends <code>x-forge-dev-principal</code>. Unavailable in deployed Creator Console
            builds.
          </p>
          {parsedEnv ? (
            <p className={styles.muted}>
              Build default: user <span className={styles.mono}>{parsedEnv.userId}</span>, tenant{" "}
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
              <button className={styles.buttonSecondary} type="submit" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in with dev principal"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {allowDevPrincipal ? (
        <div className={styles.panel}>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => setShowAdvanced((open) => !open)}
          >
            {showAdvanced ? "Hide advanced" : "Advanced (paste access token)"}
          </button>
          {showAdvanced ? (
            <form className={styles.form} onSubmit={onTokenLogin}>
              <div className={styles.formRow}>
                <label htmlFor="bearerToken">Access token (JWT only)</label>
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
                  Sign in with bearer token
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
