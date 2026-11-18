export * from "./generated/api";
export { useApprovedSalonCatalog } from "./salon-catalog";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter, setUnauthorizedHandler, ApiError } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
