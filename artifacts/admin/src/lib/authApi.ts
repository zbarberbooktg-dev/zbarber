export interface AuthMeResponse {
  user: {
    id: number;
    name: string;
    email: string;
    role: "client" | "barber" | "admin";
    status: "active" | "suspended" | "pending";
    phone: string | null;
    avatarUrl: string | null;
  };
  barber: unknown | null;
}

async function parseError(res: Response, fallback: string): Promise<Error> {
  let body = "";
  try {
    body = await res.text();
  } catch {
    // ignore
  }
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      const msg =
        (obj && typeof obj.error === "string" && obj.error) ||
        (obj && typeof obj.message === "string" && obj.message) ||
        "";
      if (msg) return new Error(msg);
    } catch {
      // fall through
    }
  }
  return new Error(`${fallback}: ${res.status}`);
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!res.ok) throw await parseError(res, "Auth failed");
  return res.json();
}

export async function syncAuth(role?: "client" | "barber"): Promise<AuthMeResponse> {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(role ? { role } : {}),
  });
  if (!res.ok) throw await parseError(res, "Sync failed");
  return res.json();
}
