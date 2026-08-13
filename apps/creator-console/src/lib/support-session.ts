export type SupportSession = {
  customerId: string;
  customerName: string;
  product: string;
  reason: string;
  startedAt: string;
  startedBy: string;
};

export const SUPPORT_SESSION_KEY = "forge.supportSession";
export const SUPPORT_SESSION_EVENT = "forge.supportSession.change";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function getSupportSession(): SupportSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(SUPPORT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupportSession;
    if (!parsed?.customerId || !parsed?.customerName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSupportSession(session: SupportSession): void {
  if (!canUseStorage()) return;
  sessionStorage.setItem(SUPPORT_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SUPPORT_SESSION_EVENT));
}

export function clearSupportSession(): void {
  if (!canUseStorage()) return;
  sessionStorage.removeItem(SUPPORT_SESSION_KEY);
  window.dispatchEvent(new Event(SUPPORT_SESSION_EVENT));
}

/** Subscribe to support session changes (same tab + storage events). */
export function listenSupportSession(onChange: (session: SupportSession | null) => void): () => void {
  if (!canUseStorage()) return () => undefined;

  const emit = () => onChange(getSupportSession());
  const onCustom = () => emit();
  const onStorage = (event: StorageEvent) => {
    if (event.key === SUPPORT_SESSION_KEY || event.key === null) emit();
  };

  window.addEventListener(SUPPORT_SESSION_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SUPPORT_SESSION_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
