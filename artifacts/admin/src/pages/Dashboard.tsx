import { Users, Scissors, Calendar, CreditCard, Banknote, Star, Clock, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useGetAdminStats, useGetMonthlyStats, useGetTopBarbers, useGetRecentActivity } from "@workspace/api-client-react";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: monthly } = useGetMonthlyStats();
  const { data: topBarbers } = useGetTopBarbers();
  const { data: activity } = useGetRecentActivity();

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue globale de la plateforme Global Barber Corp" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Utilisateurs" value={statsLoading ? "—" : stats?.totalUsers ?? 0} icon={Users} color="#3b82f6" />
        <StatCard title="Barbiers" value={statsLoading ? "—" : stats?.totalBarbers ?? 0} icon={Scissors} color="hsl(var(--primary))" />
        <StatCard title="Réservations" value={statsLoading ? "—" : stats?.totalReservations ?? 0} icon={Calendar} color="#8b5cf6" />
        <StatCard title="Abonnements actifs" value={statsLoading ? "—" : stats?.activeSubscriptions ?? 0} icon={CreditCard} color="#10b981" />
        <StatCard title="Financements en attente" value={statsLoading ? "—" : stats?.pendingFinancing ?? 0} icon={Banknote} color="#f59e0b" trend="À traiter" />
        <StatCard title="Barbiers en attente" value={statsLoading ? "—" : stats?.pendingBarbers ?? 0} icon={Clock} color="#ef4444" trend="Validation requise" />
        <StatCard title="Note moyenne" value={statsLoading ? "—" : (stats?.averageRating ?? 0).toFixed(1)} icon={Star} color="#f59e0b" trend="/ 5" />
        <StatCard title="Salons approuvés" value={statsLoading ? "—" : stats?.totalSalons ?? 0} icon={TrendingUp} color="#10b981" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly chart */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Tendances mensuelles</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly ?? []} barSize={8} barGap={4}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "none", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="reservations" name="Réservations" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="newBarbers" name="Nouveaux barbiers" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="newUsers" name="Nouveaux clients" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top barbers */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Top Barbiers</h2>
          <div className="space-y-3">
            {(topBarbers ?? []).slice(0, 5).map((b: any, i: number) => (
              <div key={b.barberId} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                  {b.salonName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{b.salonName}</p>
                  <p className="text-xs text-muted-foreground">{b.city}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">{b.reservations}</p>
                  <p className="text-xs text-muted-foreground">rés.</p>
                </div>
              </div>
            ))}
            {(!topBarbers || topBarbers.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune donnée</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Activité récente</h2>
        <div className="space-y-2">
          {(activity ?? []).map((a: any) => (
            <div key={`${a.type}-${a.id}`} className="flex items-center gap-3 py-2 border-b last:border-0">
              <div className={`h-2 w-2 rounded-full shrink-0 ${a.type === "reservation" ? "bg-primary" : "bg-blue-500"}`} />
              <span className="text-sm flex-1">{a.description}</span>
              <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString("fr")}</span>
            </div>
          ))}
          {(!activity || activity.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-4">Aucune activité récente</p>
          )}
        </div>
      </div>
    </div>
  );
}
