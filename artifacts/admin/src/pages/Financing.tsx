import { useState } from "react";
import { useListFinancingRequests, useUpdateFinancingStatus, getListFinancingRequestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";

export default function Financing() {
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, locale } = useT();
  const f = t.financing;

  const params = { page: "1", limit: "20", ...(status ? { status } : {}) };
  const { data, isLoading } = useListFinancingRequests(params as any);
  const update = useUpdateFinancingStatus();

  const requests = (data as any)?.data ?? [];
  const total = (data as any)?.total ?? 0;

  function handle(id: number, newStatus: string) {
    update.mutate({ id, data: { status: newStatus as any, adminNote: note || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFinancingRequestsQueryKey() });
        toast({ title: f.status_toast });
        setSelected(null);
        setNote("");
      },
    });
  }

  return (
    <div>
      <PageHeader title={f.title} subtitle={f.countSuffix(total)} />

      <div className="flex gap-3 mb-5">
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t.common.allStatuses}</option>
          <option value="pending">{t.statuses.pending}</option>
          <option value="reviewing">{f.reviewing}</option>
          <option value="approved">{f.approved}</option>
          <option value="rejected">{f.rejected}</option>
        </select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{f.colBarber}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{f.colAmount}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{f.colPurpose}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{f.colStatus}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{f.colDate}</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t.common.loading}</td></tr>}
            {!isLoading && requests.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{f.empty}</td></tr>}
            {requests.map((r: any) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium">{r.barberName ?? `${f.barberShort}${r.barberId}`}</td>
                <td className="px-4 py-3 font-semibold text-primary">{r.amount?.toLocaleString()} F</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-secondary rounded px-2 py-0.5">
                    {f.purposes[r.purpose] ?? r.purpose}
                  </span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString(locale)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSelected(r)}
                      className="rounded-md bg-primary/10 text-primary px-2.5 py-1.5 text-xs hover:bg-primary/20 transition-colors"
                    >
                      {f.manage}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border w-full max-w-lg p-6 shadow-2xl">
            <h2 className="font-bold text-lg mb-1">{f.requestN}{selected.id}</h2>
            <p className="text-xs text-muted-foreground mb-5">{f.colBarber}: {selected.barberName}</p>
            <dl className="space-y-3 text-sm mb-5">
              <div className="flex gap-3">
                <dt className="text-muted-foreground w-28">{f.colAmount}</dt>
                <dd className="font-semibold text-primary">{selected.amount?.toLocaleString()} F CFA</dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-muted-foreground w-28">{f.colPurpose}</dt>
                <dd>{f.purposes[selected.purpose] ?? selected.purpose}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-muted-foreground w-28">Description</dt>
                <dd className="break-words">{selected.description}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-muted-foreground w-28">{f.currentStatus}</dt>
                <dd><StatusBadge status={selected.status} /></dd>
              </div>
              {selected.adminNote && (
                <div className="flex gap-3">
                  <dt className="text-muted-foreground w-28">{f.adminNote}</dt>
                  <dd>{selected.adminNote}</dd>
                </div>
              )}
            </dl>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={f.adminNotePh}
              className="w-full rounded-lg border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-4 resize-none"
              rows={3}
            />
            <div className="flex gap-2 flex-wrap">
              {selected.status !== "reviewing" && (
                <button onClick={() => handle(selected.id, "reviewing")} className="rounded-lg bg-blue-500/10 text-blue-600 px-3 py-2 text-sm hover:bg-blue-500/20 transition-colors">
                  {f.sendReviewing}
                </button>
              )}
              {selected.status !== "approved" && (
                <button onClick={() => handle(selected.id, "approved")} className="rounded-lg bg-emerald-500/10 text-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500/20 transition-colors">
                  {f.approve}
                </button>
              )}
              {selected.status !== "rejected" && (
                <button onClick={() => handle(selected.id, "rejected")} className="rounded-lg bg-red-500/10 text-red-600 px-3 py-2 text-sm hover:bg-red-500/20 transition-colors">
                  {f.reject}
                </button>
              )}
              <button
                onClick={() => { setSelected(null); setNote(""); }}
                className="ml-auto rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
