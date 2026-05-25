import { useState } from "react";
import { Bell, Send } from "lucide-react";
import { useListNotifications, useSendNotification, useMarkNotificationRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";

const typeLabels: Record<string, string> = {
  new_reservation: "Nouvelle réservation",
  confirmation: "Confirmation",
  reminder: "Rappel",
  admin_announcement: "Annonce admin",
  subscription_expiry: "Expiration abonnement",
};

export default function Notifications() {
  const [form, setForm] = useState({ type: "admin_announcement", title: "", message: "", userId: "" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: notifs, isLoading } = useListNotifications();
  const send = useSendNotification();
  const markRead = useMarkNotificationRead();

  const notifList = (notifs as any) ?? [];

  function handleSend() {
    if (!form.title) return;
    const payload: any = { type: form.type, title: form.title, message: form.message || undefined };
    if (form.userId) payload.userId = parseInt(form.userId);
    send.mutate({ data: payload }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        toast({ title: "Notification envoyée" });
        setForm({ type: "admin_announcement", title: "", message: "", userId: "" });
      },
    });
  }

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Envoyez et gérez les notifications de la plateforme" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Send form */}
        <div className="lg:col-span-1 rounded-xl border bg-card p-5 h-fit">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Envoyer une notification</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full rounded-lg border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Titre</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre de la notification" className="w-full rounded-lg border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Message</label>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Contenu du message..." className="w-full rounded-lg border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={3} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">ID utilisateur (vide = tous)</label>
              <input type="number" value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} placeholder="Laisser vide pour diffusion" className="w-full rounded-lg border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <button onClick={handleSend} disabled={!form.title} className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              <Send className="h-4 w-4" /> Envoyer
            </button>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Historique ({notifList.length})</h2>
          {isLoading && <p className="text-muted-foreground text-sm py-4 text-center">Chargement...</p>}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {notifList.map((n: any) => (
              <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${!n.isRead ? "bg-primary/5 border-primary/20" : "bg-muted/20"}`}>
                <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.isRead ? "bg-primary" : "bg-muted-foreground/40"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs bg-secondary rounded px-1.5 py-0.5">{typeLabels[n.type] ?? n.type}</span>
                    <span className="text-xs text-muted-foreground">{n.userId ? `User #${n.userId}` : "Broadcast"}</span>
                  </div>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleDateString("fr")}</p>
                  {!n.isRead && (
                    <button onClick={() => markRead.mutate({ id: n.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) })} className="text-xs text-primary hover:underline mt-0.5">Marquer lu</button>
                  )}
                </div>
              </div>
            ))}
            {!isLoading && notifList.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Aucune notification</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
