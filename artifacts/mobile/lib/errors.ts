import type { translations } from "@/constants/i18n";

type ErrorsDict = (typeof translations)["fr"]["errors"];

const SERVER_TO_KEY: Record<string, keyof ErrorsDict> = {
  "Unauthorized": "unauthorized",
  "Forbidden": "forbidden",
  "Invalid input": "invalidInput",
  "Invalid role": "invalidInput",
  "Unknown country": "unknownCountry",
  "Barber account required": "barberAccountRequired",
  "Barber profile not created": "barberProfileMissing",
  "Barber not approved": "barberNotApproved",
  "Create a barber profile first": "noBarberProfile",
  "Admins cannot switch role": "adminCannotSwitch",
  "Admins cannot own salons": "adminCannotOwnSalons",
  "No barber profile. Create one before switching role.": "noBarberProfile",
};

/**
 * Turn an arbitrary error (raw JSON body from useAuthedFetch, Error, string, etc.)
 * into a user-friendly localized message. Falls back to a generic message
 * instead of leaking JSON or stack traces to the UI.
 */
export function formatApiError(err: unknown, errors: ErrorsDict): string {
  const raw = extractRawMessage(err);
  if (!raw) return errors.generic;

  // Try to parse a JSON error body like {"error":"..."}
  const parsed = tryParseError(raw);
  const serverMsg = parsed ?? raw;

  // Map known server strings to translated copy.
  const key = SERVER_TO_KEY[serverMsg.trim()];
  if (key) return errors[key];

  // Network-ish errors
  if (/network|fetch|failed to fetch|timeout/i.test(serverMsg)) return errors.network;

  // If the server returned a short, plain string (no JSON braces, not too long),
  // show it as-is. Otherwise, fall back to generic to avoid leaking JSON.
  if (
    !serverMsg.includes("{") &&
    !serverMsg.includes("}") &&
    serverMsg.length <= 160
  ) {
    return serverMsg;
  }
  return errors.generic;
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
    // not valid JSON — leave caller to handle
  }
  return null;
}
