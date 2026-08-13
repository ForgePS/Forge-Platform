import { ApiError } from "@forge/web-kit";

export type FriendlyErrorResult = {
  message: string;
  technicalDetail?: string;
};

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

function isNetworkFailure(err: unknown, msg: string): boolean {
  if (typeof msg === "string" && /failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return true;
  }
  return err instanceof TypeError && /fetch/i.test(msg);
}

function isUnauthorized(err: unknown, msg: string): boolean {
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return true;
  return /unauthorized|forbidden|not authorized|access denied|permission/i.test(msg);
}

function isNotFoundOrUnsupported(err: unknown, msg: string): boolean {
  if (err instanceof ApiError && (err.status === 404 || err.status === 501)) return true;
  return /not found|not implemented|501|404/i.test(msg);
}

function withDetail(message: string, technical: string): FriendlyErrorResult {
  if (technical) return { message, technicalDetail: technical };
  return { message };
}

function mapCore(err: unknown, fallback: string): FriendlyErrorResult {
  const technical = rawMessage(err);

  if (isUnauthorized(err, technical)) {
    return withDetail("You don't have access to this module.", technical);
  }

  if (isNetworkFailure(err, technical)) {
    return withDetail(
      "We couldn't reach the server. Check your connection and try again.",
      technical,
    );
  }

  if (err instanceof ApiError) {
    return withDetail(fallback, technical);
  }

  if (technical && /failed to fetch/i.test(technical)) {
    return withDetail(
      "We couldn't reach the server. Check your connection and try again.",
      technical,
    );
  }

  return withDetail(fallback, technical);
}

/** Customer-facing load/list error copy. Technical detail via explainFriendlyError. */
export function friendlyLoadError(
  err: unknown,
  fallback = "We couldn't load this information.",
): string {
  return mapCore(err, fallback).message;
}

/** Customer-facing create/update/action error copy. */
export function friendlyActionError(
  err: unknown,
  fallback = "We couldn't save your changes.",
): string {
  return mapCore(err, fallback).message;
}

/** Full result including optional technical detail for advanced/debug UI. */
export function explainFriendlyError(
  err: unknown,
  fallback = "We couldn't load this information.",
): FriendlyErrorResult {
  return mapCore(err, fallback);
}

/** True when the API indicates the backend route is missing or not implemented. */
export function isBackendUnavailableError(err: unknown): boolean {
  return isNotFoundOrUnsupported(err, rawMessage(err));
}
