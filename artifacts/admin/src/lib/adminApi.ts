export interface AdminAccount {
  id: number;
  email: string;
  name: string;
  isRoot: boolean;
  mustChangePassword: boolean;
  status: "active" | "suspended";
  invitedByAdminId: number | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

async function parseError(res: Response, fallback: string): Promise<AdminApiError> {
  let body = "";
  try { body = await res.text(); } catch { /* ignore */ }
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      const msg =
        (obj && typeof obj.error === "string" && obj.error) ||
        (obj && typeof obj.message === "string" && obj.message) ||
        "";
      if (msg) return new AdminApiError(msg, res.status);
    } catch { /* fall through */ }
  }
  return new AdminApiError(`${fallback} (${res.status})`, res.status);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!res.ok) throw await parseError(res, "Request failed");
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function adminLogin(email: string, password: string): Promise<{ admin: AdminAccount }> {
  return request("/admin-auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function adminLogout(): Promise<void> {
  await request("/admin-auth/logout", { method: "POST" });
}

export async function adminMe(): Promise<{ admin: AdminAccount }> {
  return request("/admin-auth/me");
}

export async function adminChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request("/admin-auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function adminListAdmins(): Promise<AdminAccount[]> {
  return request("/admin-auth/admins");
}

export interface InviteResponse {
  admin: AdminAccount;
  emailDelivered: boolean;
  smtpConfigured: boolean;
  tempPassword?: string;
}

export async function adminInvite(email: string, name: string): Promise<InviteResponse> {
  return request("/admin-auth/invite", { method: "POST", body: JSON.stringify({ email, name }) });
}

export async function adminSuspend(id: number): Promise<AdminAccount> {
  return request(`/admin-auth/admins/${id}/suspend`, { method: "PATCH" });
}

export async function adminReactivate(id: number): Promise<AdminAccount> {
  return request(`/admin-auth/admins/${id}/reactivate`, { method: "PATCH" });
}

export async function adminDelete(id: number): Promise<void> {
  await request(`/admin-auth/admins/${id}`, { method: "DELETE" });
}
