import { useState } from "react";
import { Trash2, Check, Plus, Pencil } from "lucide-react";
import { useListSubscriptionPlans, useListSubscriptions, useCreateSubscriptionPlan, useUpdateSubscriptionPlan, useDeleteSubscriptionPlan, getListSubscriptionPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";

type PlanForm = {
  id?: number;
  name: string;
  price: string;
  billingCycle: "monthly" | "yearly";
  description: string;
  featuresText: string;
  hasAnalytics: boolean;
  hasPriority: boolean;
  hasFinancing: boolean;
  hasConferences: boolean;
};

const emptyForm: PlanForm = {
  name: "",
  price: "",
  billingCycle: "monthly",
  description: "",
  featuresText: "",
  hasAnalytics: false,
  hasPriority: false,
  hasFinancing: false,
  hasConferences: false,
};

export default function Subscriptions() {
  const [tab, setTab] = useState<"plans" | "subs">("subs");
  const [editing, setEditing] = useState<PlanForm | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, locale } = useT();
  const s = t.subscriptions;

  const { data: plans } = useListSubscriptionPlans();
  const { data: subsData } = useListSubscriptions({});
  const createPlan = useCreateSubscriptionPlan();
  const updatePlan = useUpdateSubscriptionPlan();
  const deletePlan = useDeleteSubscriptionPlan();

  const subs = (subsData as any)?.data ?? [];
  const plansList = (plans as any) ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: getListSubscriptionPlansQueryKey() });

  function handleDelete(id: number) {
    if (!confirm(s.confirmDelete)) return;
    deletePlan.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: s.deleted_toast }); } });
  }

  function openCreate() { setEditing({ ...emptyForm }); }
  function openEdit(p: any) {
    setEditing({
      id: p.id,
      name: p.name ?? "",
      price: String(p.price ?? ""),
      billingCycle: p.billingCycle ?? "monthly",
      description: p.description ?? "",
      featuresText: (p.features ?? []).join("\n"),
      hasAnalytics: !!p.hasAnalytics,
      hasPriority: !!p.hasPriority,
      hasFinancing: !!p.hasFinancing,
      hasConferences: !!p.hasConferences,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const features = editing.featuresText.split("\n").map(l => l.trim()).filter(Boolean);
    const payload = {
      name: editing.name.trim(),
      price: parseFloat(editing.price) || 0,
      billingCycle: editing.billingCycle,
      description: editing.description.trim() || undefined,
      features,
      hasAnalytics: editing.hasAnalytics,
      hasPriority: editing.hasPriority,
      hasFinancing: editing.hasFinancing,
      hasConferences: editing.hasConferences,
    };
    if (editing.id) {
      updatePlan.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { invalidate(); toast({ title: s.updated_toast }); setEditing(null); },
      });
    } else {
      createPlan.mutate({ data: payload }, {
        onSuccess: () => { invalidate(); toast({ title: s.created_toast }); setEditing(null); },
      });
    }
  }

  return (
    <div>
      <PageHeader title={s.title} subtitle={s.subtitle} />

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {(["subs", "plans"] as const).map(tabKey => (
            <button key={tabKey} onClick={() => setTab(tabKey)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tabKey ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}>
              {tabKey === "subs" ? s.tabSubs : s.tabPlans}
            </button>
          ))}
        </div>
        {tab === "plans" && (
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> {s.newPlan}
          </button>
        )}
      </div>

      {tab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plansList.map((p: any) => (
            <div key={p.id} className="rounded-xl border bg-card p-5 relative">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base">{p.name}</h3>
                <div className="flex gap-1.5">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded bg-muted hover:bg-muted/80 transition-colors" title={s.editPlan}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
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

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} className="bg-card rounded-xl border w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">{editing.id ? s.editPlan : s.newPlan}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm space-y-1 col-span-2">
                <span className="text-muted-foreground">{s.fieldName}</span>
                <input required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">{s.fieldPrice}</span>
                <input required type="number" min="0" step="100" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">{s.fieldCycle}</span>
                <select value={editing.billingCycle} onChange={e => setEditing({ ...editing, billingCycle: e.target.value as "monthly" | "yearly" })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="monthly">{s.monthly}</option>
                  <option value="yearly">{s.yearly}</option>
                </select>
              </label>
              <label className="text-sm space-y-1 col-span-2">
                <span className="text-muted-foreground">{s.fieldDescription}</span>
                <input value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="text-sm space-y-1 col-span-2">
                <span className="text-muted-foreground">{s.fieldFeatures}</span>
                <textarea rows={4} value={editing.featuresText} onChange={e => setEditing({ ...editing, featuresText: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                {([
                  ["hasAnalytics", s.analytics],
                  ["hasPriority", s.priority],
                  ["hasFinancing", s.financing],
                  ["hasConferences", s.conferences],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(editing as any)[key]} onChange={e => setEditing({ ...editing, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">{s.cancel}</button>
              <button type="submit" disabled={createPlan.isPending || updatePlan.isPending} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">{s.save}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
