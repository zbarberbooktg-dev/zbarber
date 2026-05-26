import { useState } from "react";
import { Link } from "wouter";
import { Search, Check, X, ChevronRight } from "lucide-react";
import { useListBarbers, useApproveBarber, useRejectBarber, getListBarbersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";

export default function Barbers() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useT();
  const b = t.barbers;

  const params = { page: String(page), limit: "15", search, ...(status ? { status } : {}) };
  const { data, isLoading } = useListBarbers(params as any);
  const approve = useApproveBarber();
  const reject = useRejectBarber();

  function handleApprove(id: number) {
    approve.mutate({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListBarbersQueryKey() }); toast({ title: b.approved_toast }); },
    });
  }

  function handleReject(id: number) {
    reject.mutate({ id, data: { reason: b.rejectReason } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListBarbersQueryKey() }); toast({ title: b.rejected_toast }); },
    });
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
                        <button onClick={() => handleReject(row.id)} className="p-1.5 rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors" title={b.rejectTitle}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
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
    </div>
  );
}
