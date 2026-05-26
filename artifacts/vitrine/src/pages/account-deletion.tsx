import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function AccountDeletion() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const confirmWord = (t as any).accountDeletion?.confirmWord ?? "SUPPRIMER";
  const canSubmit = email.includes("@") && confirm.trim().toUpperCase() === confirmWord && !busy;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/account-deletion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim() || undefined, reason: reason.trim() || undefined }),
      });
      if (!res.ok) throw new Error((t as any).accountDeletion?.error ?? "Échec de l'envoi");
      setOk(true);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const ad = (t as any).accountDeletion ?? {};

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
          {ad.title ?? "Demande de suppression de compte"}
        </h1>
        <p className="text-muted-foreground mb-8 text-lg">
          {ad.intro ?? "Vous pouvez nous demander de supprimer votre compte et les données associées. Notre équipe traitera votre demande sous 30 jours."}
        </p>

        {ok ? (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 flex items-start gap-4">
            <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-2">
                {ad.okTitle ?? "Demande reçue"}
              </h2>
              <p className="text-muted-foreground">
                {ad.okDesc ?? "Nous avons bien reçu votre demande. Vous recevrez une confirmation par email lorsque votre compte sera supprimé."}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                {ad.warning ?? "La suppression est définitive : votre profil sera anonymisé et vos accès retirés. Vos réservations passées et avis seront conservés sans lien avec votre identité."}
              </p>
            </div>

            <div>
              <Label htmlFor="email">{ad.email ?? "Email du compte"} *</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@example.com" className="mt-1.5" />
            </div>

            <div>
              <Label htmlFor="fullName">{ad.fullName ?? "Nom complet"}</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={ad.fullNamePh ?? "Prénom Nom"} className="mt-1.5" />
            </div>

            <div>
              <Label htmlFor="reason">{ad.reason ?? "Raison (optionnel)"}</Label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={ad.reasonPh ?? "Pourquoi nous quittez-vous ?"}
                rows={4}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <Label htmlFor="confirm">
                {(ad.confirmLabel ?? "Tapez %word% pour confirmer").replace("%word%", confirmWord)} *
              </Label>
              <Input
                id="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={confirmWord}
                className="mt-1.5"
                autoCapitalize="characters"
              />
            </div>

            {err && <p className="text-destructive text-sm">{err}</p>}

            <Button type="submit" variant="destructive" disabled={!canSubmit} className="w-full">
              {busy ? (ad.submitting ?? "Envoi…") : (ad.submit ?? "Envoyer la demande de suppression")}
            </Button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
