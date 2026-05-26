import { useState } from "react";
import { Search, UserX, UserCheck } from "lucide-react";
import { useListUsers, useSuspendUser, useActivateUser, useUpdateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";

export default function Users() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, locale } = useT();
  const u = t.users;

  const params = { page: String(page), limit: "15", search, ...(role ? { role } : {}) };
  const { data, isLoading } = useListUsers(params as any);
  const suspend = useSuspendUser();
  const activate = useActivateUser();
  const updateUser = useUpdateUser();

  const users = (data as any)?.data ?? [];
  const total = (data as any)?.total ?? 0;

  const invalidate = () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() });

  function handleRoleChange(id: number, newRole: string) {
    updateUser.mutate({ id, data: { role: newRole as any } }, {
      onSuccess: () => { invalidate(); toast({ title: u.role_updated_toast }); },
    });
  }

  return (
    <div>
      <PageHeader title={u.title} subtitle={u.countSuffix(total)} />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={u.searchPh}
            className="w-full rounded-lg border bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={role}
          onChange={e => { setRole(e.target.value); setPage(1); }}
          className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{u.allRoles}</option>
          <option value="client">{u.clients}</option>
          <option value="barber">{u.barbers}</option>
          <option value="admin">{u.admins}</option>
        </select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{u.colUser}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{u.colRole}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{u.colStatus}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{u.colPhone}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{u.colCreated}</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t.common.loading}</td></tr>}
            {!isLoading && users.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{u.empty}</td></tr>}
            {users.map((row: any) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold shrink-0">
                      {row.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={row.role}
                    onChange={e => handleRoleChange(row.id, e.target.value)}
                    disabled={updateUser.isPending}
                    title={u.changeRole}
                    className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="client">{t.statuses.client}</option>
                    <option value="barber">{t.statuses.barber}</option>
                    <option value="admin">{t.statuses.admin}</option>
                  </select>
                </td>
                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{row.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(row.createdAt).toLocaleDateString(locale)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    {row.status === "active" ? (
                      <button
                        onClick={() => suspend.mutate({ id: row.id }, { onSuccess: () => { invalidate(); toast({ title: u.suspended_toast }); } })}
                        className="flex items-center gap-1.5 rounded-md bg-red-500/10 text-red-600 px-2.5 py-1.5 text-xs hover:bg-red-500/20 transition-colors"
                      >
                        <UserX className="h-3.5 w-3.5" /> {u.suspend}
                      </button>
                    ) : (
                      <button
                        onClick={() => activate.mutate({ id: row.id }, { onSuccess: () => { invalidate(); toast({ title: u.activated_toast }); } })}
                        className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 text-emerald-600 px-2.5 py-1.5 text-xs hover:bg-emerald-500/20 transition-colors"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> {u.activate}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 15 && (
        <div className="flex justify-end gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">{t.common.prev}</button>
          <span className="rounded-lg border px-3 py-1.5 text-sm">{page}</span>
          <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">{t.common.next}</button>
        </div>
      )}
    </div>
  );
}
