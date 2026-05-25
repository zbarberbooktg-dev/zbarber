import { useState } from "react";
import { Link } from "wouter";
import { Search, Plus, Check, X, ChevronRight } from "lucide-react";
import { useListBarbers, useApproveBarber, useRejectBarber, getListBarbersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";

export default function Barbers() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = { page: String(page), limit: "15", search, ...(status ? { status } : {}) };
  const { data, isLoading } = useListBarbers(params);
  const approve = useApproveBarber();
  const reject = useRejectBarber();

  function handleApprove(id: number) {
    approve.mutate({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListBarbersQueryKey() }); toast({ title: "Barbier approuvé" }); },
    });
  }

  function handleReject(id: number) {
    reject.mutate({ id, data: { reason: "Non conforme aux standards" } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListBarbersQueryKey() }); toast({ title: "Barbier rejeté" }); },
    });
  }

  const barbers = (data as any)?.data ?? [];
  const total = (data as any)?.total ?? 0;

  return (
    <div>
      <PageHeader title="Barbiers" subtitle={`${total} barbiers sur la plateforme`} />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher..."
            className="w-full rounded-lg border bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvés</option>
          <option value="rejected">Rejetés</option>
          <option value="suspended">Suspendus</option>
        </select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Salon</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ville</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Note</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vues</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</td></tr>
            )}
            {!isLoading && barbers.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Aucun barbier trouvé</td></tr>
            )}
            {barbers.map((b: any) => (
              <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                      {b.salonName?.[0]}
                    </div>
                    <div>
                      <p className="font-medium">{b.salonName}</p>
                      <p className="text-xs text-muted-foreground">{b.ownerName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{b.city}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3">
                  <span className="text-primary font-semibold">{b.rating?.toFixed(1) ?? "—"}</span>
                  <span className="text-muted-foreground text-xs"> ({b.reviewCount})</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{b.profileViews}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    {b.status === "pending" && (
                      <>
                        <button onClick={() => handleApprove(b.id)} className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors" title="Approuver">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleReject(b.id)} className="p-1.5 rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors" title="Rejeter">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <Link href={`/barbers/${b.id}`}>
                      <a className="p-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </a>
                    </Link>
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
