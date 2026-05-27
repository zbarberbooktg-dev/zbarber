import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListHomeGalleryPhotos,
  useAddHomeGalleryPhoto,
  useDeleteHomeGalleryPhoto,
  useUpdateHomeGalleryPhoto,
  getListHomeGalleryPhotosQueryKey,
} from "@workspace/api-client-react";
import { Trash2, Upload, ImagePlus, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { formatApiError } from "@/lib/errors";

function resolveObjectUrl(objectPath: string): string {
  if (objectPath.startsWith("http")) return objectPath;
  if (objectPath.startsWith("/objects/")) return `/api/storage${objectPath}`;
  return objectPath;
}

export default function Gallery() {
  const { t } = useT();
  const g = t.homeGallery;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListHomeGalleryPhotos();
  const addMutation = useAddHomeGalleryPhoto();
  const delMutation = useDeleteHomeGalleryPhoto();
  const updMutation = useUpdateHomeGalleryPhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const photos = (data ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const invalidate = () => qc.invalidateQueries({ queryKey: getListHomeGalleryPhotosQueryKey() });
  const onErr = (err: unknown) => toast({ title: formatApiError(err, t.errors), variant: "destructive" as any });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const presigned = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!presigned.ok) throw new Error(g.uploadUrlFailed);
      const { uploadURL, objectPath } = await presigned.json();
      const put = await fetch(uploadURL, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) throw new Error(g.uploadFailed);

      await addMutation.mutateAsync({
        data: { imageUrl: objectPath, caption: caption.trim() || undefined, sortOrder: photos.length },
      });
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      invalidate();
    } catch (e) {
      onErr(e);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(g.confirmDelete)) return;
    try {
      await delMutation.mutateAsync({ id });
      invalidate();
    } catch (e) {
      onErr(e);
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= photos.length) return;
    const a = photos[idx];
    const b = photos[target];
    try {
      await Promise.all([
        updMutation.mutateAsync({ id: a.id, data: { sortOrder: b.sortOrder ?? target } }),
        updMutation.mutateAsync({ id: b.id, data: { sortOrder: a.sortOrder ?? idx } }),
      ]);
      invalidate();
    } catch (e) {
      onErr(e);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{g.title}</h1>
        <p className="text-sm text-muted-foreground">{g.subtitle}</p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ImagePlus className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{g.add}</h2>
        </div>
        <Input
          placeholder={g.captionPh}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? g.uploading : g.choose}
        </Button>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{g.empty}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((p, idx) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="relative aspect-square bg-muted">
                <img src={resolveObjectUrl(p.imageUrl)} alt={p.caption ?? ""} className="w-full h-full object-cover" />
              </div>
              <div className="p-3 space-y-2">
                {p.caption && <p className="text-sm truncate">{p.caption}</p>}
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => move(idx, 1)} disabled={idx === photos.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="destructive" className="ml-auto" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
