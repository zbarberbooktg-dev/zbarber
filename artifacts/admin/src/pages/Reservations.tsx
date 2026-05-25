import { useState } from "react";
import { Check, X, Clock } from "lucide-react";
import { useListReservations, useUpdateReservationStatus, getListReservationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";

export default function Reservations() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = { page: String(page), limit: "15", ...(status ? { status } : {}) };
  const { data, isLoading } = useListReservations(params);
  const updateStatus = useUpdateReservationStatus();

  function handle(id: number, newStatus: string) {
    updateStatus.mutate({ id, data: { status: newStatus as any } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListReservationsQueryKey() }); toast({ title: "Statut mis à jour" }); },
    });
  }

  const reservations = (data as any)?.data ?? [];
  const total = (data as any)?.total ?? 0;

  return (
    <div>
      <PageHeader title="Réservations" subtitle={`${total} réservations au total`} />

      <div className="flex gap-3 mb-5">
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmées</option>
          <option value="completed">Terminées</option>
          <option value="cancelled">Annulées</option>
        </select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Barbier</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Service</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</td></tr>}
            {!isLoading && reservations.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Aucune réservation</td></tr>}
            {reservations.map((r: any) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">#{r.id}</td>
                <td className="px-4 py-3 font-medium">{r.clientName ?? `Client #${r.clientId}`}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.barberName ?? `Barbier #${r.barberId}`}</td>
                <td className="px-4 py-3">
                  <div>
                    <p>{r.serviceName}</p>
                    {r.servicePrice && <p className="text-xs text-primary font-semibold">{r.servicePrice?.toLocaleString()} F</p>}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.scheduledAt).toLocaleDateString("fr", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    {r.status === "pending" && (
                      <>
                        <button onClick={() => handle(r.id, "confirmed")} className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors" title="Confirmer">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handle(r.id, "cancelled")} className="p-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors" title="Annuler">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {r.status === "confirmed" && (
                      <button onClick={() => handle(r.id, "completed")} className="p-1.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors" title="Terminer">
                        <Clock className="h-3.5 w-3.5" />
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
