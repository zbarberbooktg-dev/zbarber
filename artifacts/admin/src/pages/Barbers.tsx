import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Search, Check, X, ChevronRight, Pause, Play } from "lucide-react";
import { useListBarbers, useApproveBarber, useRejectBarber, useSuspendBarber, useReactivateBarber, getListBarbersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { formatApiError } from "@/lib/errors";

type ModalState = { type: "reject" | "suspend"; id: number; salonName: string } | null;

export default function Barbers() {
  const searchStr = useSearch();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useT();
  const b = t.barbers;

  // Sync URL ?status= → state on mount + when URL changes
  useEffect(() => {
    const sp = new URLSearchParams(searchStr);
    const st = sp.get("status") ?? "";
    setStatus(st);
    setPage(1);
  }, [searchStr]);

  const params = { page: String(page), limit: "15", search, ...(status ? { status } : {}) };
  const { data, isLoading } = useListBarbers(params as any);
  const approve = useApproveBarber();
  const reject = useRejectBarber();
  const suspend = useSuspendBarber();
  const reactivate = useReactivateBarber();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListBarbersQueryKey() });
  const onErr = (err: unknown) => toast({ title: formatApiError(err, t.errors), variant: "destructive" as any });

  function handleApprove(id: number) {
    approve.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: b.approved_toast }); }, onError: onErr });
  }

  function openReject(id: number, salonName: string) { setModal({ type: "reject", id, salonName }); setReason(""); }
  function openSuspend(id: number, salonName: string) { setModal({ type: "suspend", id, salonName }); setReason(""); }
  function closeModal() { setModal(null); setReason(""); }

  function submitModal(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const r = reason.trim();
    if (modal.type === "reject") {
      if (!r) { toast({ title: b.reasonRequired, variant: "destructive" as any }); return; }
      reject.mutate({ id: modal.id, data: { reason: r } }, {
        onSuccess: () => { invalidate(); toast({ title: b.rejected_toast }); closeModal(); },
        onError: onErr,
      });
    } else {
      suspend.mutate({ id: modal.id, data: { reason: r || null } }, {
        onSuccess: () => { invalidate(); toast({ title: b.suspended_toast }); closeModal(); },
        onError: onErr,
      });
    }
  }

  function handleReactivate(id: number) {
    if (!confirm(b.confirmReactivate)) return;
    reactivate.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: b.reactivated_toast }); }, onError: onErr });
  }

  const barbers = (data as any)?.data ?? [];
  const total = (data as any)?.total ?? 0;

  return (
    <div>
      <PageHeader title={b.title} subtitle={b.countSuffix(total)} />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t.common.searchPh}
            className="w-full rounded-lg border bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t.common.allStatuses}</option>
          <option value="pending">{b.pending}</option>
          <option value="approved">{b.approved}</option>
          <option value="rejected">{b.rejected}</option>
          <option value="suspended">{b.suspended}</option>
        </select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{b.colSalon}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{b.colCity}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{b.colStatus}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{b.colRating}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{b.colViews}</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t.common.loading}</td></tr>
            )}
            {!isLoading && barbers.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{b.empty}</td></tr>
            )}
            {barbers.map((row: any) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                      {row.salonName?.[0]}
                    </div>
                    <div>
                      <p className="font-medium">{row.salonName}</p>
                      <p className="text-xs text-muted-foreground">{row.ownerName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.city}</td>
                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                <td className="px-4 py-3">
                  <span className="text-primary font-semibold">{row.rating?.toFixed(1) ?? "—"}</span>
                  <span className="text-muted-foreground text-xs"> ({row.reviewCount})</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.profileViews}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    {row.status === "pending" && (
                      <>
                        <button onClick={() => handleApprove(row.id)} className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors" title={b.approveTitle}>
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openReject(row.id, row.salonName)} className="p-1.5 rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors" title={b.rejectTitle}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {row.status === "approved" && (
                      <button onClick={() => openSuspend(row.id, row.salonName)} className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors" title={b.suspendTitle}>
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {(row.status === "suspended" || row.status === "rejected") && (
                      <button onClick={() => handleReactivate(row.id)} className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors" title={b.reactivateTitle}>
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <Link href={`/barbers/${row.id}`}>
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
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">{t.common.prev}</button>
          <span className="rounded-lg border px-3 py-1.5 text-sm">{page}</span>
          <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">{t.common.next}</button>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeModal}>
          <form onSubmit={submitModal} onClick={e => e.stopPropagation()} className="bg-card rounded-xl border w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold">{modal.type === "reject" ? b.rejectModalTitle : b.suspendModalTitle}</h2>
            <p className="text-sm text-muted-foreground">{modal.salonName}</p>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground">{modal.type === "reject" ? b.rejectReasonLabel : b.suspendReasonLabel}</span>
              <textarea
                rows={4}
                required={modal.type === "reject"}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={modal.type === "reject" ? b.rejectReasonPh : b.suspendReasonPh}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={closeModal} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">{t.common.cancel}</button>
              <button
                type="submit"
                disabled={reject.isPending || suspend.isPending}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${modal.type === "reject" ? "bg-red-500" : "bg-amber-500"}`}
              >
                {b.confirmAction}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
