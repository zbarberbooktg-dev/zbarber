import { useState } from "react";
import { Trash2, Check } from "lucide-react";
import { useListSubscriptionPlans, useListSubscriptions, useDeleteSubscriptionPlan, getListSubscriptionPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";

export default function Subscriptions() {
  const [tab, setTab] = useState<"plans" | "subs">("subs");
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, locale } = useT();
  const s = t.subscriptions;

  const { data: plans } = useListSubscriptionPlans();
  const { data: subsData } = useListSubscriptions({});
  const deletePlan = useDeleteSubscriptionPlan();

  const subs = (subsData as any)?.data ?? [];
  const plansList = (plans as any) ?? [];

  function handleDelete(id: number) {
    if (!confirm(s.confirmDelete)) return;
    deletePlan.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListSubscriptionPlansQueryKey() }); toast({ title: s.deleted_toast }); } });
  }

  return (
    <div>
      <PageHeader title={s.title} subtitle={s.subtitle} />

      <div className="flex gap-2 mb-6">
        {(["subs", "plans"] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tabKey ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}>
            {tabKey === "subs" ? s.tabSubs : s.tabPlans}
          </button>
        ))}
      </div>

      {tab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plansList.map((p: any) => (
            <div key={p.id} className="rounded-xl border bg-card p-5 relative">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base">{p.name}</h3>
                <div className="flex gap-1.5">
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-2xl font-bold text-primary mb-1">{p.price?.toLocaleString()} <span className="text-sm text-muted-foreground font-normal">F/{p.billingCycle === "monthly" ? s.perMonth : s.perYear}</span></p>
              <p className="text-xs text-muted-foreground mb-4">{p.description}</p>
              <ul className="space-y-1.5">
                {(p.features ?? []).map((f: string) => (
                  <li key={f} className="flex items-center gap-2 text-xs">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.hasAnalytics && <span className="text-xs bg-blue-500/10 text-blue-600 rounded px-2 py-0.5">{s.analytics}</span>}
                {p.hasPriority && <span className="text-xs bg-amber-500/10 text-amber-600 rounded px-2 py-0.5">{s.priority}</span>}
                {p.hasFinancing && <span className="text-xs bg-emerald-500/10 text-emerald-600 rounded px-2 py-0.5">{s.financing}</span>}
                {p.hasConferences && <span className="text-xs bg-purple-500/10 text-purple-600 rounded px-2 py-0.5">{s.conferences}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "subs" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{s.colBarber}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{s.colPlan}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{s.colStatus}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{s.colPayment}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{s.colExpiry}</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">{s.empty}</td></tr>}
              {subs.map((row: any) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.barberName ?? `${s.barberShort}${row.barberId}`}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5 font-medium">{row.planName}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{row.paymentMethod ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(row.endDate).toLocaleDateString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
