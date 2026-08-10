export {
  configureApiClient,
  getApiBaseUrl,
  getApiClientConfig,
  apiGet,
  apiGetResult,
  apiSend,
  apiSendResult,
  apiFetchRaw,
  toIfMatch,
  createIdempotencyKey,
  ApiError,
  ApiConflictError,
  type ApiSuccess,
  type ApiRequestOptions,
  type ApiResult,
  type ApiClientConfig,
} from "./api-client.js";

export {
  assertAccessTokenShape,
  InvalidAccessTokenError,
} from "./access-token.js";

export {
  getDevPrincipal,
  setDevPrincipal,
  clearDevPrincipal,
  getBearerToken,
  setBearerToken,
  clearBearerToken,
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
  getActiveTenantId,
  setActiveTenantId,
  clearActiveTenantId,
  clearAuthStorage,
  parseDevPrincipal,
  type DevPrincipal,
} from "./auth-storage.js";

export {
  authMe,
  selectTenant,
  logoutAll,
  listEffectiveFeatures,
  type AuthMe,
  type AuthTenant,
  type EffectiveFeature,
} from "./auth-api.js";

export { switchActiveTenant } from "./tenant-switch.js";

export {
  buildAuthorizeUrl,
  buildLogoutUrl,
  CognitoOAuthError,
  exchangeCodeForTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  getCognitoOAuthConfig,
  redirectToCognitoLogin,
  refreshAccessToken,
  validateOAuthState,
  type CognitoOAuthConfig,
  type CognitoTokenResponse,
} from "./cognito-oauth.js";

export { AuthProvider, useAuth, usePermission, type AuthContextValue } from "./auth-provider.js";

export { useFeatureFlag, useFeatureFlags } from "./use-feature-flags.js";

export {
  paginate,
  filterBySearch,
  sortByField,
  totalPages,
  pageRange,
  buildListQuery,
  useServerListControls,
  ListControlsView,
  type PaginationMeta,
  type ServerListQuery,
  type ServerListState,
  type ListControlsProps,
  type ListControlsClassNames,
} from "./list-controls.js";
