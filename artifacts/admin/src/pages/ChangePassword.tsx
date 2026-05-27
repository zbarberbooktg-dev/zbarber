import { useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { formatApiError } from "@/lib/errors";

export default function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { admin, changePassword, logout } = useAdminAuth();
  const { t } = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError(new Error("Les mots de passe ne correspondent pas")); return; }
    if (next.length < 8) { setError(new Error("Au moins 8 caractères")); return; }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={forced ? "flex min-h-[100dvh] items-center justify-center bg-background px-4" : ""}>
      <div className={forced ? "w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-lg" : "max-w-md bg-card border border-border rounded-xl p-6"}>
        <h1 className="text-xl font-bold text-foreground mb-1">
          {forced ? "Changement de mot de passe requis" : "Changer le mot de passe"}
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          {forced
            ? `Bienvenue ${admin?.name ?? ""}. Pour des raisons de sécurité, vous devez changer votre mot de passe avant de continuer.`
            : "Saisissez votre mot de passe actuel et choisissez-en un nouveau."}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">Mot de passe actuel</Label>
            <Input id="current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new">Nouveau mot de passe</Label>
            <Input id="new" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmer le nouveau mot de passe</Label>
            <Input id="confirm" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={submitting} />
          </div>
          {error ? <p className="text-sm text-destructive" role="alert">{formatApiError(error, t.errors)}</p> : null}
          {success && <p className="text-sm text-green-600">Mot de passe mis à jour.</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting || !current || !next || !confirm}>
              {submitting ? "..." : "Mettre à jour"}
            </Button>
            {forced && (
              <Button type="button" variant="outline" onClick={() => logout()} disabled={submitting}>
                Se déconnecter
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
