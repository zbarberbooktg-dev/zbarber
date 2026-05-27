import { translations } from "@/lib/i18n";

type ErrorsDict = { readonly [K in keyof (typeof translations)["fr"]["errors"]]: string };

const SERVER_TO_KEY: Record<string, keyof ErrorsDict> = {
  "Unauthorized": "unauthorized",
  "Forbidden": "forbidden",
  "Admin access required": "forbidden",
  "Invalid input": "invalidInput",
  "Invalid role": "invalidInput",
  "Invalid status": "invalidInput",
  "Not found": "notFound",
  "Barber not found": "notFound",
  "User not found": "notFound",
  "Plan not found": "notFound",
  "Subscription not found": "notFound",
  "Conflict": "conflict",
  "Already approved": "conflict",
  "Already exists": "conflict",
};

/**
 * Turn an arbitrary error (ApiError from generated client, raw Error, JSON
 * blob, string, etc.) into a user-friendly localized message. Falls back
 * to a generic message instead of leaking JSON, HTTP prefixes, or stack
 * traces to the UI.
 */
export function formatApiError(err: unknown, errors: ErrorsDict): string {
  // 1) Generated client throws ApiError with a parsed `data` field — use it first.
  const dataMsg = extractFromApiErrorData(err);
  if (dataMsg) {
    const key = SERVER_TO_KEY[dataMsg.trim()];
    if (key) return errors[key];
    if (isShortPlainString(dataMsg)) return dataMsg;
  }

  // 2) Fallback: parse the error message itself (raw fetch errors / authApi).
  const raw = extractRawMessage(err);
  if (!raw) return errors.generic;

  // Strip an "HTTP 401 Unauthorized: ..." prefix added by customFetch.
  const stripped = raw.replace(/^HTTP \d+[^:]*:\s*/, "").trim();

  const parsed = tryParseError(stripped) ?? stripped;
  const key = SERVER_TO_KEY[parsed.trim()];
  if (key) return errors[key];

  if (/network|fetch|failed to fetch|timeout/i.test(parsed)) return errors.network;

  if (isShortPlainString(parsed)) return parsed;
  return errors.generic;
}

function isShortPlainString(s: string): boolean {
  return !s.includes("{") && !s.includes("}") && s.length > 0 && s.length <= 160;
}

function extractFromApiErrorData(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const data = (err as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
  if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
  if (typeof obj.detail === "string" && obj.detail.trim()) return obj.detail;
  return null;
}

function extractRawMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message ?? "";
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : "";
  }
  return "";
}

function tryParseError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj === "object") {
      if (typeof obj.error === "string") return obj.error;
      if (typeof obj.message === "string") return obj.message;
    }
  } catch {
    // not valid JSON
  }
  return null;
}
