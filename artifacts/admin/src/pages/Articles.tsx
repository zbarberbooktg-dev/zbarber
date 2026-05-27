import { useState, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminArticles,
  useCreateArticle,
  useUpdateArticle,
  useDeleteArticle,
  getListAdminArticlesQueryKey,
  getListPublicArticlesQueryKey,
  type Article,
} from "@workspace/api-client-react";
import {
  Plus, Trash2, Upload, ArrowUp, ArrowDown, Pencil, X, FileText, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/i18n";
import { RichTextEditor } from "@/components/RichTextEditor";

function resolveObjectUrl(p: string): string {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  if (p.startsWith("/objects/")) return `/api/storage${p}`;
  return p;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}
function fromLocalInput(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

type FormState = {
  id?: number;
  title: string;
  subtitle: string;
  coverImageUrl: string;
  contentHtml: string;
  status: "draft" | "published";
  startsAt: string;
  endsAt: string;
};

const emptyForm: FormState = {
  title: "",
  subtitle: "",
  coverImageUrl: "",
  contentHtml: "",
  status: "draft",
  startsAt: "",
  endsAt: "",
};

export default function Articles() {
  const { toast } = useToast();
  const { t } = useT();
  const qc = useQueryClient();
  const { data, isLoading } = useListAdminArticles();
  const createMut = useCreateArticle();
  const updateMut = useUpdateArticle();
  const deleteMut = useDeleteArticle();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [uploading, setUploading] = useState(false);

  const articles = useMemo(
    () => (data ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [data],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListAdminArticlesQueryKey() });
    qc.invalidateQueries({ queryKey: getListPublicArticlesQueryKey() });
  };
  const onErr = (err: unknown) =>
    toast({ title: formatApiError(err, t.errors), variant: "destructive" as any });

  const startNew = () => setForm({ ...emptyForm });
  const startEdit = (a: Article) =>
    setForm({
      id: a.id,
      title: a.title,
      subtitle: a.subtitle ?? "",
      coverImageUrl: a.coverImageUrl,
      contentHtml: a.contentHtml ?? "",
      status: a.status,
      startsAt: toLocalInput(a.startsAt),
      endsAt: toLocalInput(a.endsAt),
    });

  const handleFile = async (file: File) => {
    if (!form) return;
    setUploading(true);
    try {
      const presigned = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!presigned.ok) throw new Error("Échec génération URL upload");
      const { uploadURL, objectPath } = await presigned.json();
      const put = await fetch(uploadURL, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) throw new Error("Échec upload");
      setForm({ ...form, coverImageUrl: objectPath });
    } catch (e) {
      onErr(e);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.title.trim()) {
      onErr(new Error("Le titre est requis"));
      return;
    }
    if (!form.coverImageUrl) {
      onErr(new Error("Une photo de couverture est requise"));
      return;
    }

    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      coverImageUrl: form.coverImageUrl,
      contentHtml: form.contentHtml,
      status: form.status,
      startsAt: form.startsAt ? fromLocalInput(form.startsAt) ?? undefined : undefined,
      endsAt: form.endsAt ? fromLocalInput(form.endsAt) : null,
    };

    try {
      if (form.id) {
        await updateMut.mutateAsync({ id: form.id, data: payload });
      } else {
        // sortOrder is assigned server-side (max + 1) to avoid collisions.
        await createMut.mutateAsync({ data: payload });
      }
      setForm(null);
      invalidate();
      toast({ title: form.id ? "Article mis à jour" : "Article créé" });
    } catch (e) {
      onErr(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cet article ?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      invalidate();
    } catch (e) {
      onErr(e);
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= articles.length) return;
    const a = articles[idx];
    const b = articles[target];
    try {
      await Promise.all([
        updateMut.mutateAsync({ id: a.id, data: { sortOrder: b.sortOrder ?? target } }),
        updateMut.mutateAsync({ id: b.id, data: { sortOrder: a.sortOrder ?? idx } }),
      ]);
      invalidate();
    } catch (e) {
      onErr(e);
    }
  };

  const togglePublish = async (a: Article) => {
    try {
      await updateMut.mutateAsync({
        id: a.id,
        data: { status: a.status === "published" ? "draft" : "published" },
      });
      invalidate();
    } catch (e) {
      onErr(e);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            L'édito
          </h1>
          <p className="text-sm text-muted-foreground">
            Articles affichés en carrousel sur l'accueil de l'app mobile.
          </p>
        </div>
        {!form && (
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-2" /> Nouvel article
          </Button>
        )}
      </div>

      {form && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {form.id ? "Modifier l'article" : "Nouvel article"}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setForm(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-3">
              <Label>Photo de couverture</Label>
              <div className="aspect-video bg-muted border rounded-md overflow-hidden flex items-center justify-center">
                {form.coverImageUrl ? (
                  <img
                    src={resolveObjectUrl(form.coverImageUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Aucune photo</span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Envoi…" : form.coverImageUrl ? "Remplacer" : "Choisir une photo"}
              </Button>
            </div>

            <div className="md:col-span-2 space-y-3">
              <div>
                <Label htmlFor="art-title">Titre *</Label>
                <Input
                  id="art-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Titre de l'article"
                />
              </div>
              <div>
                <Label htmlFor="art-sub">Sous-titre</Label>
                <Textarea
                  id="art-sub"
                  rows={2}
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="Optionnel"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Statut</Label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as "draft" | "published" })
                    }
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="draft">Brouillon</option>
                    <option value="published">Publié</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="art-start">Visible à partir du</Label>
                  <Input
                    id="art-start"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="art-end">Visible jusqu'au</Label>
                  <Input
                    id="art-end"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    placeholder="(sans limite)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label>Contenu</Label>
            <div className="mt-1">
              <RichTextEditor
                value={form.contentHtml}
                onChange={(html) => setForm({ ...form, contentHtml: html })}
                placeholder="Écrivez le contenu de l'article…"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setForm(null)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending
                ? "Enregistrement…"
                : form.id
                ? "Mettre à jour"
                : "Créer"}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : articles.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Aucun article pour le moment.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {articles.map((a, idx) => {
            const now = Date.now();
            const startMs = new Date(a.startsAt).getTime();
            const endMs = a.endsAt ? new Date(a.endsAt).getTime() : null;
            const inWindow = startMs <= now && (endMs === null || endMs > now);
            const live = a.status === "published" && inWindow;
            return (
              <Card key={a.id} className="p-3 flex gap-4 items-center">
                <div className="w-28 h-20 bg-muted overflow-hidden rounded shrink-0">
                  {a.coverImageUrl && (
                    <img
                      src={resolveObjectUrl(a.coverImageUrl)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{a.title}</h3>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        live
                          ? "bg-green-500/15 text-green-600"
                          : a.status === "published"
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {live ? "En ligne" : a.status === "published" ? "Programmé / expiré" : "Brouillon"}
                    </span>
                  </div>
                  {a.subtitle && (
                    <p className="text-xs text-muted-foreground truncate">{a.subtitle}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Visible : {new Date(a.startsAt).toLocaleString("fr-FR")} →{" "}
                    {a.endsAt ? new Date(a.endsAt).toLocaleString("fr-FR") : "sans limite"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => move(idx, 1)}
                    disabled={idx === articles.length - 1}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => togglePublish(a)}
                    title={a.status === "published" ? "Dépublier" : "Publier"}
                  >
                    {a.status === "published" ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startEdit(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
