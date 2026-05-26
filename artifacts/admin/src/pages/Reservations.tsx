import { useState } from "react";
import { Check, X, Clock } from "lucide-react";
import { useListReservations, useUpdateReservationStatus, getListReservationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";

export default function Reservations() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, locale } = useT();
  const r = t.reservations;

  const params = { page: String(page), limit: "15", ...(status ? { status } : {}) };
  const { data, isLoading } = useListReservations(params as any);
  const updateStatus = useUpdateReservationStatus();

  function handle(id: number, newStatus: string) {
    updateStatus.mutate({ id, data: { status: newStatus as any } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListReservationsQueryKey() }); toast({ title: r.status_toast }); },
    });
  }

  const reservations = (data as any)?.data ?? [];
  const total = (data as any)?.total ?? 0;

  return (
    <div>
      <PageHeader title={r.title} subtitle={r.countSuffix(total)} />

      <div className="flex gap-3 mb-5">
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t.common.allStatuses}</option>
          <option value="pending">{r.pending}</option>
          <option value="confirmed">{r.confirmed}</option>
          <option value="completed">{r.completed}</option>
          <option value="cancelled">{r.cancelled}</option>
        </select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{r.colClient}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{r.colBarber}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{r.colService}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{r.colDate}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{r.colStatus}</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">{t.common.loading}</td></tr>}
            {!isLoading && reservations.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">{r.empty}</td></tr>}
            {reservations.map((row: any) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">#{row.id}</td>
                <td className="px-4 py-3 font-medium">{row.clientName ?? `${r.clientShort}${row.clientId}`}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.barberName ?? `${r.barberShort}${row.barberId}`}</td>
                <td className="px-4 py-3">
                  <div>
                    <p>{row.serviceName}</p>
                    {row.servicePrice && <p className="text-xs text-primary font-semibold">{row.servicePrice?.toLocaleString()} F</p>}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(row.scheduledAt).toLocaleDateString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    {row.status === "pending" && (
                      <>
                        <button onClick={() => handle(row.id, "confirmed")} className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors" title={r.confirmTitle}>
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handle(row.id, "cancelled")} className="p-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors" title={r.cancelTitle}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {row.status === "confirmed" && (
                      <button onClick={() => handle(row.id, "completed")} className="p-1.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors" title={r.completeTitle}>
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
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">{t.common.prev}</button>
          <span className="rounded-lg border px-3 py-1.5 text-sm">{page}</span>
          <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">{t.common.next}</button>
        </div>
      )}
    </div>
  );
}
