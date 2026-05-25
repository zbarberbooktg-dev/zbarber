import { Link } from "wouter";
import { ArrowLeft, Check, X, Star, Eye, Calendar, Image } from "lucide-react";
import { useGetBarber, useGetBarberStats, useGetBarberGallery, useListBarberServices, useApproveBarber, useRejectBarber, getListBarbersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";

interface Props { params: { id: string } }

export default function BarberDetail({ params }: Props) {
  const id = parseInt(params.id);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: barber, isLoading } = useGetBarber(id);
  const { data: stats } = useGetBarberStats(id);
  const { data: gallery } = useGetBarberGallery(id);
  const { data: services } = useListBarberServices(id);
  const approve = useApproveBarber();
  const reject = useRejectBarber();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;
  if (!barber) return <div className="text-muted-foreground">Barbier introuvable</div>;

  const b = barber as any;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/barbers">
          <a className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Retour
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
        {b.status === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={() => approve.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListBarbersQueryKey() }); toast({ title: "Approuvé" }); } })}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              <Check className="h-4 w-4" /> Approuver
            </button>
            <button
              onClick={() => reject.mutate({ id, data: { reason: "Non conforme" } }, { onSuccess: () => toast({ title: "Rejeté" }) })}
              className="flex items-center gap-2 rounded-lg border border-destructive text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/5 transition-colors"
            >
              <X className="h-4 w-4" /> Rejeter
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Vues profil", value: (stats as any)?.profileViews ?? 0, icon: Eye, color: "#3b82f6" },
          { label: "Réservations totales", value: (stats as any)?.totalReservations ?? 0, icon: Calendar, color: "hsl(var(--primary))" },
          { label: "Note moyenne", value: `${b.rating?.toFixed(1) ?? "—"}/5`, icon: Star, color: "#f59e0b" },
          { label: "Photos galerie", value: (gallery as any)?.length ?? 0, icon: Image, color: "#8b5cf6" },
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
        {/* Info */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Informations</h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Propriétaire", b.ownerName],
              ["Email", b.ownerEmail],
              ["Téléphone", b.phone],
              ["WhatsApp", b.whatsapp],
              ["Adresse", b.address],
              ["Bio", b.bio],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="flex gap-3">
                <dt className="text-muted-foreground w-28 shrink-0">{k}</dt>
                <dd className="break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Services */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Services ({(services as any)?.length ?? 0})</h2>
          <div className="space-y-2">
            {((services as any) ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <span>{s.name}</span>
                <span className="font-semibold text-primary">{s.price?.toLocaleString()} F</span>
              </div>
            ))}
            {(!services || (services as any).length === 0) && <p className="text-xs text-muted-foreground">Aucun service enregistré</p>}
          </div>
        </div>
      </div>

      {/* Gallery */}
      {(gallery as any)?.length > 0 && (
        <div className="mt-6 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Galerie ({(gallery as any).length} photos)</h2>
          <div className="grid grid-cols-4 gap-3">
            {(gallery as any).map((p: any) => (
              <div key={p.id} className="aspect-square rounded-lg bg-muted overflow-hidden">
                <img src={p.photoUrl} alt={p.caption ?? ""} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
