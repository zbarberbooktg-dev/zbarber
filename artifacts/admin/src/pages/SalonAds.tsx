import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCreateSalonAdUrl, getListAdminSalonAdsQueryKey, useListAdminSalonAds,
  useListBarbers, useSetSalonAdVisibility, type AdminSalonVideoAd,
} from "@workspace/api-client-react";
import { Film, Upload, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

const PAGE_SIZE = 25;
const MAX_BYTES = 20 * 1024 * 1024;

export default function SalonAds() {
  const { lang } = useT();
  const txt = (fr: string, en: string) => lang === "fr" ? fr : en;
  const qc = useQueryClient();
  const ads = useListAdminSalonAds();
  const visibility = useSetSalonAdVisibility();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [salon, setSalon] = useState<{ id: number; name: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const salons = useListBarbers({ search: search.trim() || undefined, page, limit: PAGE_SIZE });
  const invalidate = () => qc.invalidateQueries({ queryKey: getListAdminSalonAdsQueryKey() });

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!salon || !file || uploading) return;
    setFeedback(null);
    if ((file.type && file.type !== "video/mp4") || !file.name.toLowerCase().endsWith(".mp4") || file.size > MAX_BYTES || file.size === 0) {
      setFeedback({ error: true, text: txt("Choisissez une vidéo MP4 de 20 Mo maximum.", "Choose an MP4 video up to 20 MiB.") });
      return;
    }
    setUploading(true);
    try {
      // Orval JSON-stringifies raw Blob bodies. Keep the generated URL, but send actual bytes.
      const result = await fetch(getCreateSalonAdUrl({ salonId: salon.id }), {
        method: "POST", credentials: "include", headers: { "Content-Type": "video/mp4" }, body: file,
      });
      if (!result.ok) {
        const msg = result.status === 413 || result.status === 415
          ? txt("Ce fichier n’est pas une vidéo MP4 valide ou dépasse 20 Mo.", "This file is not a valid MP4 video or exceeds 20 MiB.")
          : result.status === 404 ? txt("Ce salon n’existe plus.", "This salon no longer exists.")
          : result.status === 401 || result.status === 403 ? txt("Vérifiez votre accès administrateur.", "Check your administrator access.")
          : txt("Impossible d’enregistrer la vidéo. Réessayez.", "The video could not be saved. Try again.");
        setFeedback({ error: true, text: msg });
        return;
      }
      setFile(null);
      setSalon(null);
      if (input.current) input.current.value = "";
      await invalidate();
      setFeedback({ error: false, text: txt("Vidéo enregistrée. Activez-la pour l’afficher sur l’accueil.", "Video saved. Activate it to show it on the home screen.") });
    } catch {
      setFeedback({ error: true, text: txt("Envoi interrompu. Vérifiez votre connexion et réessayez.", "Upload interrupted. Check your connection and try again.") });
    } finally {
      setUploading(false);
    }
  }

  async function toggle(ad: AdminSalonVideoAd) {
    setFeedback(null);
    try {
      await visibility.mutateAsync({ id: ad.id, data: { active: !ad.active } });
      await invalidate();
      setFeedback({ error: false, text: ad.active ? txt("Publicité désactivée.", "Ad deactivated.") : txt("Publicité activée.", "Ad activated.") });
    } catch (e) {
      const conflict = (e as { status?: number }).status === 409;
      setFeedback({ error: true, text: conflict ? txt("Seuls les salons approuvés peuvent être mis en avant.", "Only approved salons can be advertised.")
        : txt("Impossible de modifier la visibilité. Réessayez.", "Visibility could not be changed. Try again.") });
      void invalidate();
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Film className="size-4" aria-hidden /> {txt("Contenu de l’accueil", "Home content")}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{txt("Publicités", "Advertisements")}</h1>
        <p className="text-sm text-muted-foreground">{txt("Mettez un salon en avant avec une vidéo sur l’accueil mobile.", "Feature a salon with a video on the mobile home screen.")}</p>
      </header>
      <Card className="p-5">
        <form onSubmit={upload} className="space-y-4">
          <h2 className="text-lg font-semibold">{txt("Nouvelle publicité", "New advertisement")}</h2>
          <fieldset disabled={uploading} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="ad-salon-search">{txt("1. Choisir un salon", "1. Choose a salon")}</label>
              <Input id="ad-salon-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={txt("Rechercher par nom ou ville", "Search by name or city")} />
              {salons.isError ? <Button type="button" variant="outline" size="sm" onClick={() => void salons.refetch()}>{txt("Réessayer de charger les salons", "Retry loading salons")}</Button>
                : <select className="w-full rounded-md border bg-background p-2 text-sm" aria-label={txt("Salon associé", "Linked salon")}
                    value={salon?.id ?? ""} onChange={(e) => {
                      const selected = salons.data?.data.find((s) => String(s.id) === e.target.value);
                      setSalon(selected ? { id: selected.id, name: selected.salonName } : null);
                    }}>
                  <option value="">{salons.isLoading ? txt("Chargement…", "Loading…") : salons.data?.data.length ? txt("Sélectionner un salon", "Select a salon") : txt("Aucun salon trouvé", "No salons found")}</option>
                  {salon && !salons.data?.data.some((s) => salon.id === s.id) && <option value={salon.id}>{salon.name}</option>}
                  {salons.data?.data.map((s) => <option value={s.id} key={s.id}>{s.salonName}{s.city ? ` · ${s.city}` : ""}</option>)}
                </select>}
              {(page > 1 || (salons.data?.total ?? 0) > page * PAGE_SIZE) && <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>{txt("Précédent", "Previous")}</Button>
                <Button type="button" variant="outline" size="sm" disabled={(salons.data?.total ?? 0) <= page * PAGE_SIZE} onClick={() => setPage(page + 1)}>{txt("Suivant", "Next")}</Button>
              </div>}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="ad-video-file">{txt("2. Choisir une vidéo", "2. Choose a video")}</label>
              <Input id="ad-video-file" type="file" ref={input} accept="video/mp4,.mp4" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">{txt("MP4 (H.264 recommandé), 20 Mo maximum. La publicité est inactive à sa création.", "MP4 (H.264 recommended), up to 20 MiB. The ad starts inactive.")}</p>
            </div>
          </fieldset>
          <Button type="submit" disabled={!salon || !file || uploading}><Upload className="mr-2 size-4" />{uploading ? txt("Envoi en cours…", "Uploading…") : txt("Téléverser la vidéo", "Upload video")}</Button>
        </form>
      </Card>
      {feedback && <p role={feedback.error ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${feedback.error ? "border-destructive text-destructive" : "bg-muted"}`}>{feedback.text}</p>}
      <section aria-label={txt("Publicités enregistrées", "Saved advertisements")} className="space-y-3">
        <h2 className="text-lg font-semibold">{txt("Publicités enregistrées", "Saved advertisements")}</h2>
        {ads.isLoading && <p role="status" className="text-sm text-muted-foreground">{txt("Chargement…", "Loading…")}</p>}
        {ads.isError && <Button variant="outline" onClick={() => void ads.refetch()}>{txt("Impossible de charger les publicités. Réessayer.", "Could not load ads. Retry.")}</Button>}
        {!ads.isLoading && !ads.isError && !ads.data?.length && <Card className="p-5 text-sm text-muted-foreground">{txt("Aucune publicité pour le moment.", "No ads yet.")}</Card>}
        {ads.data?.map((ad) => {
          const shown = ad.active && ad.salonPublic;
          return (
            <Card key={ad.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold">{ad.salonName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {shown ? txt("Visible sur l’accueil", "Visible on home") : ad.active ? txt("Masquée : salon non approuvé", "Hidden: salon not approved") : txt("Inactive", "Inactive")}
                  </p>
                  {!ad.active && !ad.salonPublic && <p className="text-xs text-muted-foreground">{txt("L’activation sera possible après approbation du salon.", "Activation requires salon approval.")}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" aria-expanded={preview === ad.id} onClick={() => setPreview(preview === ad.id ? null : ad.id)}>
                    <Film className="mr-2 size-4" />{preview === ad.id ? txt("Fermer l’aperçu", "Close preview") : txt("Aperçu vidéo", "Preview video")}
                  </Button>
                  <Button size="sm" variant={ad.active ? "outline" : "default"} disabled={visibility.isPending || (!ad.active && !ad.salonPublic)} onClick={() => void toggle(ad)}>
                    {ad.active ? <EyeOff className="mr-2 size-4" /> : <Eye className="mr-2 size-4" />}
                    {ad.active ? txt("Désactiver", "Deactivate") : txt("Activer", "Activate")}
                  </Button>
                </div>
              </div>
              {preview === ad.id && <video src={ad.videoPath} aria-label={ad.salonName} className="max-h-80 w-full rounded-lg bg-black" controls muted playsInline preload="metadata" />}
            </Card>
          );
        })}
      </section>
    </main>
  );
}
