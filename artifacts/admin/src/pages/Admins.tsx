import { useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminListAdmins, adminInvite, adminSuspend, adminReactivate, adminDelete, type AdminAccount, type InviteResponse } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/lib/i18n";
import { formatApiError } from "@/lib/errors";
import ChangePassword from "@/pages/ChangePassword";

export default function Admins() {
  const { admin: me } = useAdminAuth();
  const { t } = useT();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResponse | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setAdmins(await adminListAdmins()); } catch (err) { setError(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true); setError(null); setInviteResult(null);
    try {
      const res = await adminInvite(inviteEmail.trim().toLowerCase(), inviteName.trim());
      setInviteResult(res);
      setInviteEmail(""); setInviteName("");
      await load();
    } catch (err) { setError(err); }
    finally { setInviting(false); }
  };

  const onSuspend = async (id: number) => {
    if (!confirm("Suspendre cet admin ?")) return;
    try { await adminSuspend(id); await load(); } catch (err) { setError(err); }
  };
  const onReactivate = async (id: number) => {
    try { await adminReactivate(id); await load(); } catch (err) { setError(err); }
  };
  const onDelete = async (id: number) => {
    if (!confirm("Supprimer définitivement cet admin ?")) return;
    try { await adminDelete(id); await load(); } catch (err) { setError(err); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Administrateurs" subtitle="Gérer les accès à la console admin." />

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Inviter un nouvel admin</h2>
        <form onSubmit={onInvite} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nom</Label>
            <Input id="invite-name" required value={inviteName} onChange={(e) => setInviteName(e.target.value)} disabled={inviting} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} disabled={inviting} />
          </div>
          <Button type="submit" disabled={inviting || !inviteEmail || !inviteName}>
            {inviting ? "..." : "Inviter"}
          </Button>
        </form>
        {inviteResult && (
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">Invitation créée pour {inviteResult.admin.email}.</p>
            {inviteResult.emailDelivered ? (
              <p className="text-muted-foreground mt-1">L'email d'invitation avec le mot de passe temporaire a été envoyé.</p>
            ) : (
              <>
                <p className="text-amber-600 mt-1">
                  ⚠ SMTP non configuré — l'email n'a pas été envoyé. Communiquez ces identifiants manuellement et de manière sécurisée :
                </p>
                {inviteResult.tempPassword && (
                  <pre className="mt-2 rounded bg-background p-2 text-xs font-mono select-all border border-border">
                    {inviteResult.admin.email}
                    {"\n"}
                    {inviteResult.tempPassword}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Liste des admins</h2>
        {error ? <p className="text-sm text-destructive mb-3">{formatApiError(error, t.errors)}</p> : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2 pr-3">Nom</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Rôle</th><th className="py-2 pr-3">Statut</th><th className="py-2 pr-3">Dernière connexion</th><th className="py-2"></th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-3">{a.name}{a.id === me?.id ? " (vous)" : ""}</td>
                    <td className="py-2 pr-3">{a.email}</td>
                    <td className="py-2 pr-3">{a.isRoot ? "Root" : "Admin"}</td>
                    <td className="py-2 pr-3">
                      <span className={a.status === "active" ? "text-green-600" : "text-amber-600"}>{a.status}</span>
                      {a.mustChangePassword && <span className="ml-2 text-xs text-muted-foreground">(mot de passe à changer)</span>}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : "—"}</td>
                    <td className="py-2 text-right space-x-2 whitespace-nowrap">
                      {a.id !== me?.id && !a.isRoot && (
                        <>
                          {a.status === "active" ? (
                            <Button variant="outline" size="sm" onClick={() => onSuspend(a.id)}>Suspendre</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => onReactivate(a.id)}>Réactiver</Button>
                          )}
                          <Button variant="destructive" size="sm" onClick={() => onDelete(a.id)}>Supprimer</Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {admins.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Aucun admin.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <ChangePassword />
      </section>
    </div>
  );
}
