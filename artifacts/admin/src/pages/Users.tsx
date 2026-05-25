import { useState } from "react";
import { Search, UserX, UserCheck } from "lucide-react";
import { useListUsers, useSuspendUser, useActivateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";

export default function Users() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = { page: String(page), limit: "15", search, ...(role ? { role } : {}) };
  const { data, isLoading } = useListUsers(params);
  const suspend = useSuspendUser();
  const activate = useActivateUser();

  const users = (data as any)?.data ?? [];
  const total = (data as any)?.total ?? 0;

  return (
    <div>
      <PageHeader title="Utilisateurs" subtitle={`${total} utilisateurs inscrits`} />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Nom ou email..."
            className="w-full rounded-lg border bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={role}
          onChange={e => { setRole(e.target.value); setPage(1); }}
          className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les rôles</option>
          <option value="client">Clients</option>
          <option value="barber">Barbiers</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Utilisateur</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rôle</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Téléphone</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Inscrit le</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</td></tr>}
            {!isLoading && users.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Aucun utilisateur</td></tr>}
            {users.map((u: any) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold shrink-0">
                      {u.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><StatusBadge status={u.role} /></td>
                <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{u.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("fr")}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    {u.status === "active" ? (
                      <button
                        onClick={() => suspend.mutate({ id: u.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListUsersQueryKey() }); toast({ title: "Utilisateur suspendu" }); } })}
                        className="flex items-center gap-1.5 rounded-md bg-red-500/10 text-red-600 px-2.5 py-1.5 text-xs hover:bg-red-500/20 transition-colors"
                      >
                        <UserX className="h-3.5 w-3.5" /> Suspendre
                      </button>
                    ) : (
                      <button
                        onClick={() => activate.mutate({ id: u.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListUsersQueryKey() }); toast({ title: "Utilisateur activé" }); } })}
                        className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 text-emerald-600 px-2.5 py-1.5 text-xs hover:bg-emerald-500/20 transition-colors"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Activer
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
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Précédent</button>
          <span className="rounded-lg border px-3 py-1.5 text-sm">{page}</span>
          <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Suivant</button>
        </div>
      )}
    </div>
  );
}
