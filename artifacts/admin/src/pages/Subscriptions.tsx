import { useState } from "react";
import { Trash2, Check, Plus, Pencil, X, CalendarPlus, Repeat } from "lucide-react";
import {
  useListSubscriptionPlans, useListSubscriptions, useListBarbers,
  useCreateSubscriptionPlan, useUpdateSubscriptionPlan, useDeleteSubscriptionPlan,
  useCreateSubscription, useUpdateSubscription, useDeleteSubscription,
  getListSubscriptionPlansQueryKey, getListSubscriptionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { formatApiError } from "@/lib/errors";

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

const emptyPlanForm: PlanForm = {
  name: "", price: "", billingCycle: "monthly", description: "", featuresText: "",
  hasAnalytics: false, hasPriority: false, hasFinancing: false, hasConferences: false,
};

type AssignForm = { barberId: string; planId: string; endDate: string; paymentMethod: string };
type EditSubForm = { id: number; planId: string; status: "active" | "expired" | "cancelled"; endDate: string; paymentMethod: string };

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function Subscriptions() {
  const [tab, setTab] = useState<"plans" | "subs">("subs");
  const [editingPlan, setEditingPlan] = useState<PlanForm | null>(null);
  const [assignForm, setAssignForm] = useState<AssignForm | null>(null);
  const [editSub, setEditSub] = useState<EditSubForm | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, locale } = useT();
  const s = t.subscriptions;

  const { data: plans } = useListSubscriptionPlans();
  const { data: subsData } = useListSubscriptions({ limit: "100" } as any);
  const { data: barbersData } = useListBarbers({ status: "approved", limit: "200" } as any);
  const createPlan = useCreateSubscriptionPlan();
  const updatePlan = useUpdateSubscriptionPlan();
  const deletePlan = useDeleteSubscriptionPlan();
  const createSub = useCreateSubscription();
  const updateSub = useUpdateSubscription();
  const deleteSub = useDeleteSubscription();

  const subs = (subsData as any)?.data ?? [];
  const plansList = (plans as any) ?? [];
  const barbersList = (barbersData as any)?.data ?? [];

  const invalidatePlans = () => qc.invalidateQueries({ queryKey: getListSubscriptionPlansQueryKey() });
  const invalidateSubs = () => qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
  const onErr = (err: unknown) => toast({ title: formatApiError(err, t.errors), variant: "destructive" as any });

  function handleDeletePlan(id: number) {
    if (!confirm(s.confirmDelete)) return;
    deletePlan.mutate({ id }, { onSuccess: () => { invalidatePlans(); toast({ title: s.deleted_toast }); }, onError: onErr });
  }

  function openCreatePlan() { setEditingPlan({ ...emptyPlanForm }); }
  function openEditPlan(p: any) {
    setEditingPlan({
      id: p.id, name: p.name ?? "", price: String(p.price ?? ""),
      billingCycle: p.billingCycle ?? "monthly", description: p.description ?? "",
      featuresText: (p.features ?? []).join("\n"),
      hasAnalytics: !!p.hasAnalytics, hasPriority: !!p.hasPriority,
      hasFinancing: !!p.hasFinancing, hasConferences: !!p.hasConferences,
    });
  }

  function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan) return;
    const features = editingPlan.featuresText.split("\n").map(l => l.trim()).filter(Boolean);
    const payload = {
      name: editingPlan.name.trim(),
      price: parseFloat(editingPlan.price) || 0,
      billingCycle: editingPlan.billingCycle,
      description: editingPlan.description.trim() || undefined,
      features,
      hasAnalytics: editingPlan.hasAnalytics,
      hasPriority: editingPlan.hasPriority,
      hasFinancing: editingPlan.hasFinancing,
      hasConferences: editingPlan.hasConferences,
    };
    if (editingPlan.id) {
      updatePlan.mutate({ id: editingPlan.id, data: payload }, {
        onSuccess: () => { invalidatePlans(); toast({ title: s.updated_toast }); setEditingPlan(null); },
        onError: onErr,
      });
    } else {
      createPlan.mutate({ data: payload }, {
        onSuccess: () => { invalidatePlans(); toast({ title: s.created_toast }); setEditingPlan(null); },
        onError: onErr,
      });
    }
  }

  function openAssign() {
    const defaultEnd = new Date(); defaultEnd.setDate(defaultEnd.getDate() + 30);
    setAssignForm({ barberId: "", planId: "", endDate: isoDay(defaultEnd), paymentMethod: "" });
  }

  function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assignForm) return;
    if (!assignForm.barberId || !assignForm.planId || !assignForm.endDate) return;
    createSub.mutate({
      data: {
        barberId: parseInt(assignForm.barberId),
        planId: parseInt(assignForm.planId),
        endDate: new Date(`${assignForm.endDate}T23:59:59.999Z`).toISOString(),
        paymentMethod: assignForm.paymentMethod.trim() || null,
      },
    }, {
      onSuccess: () => { invalidateSubs(); toast({ title: s.assigned_toast }); setAssignForm(null); },
      onError: onErr,
    });
  }

  function openEditSub(sub: any) {
    setEditSub({
      id: sub.id,
      planId: String(sub.planId),
      status: sub.status,
      endDate: isoDay(new Date(sub.endDate)),
      paymentMethod: sub.paymentMethod ?? "",
    });
  }

  function handleEditSubSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSub) return;
    updateSub.mutate({
      id: editSub.id,
      data: {
        planId: parseInt(editSub.planId),
        status: editSub.status,
        endDate: new Date(`${editSub.endDate}T23:59:59.999Z`).toISOString(),
        paymentMethod: editSub.paymentMethod.trim() || null,
      },
    }, {
      onSuccess: () => { invalidateSubs(); toast({ title: s.sub_updated_toast }); setEditSub(null); },
      onError: onErr,
    });
  }

  function handleCancelSub(id: number) {
    if (!confirm(s.confirmCancelSub)) return;
    updateSub.mutate({ id, data: { status: "cancelled" } }, {
      onSuccess: () => { invalidateSubs(); toast({ title: s.sub_cancelled_toast }); },
      onError: onErr,
    });
  }

  function handleExtend30(sub: any) {
    const current = new Date(sub.endDate);
    const base = current.getTime() > Date.now() ? current : new Date();
    base.setDate(base.getDate() + 30);
    updateSub.mutate({ id: sub.id, data: { endDate: base.toISOString(), status: "active" } }, {
      onSuccess: () => { invalidateSubs(); toast({ title: s.sub_updated_toast }); },
      onError: onErr,
    });
  }

  function handleDeleteSub(id: number) {
    if (!confirm(s.confirmDeleteSub)) return;
    deleteSub.mutate({ id }, {
      onSuccess: () => { invalidateSubs(); toast({ title: s.sub_deleted_toast }); },
      onError: onErr,
    });
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
          <button onClick={openCreatePlan} className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> {s.newPlan}
          </button>
        )}
        {tab === "subs" && (
          <button onClick={openAssign} className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> {s.assignSub}
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
                  <button onClick={() => openEditPlan(p)} className="p-1.5 rounded bg-muted hover:bg-muted/80 transition-colors" title={s.editPlan}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDeletePlan(p.id)} className="p-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors">
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
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{s.empty}</td></tr>}
              {subs.map((row: any) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.barberName ?? `${s.barberShort}${row.barberId}`}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5 font-medium">{row.planName}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{row.paymentMethod ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(row.endDate).toLocaleDateString(locale)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => handleExtend30(row)} className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors" title={s.extend30}>
                        <CalendarPlus className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => openEditSub(row)} className="p-1.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors" title={s.changePlan}>
                        <Repeat className="h-3.5 w-3.5" />
                      </button>
                      {row.status === "active" && (
                        <button onClick={() => handleCancelSub(row.id)} className="p-1.5 rounded bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors" title={s.cancelSub}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDeleteSub(row.id)} className="p-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors" title={s.delete}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingPlan(null)}>
          <form onSubmit={handlePlanSubmit} onClick={e => e.stopPropagation()} className="bg-card rounded-xl border w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">{editingPlan.id ? s.editPlan : s.newPlan}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm space-y-1 col-span-2">
                <span className="text-muted-foreground">{s.fieldName}</span>
                <input required value={editingPlan.name} onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">{s.fieldPrice}</span>
                <input required type="number" min="0" step="100" value={editingPlan.price} onChange={e => setEditingPlan({ ...editingPlan, price: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">{s.fieldCycle}</span>
                <select value={editingPlan.billingCycle} onChange={e => setEditingPlan({ ...editingPlan, billingCycle: e.target.value as "monthly" | "yearly" })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="monthly">{s.monthly}</option>
                  <option value="yearly">{s.yearly}</option>
                </select>
              </label>
              <label className="text-sm space-y-1 col-span-2">
                <span className="text-muted-foreground">{s.fieldDescription}</span>
                <input value={editingPlan.description} onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="text-sm space-y-1 col-span-2">
                <span className="text-muted-foreground">{s.fieldFeatures}</span>
                <textarea rows={4} value={editingPlan.featuresText} onChange={e => setEditingPlan({ ...editingPlan, featuresText: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                {([
                  ["hasAnalytics", s.analytics],
                  ["hasPriority", s.priority],
                  ["hasFinancing", s.financing],
                  ["hasConferences", s.conferences],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(editingPlan as any)[key]} onChange={e => setEditingPlan({ ...editingPlan, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingPlan(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">{s.cancel}</button>
              <button type="submit" disabled={createPlan.isPending || updatePlan.isPending} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">{s.save}</button>
            </div>
          </form>
        </div>
      )}

      {assignForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAssignForm(null)}>
          <form onSubmit={handleAssignSubmit} onClick={e => e.stopPropagation()} className="bg-card rounded-xl border w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">{s.assignTitle}</h2>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground">{s.fieldBarber}</span>
              <select required value={assignForm.barberId} onChange={e => setAssignForm({ ...assignForm, barberId: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">{s.pickBarber}</option>
                {barbersList.map((bb: any) => (
                  <option key={bb.id} value={bb.id}>{bb.salonName} — {bb.city}</option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground">{s.fieldPlan}</span>
              <select required value={assignForm.planId} onChange={e => setAssignForm({ ...assignForm, planId: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">{s.pickPlan}</option>
                {plansList.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.price?.toLocaleString()} F</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm space-y-1 block">
                <span className="text-muted-foreground">{s.fieldEndDate}</span>
                <input required type="date" value={assignForm.endDate} onChange={e => setAssignForm({ ...assignForm, endDate: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-muted-foreground">{s.fieldPaymentMethod}</span>
                <input value={assignForm.paymentMethod} onChange={e => setAssignForm({ ...assignForm, paymentMethod: e.target.value })} placeholder={s.paymentMethodPh} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setAssignForm(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">{s.cancel}</button>
              <button type="submit" disabled={createSub.isPending} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">{s.save}</button>
            </div>
          </form>
        </div>
      )}

      {editSub && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditSub(null)}>
          <form onSubmit={handleEditSubSubmit} onClick={e => e.stopPropagation()} className="bg-card rounded-xl border w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">{s.editSub}</h2>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground">{s.fieldPlan}</span>
              <select required value={editSub.planId} onChange={e => setEditSub({ ...editSub, planId: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {plansList.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.price?.toLocaleString()} F</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm space-y-1 block">
                <span className="text-muted-foreground">{s.fieldSubStatus}</span>
                <select value={editSub.status} onChange={e => setEditSub({ ...editSub, status: e.target.value as any })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="active">{s.statusActive}</option>
                  <option value="expired">{s.statusExpired}</option>
                  <option value="cancelled">{s.statusCancelled}</option>
                </select>
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-muted-foreground">{s.fieldEndDate}</span>
                <input required type="date" value={editSub.endDate} onChange={e => setEditSub({ ...editSub, endDate: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </label>
            </div>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground">{s.fieldPaymentMethod}</span>
              <input value={editSub.paymentMethod} onChange={e => setEditSub({ ...editSub, paymentMethod: e.target.value })} placeholder={s.paymentMethodPh} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditSub(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">{s.cancel}</button>
              <button type="submit" disabled={updateSub.isPending} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">{s.save}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
