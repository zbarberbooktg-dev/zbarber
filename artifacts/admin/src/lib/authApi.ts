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

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  return res.json();
}

export async function syncAuth(role?: "client" | "barber"): Promise<AuthMeResponse> {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(role ? { role } : {}),
  });
  if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
  return res.json();
}
