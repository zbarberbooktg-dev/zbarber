import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, X, Star, Eye, Calendar, Image, Pause, Play, CreditCard, Banknote, FileText, ShieldCheck } from "lucide-react";
import {
  useGetBarber, useGetBarberStats, useGetBarberGallery, useListBarberServices,
  useApproveBarber, useRejectBarber, useSuspendBarber, useReactivateBarber,
  useFirstValidateBarber, useRejectBarberDocument,
  useListReservations, useListSubscriptions, useListFinancingRequests,
  getListBarbersQueryKey, getGetBarberQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { formatApiError } from "@/lib/errors";

interface Props { params: { id: string } }

type ModalState = { type: "reject" | "suspend" | "documentReject" } | null;

export default function BarberDetail({ params }: Props) {
  const id = parseInt(params.id);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, locale } = useT();
  const d = t.barberDetail;
  const { data: barber, isLoading } = useGetBarber(id);
  const { data: stats } = useGetBarberStats(id);
  const { data: gallery } = useGetBarberGallery(id);
  const { data: services } = useListBarberServices(id);
  const { data: reservationsData } = useListReservations({ barberId: id, limit: "5" } as any);
  const { data: subsData } = useListSubscriptions({ barberId: id, status: "active" } as any);
  const { data: financingData } = useListFinancingRequests({ limit: "100" } as any);
  const approve = useApproveBarber();
  const reject = useRejectBarber();
  const suspend = useSuspendBarber();
  const reactivate = useReactivateBarber();
  const firstValidate = useFirstValidateBarber();
  const rejectDocument = useRejectBarberDocument();

  const [modal, setModal] = useState<ModalState>(null);
  const [reason, setReason] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListBarbersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetBarberQueryKey(id) });
  };
  const onErr = (err: unknown) => toast({ title: formatApiError(err, t.errors), variant: "destructive" as any });

  function openModal(type: "reject" | "suspend" | "documentReject") { setModal({ type }); setReason(""); }
  function closeModal() { setModal(null); setReason(""); }
  function submitModal(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const r = reason.trim();
    if (modal.type === "reject") {
      if (!r) { toast({ title: t.barbers.reasonRequired, variant: "destructive" as any }); return; }
      reject.mutate({ id, data: { reason: r } }, { onSuccess: () => { invalidate(); toast({ title: t.statuses.rejected }); closeModal(); }, onError: onErr });
    } else if (modal.type === "documentReject") {
      if (!r) { toast({ title: t.barbers.reasonRequired, variant: "destructive" as any }); return; }
      rejectDocument.mutate({ id, data: { reason: r } }, { onSuccess: () => { invalidate(); toast({ title: t.barbers.documentRejected_toast }); closeModal(); }, onError: onErr });
    } else {
      suspend.mutate({ id, data: { reason: r || null } }, { onSuccess: () => { invalidate(); toast({ title: t.barbers.suspended_toast }); closeModal(); }, onError: onErr });
    }
  }

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">{t.common.loading}</div>;
  if (!barber) return <div className="text-muted-foreground">{d.notFound}</div>;

  const b = barber as any;
  const recentReservations = ((reservationsData as any)?.data ?? []).slice(0, 5);
  const activeSubs = ((subsData as any)?.data ?? []);
  const allFinancing = ((financingData as any)?.data ?? []);
  const barberFinancing = allFinancing.filter((f: any) => f.barberId === id);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/barbers">
          <a className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> {t.common.back}
          </a>
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
            {b.salonName?.[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold">{b.salonName}</h1>
            <p className="text-sm text-muted-foreground">{b.city}{b.neighborhood ? `, ${b.neighborhood}` : ""}</p>
            <div className="mt-1"><StatusBadge status={b.status} /></div>
          </div>
        </div>
        <div className="flex gap-2">
          {b.status === "pending" && (
            <>
              <button
                onClick={() => firstValidate.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: d.firstValidated_toast }); }, onError: onErr })}
                disabled={firstValidate.isPending}
                className="flex items-center gap-2 rounded-lg bg-emerald-500 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {d.firstValidate}
              </button>
              <button
                onClick={() => openModal("reject")}
                className="flex items-center gap-2 rounded-lg border border-destructive text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/5 transition-colors"
              >
                <X className="h-4 w-4" /> {d.reject}
              </button>
            </>
          )}
          {b.status === "awaiting_document" && (
            <>
              <button
                onClick={() => approve.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: t.statuses.approved }); }, onError: onErr })}
                disabled={approve.isPending || !b.documentUrl}
                title={!b.documentUrl ? d.documentMissing : undefined}
                className="flex items-center gap-2 rounded-lg bg-emerald-500 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" /> {d.finalValidate}
              </button>
              <button
                onClick={() => openModal("documentReject")}
                disabled={!b.documentUrl}
                className="flex items-center gap-2 rounded-lg border border-amber-500 text-amber-600 px-4 py-2 text-sm font-medium hover:bg-amber-500/5 transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" /> {d.documentReject}
              </button>
            </>
          )}
          {b.status === "approved" && (
            <button
              onClick={() => openModal("suspend")}
              className="flex items-center gap-2 rounded-lg border border-amber-500 text-amber-600 px-4 py-2 text-sm font-medium hover:bg-amber-500/5 transition-colors"
            >
              <Pause className="h-4 w-4" /> {t.barbers.suspendTitle}
            </button>
          )}
          {(b.status === "suspended" || b.status === "rejected") && (
            <button
              onClick={() => { if (confirm(t.barbers.confirmReactivate)) reactivate.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: t.barbers.reactivated_toast }); }, onError: onErr }); }}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              <Play className="h-4 w-4" /> {t.barbers.reactivateTitle}
            </button>
          )}
        </div>
      </div>

      {(b.status === "awaiting_document" || b.documentUrl) && (
        <div className="mb-6 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> {d.documentSection}</h2>
          {b.documentDeadline && (
            <p className="text-xs text-muted-foreground mb-2">{d.documentDeadline}: {new Date(b.documentDeadline).toLocaleDateString(locale)}</p>
          )}
          {b.documentReviewNote && (
            <p className="text-xs text-amber-600 mb-2">{d.documentReviewNote}: {b.documentReviewNote}</p>
          )}
          {b.documentUrl ? (
            <div className="space-y-3">
              {b.documentSubmittedAt && (
                <p className="text-xs text-muted-foreground">{d.documentSubmittedAt}: {new Date(b.documentSubmittedAt).toLocaleDateString(locale)}</p>
              )}
              <a href={`/api/storage${b.documentUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                <FileText className="h-4 w-4" /> {d.documentView}
              </a>
              <div className="rounded-lg border bg-muted/40 overflow-hidden max-w-md">
                <img src={`/api/storage${b.documentUrl}`} alt={d.documentSection} className="w-full max-h-96 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{d.documentPending}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: d.profileViews, value: (stats as any)?.profileViews ?? 0, icon: Eye, color: "#3b82f6" },
          { label: d.totalReservations, value: (stats as any)?.totalReservations ?? 0, icon: Calendar, color: "hsl(var(--primary))" },
          { label: d.avgRating, value: `${b.rating?.toFixed(1) ?? "—"}/5`, icon: Star, color: "#f59e0b" },
          { label: d.photos, value: (gallery as any)?.length ?? 0, icon: Image, color: "#8b5cf6" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4" style={{ color }} />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">{d.info}</h2>
          <dl className="space-y-3 text-sm">
            {[
              [d.owner, b.ownerName],
              [d.email, b.ownerEmail],
              [d.phone, b.phone],
              [d.whatsapp, b.whatsapp],
              [d.address, b.address],
              [d.bio, b.bio],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="flex gap-3">
                <dt className="text-muted-foreground w-28 shrink-0">{k}</dt>
                <dd className="break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">{d.services} ({(services as any)?.length ?? 0})</h2>
          <div className="space-y-2">
            {((services as any) ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <span>{s.name}</span>
                <span className="font-semibold text-primary">{s.price?.toLocaleString()} F</span>
              </div>
            ))}
            {(!services || (services as any).length === 0) && <p className="text-xs text-muted-foreground">{d.noServices}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-500" /> {d.activeSub}</h2>
          {activeSubs.length === 0 ? (
            <p className="text-xs text-muted-foreground">{d.noSubActive}</p>
          ) : (
            <div className="space-y-3">
              {activeSubs.map((sub: any) => (
                <div key={sub.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <div>
                    <p className="font-medium">{sub.planName ?? `#${sub.planId}`}</p>
                    <p className="text-xs text-muted-foreground">{d.subExpires} {new Date(sub.endDate).toLocaleDateString(locale)}</p>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Banknote className="h-4 w-4 text-amber-500" /> {d.financingHistory} ({barberFinancing.length})</h2>
          {barberFinancing.length === 0 ? (
            <p className="text-xs text-muted-foreground">{d.noFinancings}</p>
          ) : (
            <div className="space-y-2">
              {barberFinancing.slice(0, 5).map((f: any) => (
                <div key={f.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <div>
                    <p className="font-medium">{f.amount?.toLocaleString()} F</p>
                    <p className="text-xs text-muted-foreground">{t.financing.purposes[f.purpose] ?? f.purpose}</p>
                  </div>
                  <StatusBadge status={f.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {d.bookingsHistory}</h2>
        {recentReservations.length === 0 ? (
          <p className="text-xs text-muted-foreground">{d.noBookingsHist}</p>
        ) : (
          <div className="space-y-2">
            {recentReservations.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.clientName ?? `${t.reservations.clientShort}${r.clientId}`}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.serviceName} · {new Date(r.scheduledAt).toLocaleDateString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {(gallery as any)?.length > 0 && (
        <div className="mt-6 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">{d.gallery} ({(gallery as any).length} {d.photosLabel})</h2>
          <div className="grid grid-cols-4 gap-3">
            {(gallery as any).map((p: any) => (
              <div key={p.id} className="aspect-square rounded-lg bg-muted overflow-hidden">
                <img src={p.photoUrl} alt={p.caption ?? ""} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeModal}>
          <form onSubmit={submitModal} onClick={e => e.stopPropagation()} className="bg-card rounded-xl border w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold">{modal.type === "reject" ? t.barbers.rejectModalTitle : t.barbers.suspendModalTitle}</h2>
            <p className="text-sm text-muted-foreground">{b.salonName}</p>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground">{modal.type === "reject" ? t.barbers.rejectReasonLabel : t.barbers.suspendReasonLabel}</span>
              <textarea
                rows={4}
                required={modal.type === "reject"}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={modal.type === "reject" ? t.barbers.rejectReasonPh : t.barbers.suspendReasonPh}
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
                {t.barbers.confirmAction}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
