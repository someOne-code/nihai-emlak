"use client";

import { useCallback, useRef, useState, type DragEvent, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadListingImage } from "@/lib/admin-ui/listings-client";
import type { AdminListingImage } from "@/lib/admin-ui/listings-view-model";

// Listing images panel with direct file upload via Supabase Storage.
// Admin picks/drops image files → uploaded to Storage → URL saved to DB.

type AddImagePayload = {
  image_url: string;
  alt_text: string | null;
  is_primary: boolean;
};

export type ListingImagesPanelProps = {
  images: AdminListingImage[];
  busy: boolean;
  onAddImage: (payload: AddImagePayload) => void;
  onDeleteImage: (imageId: string) => void;
  onReorder: (orderedIds: string[]) => void;
};

export default function ListingImagesPanel({
  images,
  busy,
  onAddImage,
  onDeleteImage,
  onReorder,
}: ListingImagesPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Görseller</CardTitle>
            <CardDescription>
              İlan görsellerini ekleyin ve sıralayın. Birincil görsel ilan kartında öne çıkar.
            </CardDescription>
          </div>
          <Badge variant="outline">{images.length} görsel</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ImageUploadBox busy={busy} onAddImage={onAddImage} />

        {images.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Bu ilana henüz görsel eklenmedi.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {images.map((image, index) => (
              <ImageCard
                key={image.id}
                image={image}
                index={index}
                total={images.length}
                busy={busy}
                onMove={(direction) =>
                  moveImage(images, index, direction, onReorder)
                }
                onDelete={() => onDeleteImage(image.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

function ImageUploadBox({
  busy,
  onAddImage,
}: {
  busy: boolean;
  onAddImage: (payload: AddImagePayload) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const selectFile = useCallback((file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  }, []);

  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setAltText("");
    setIsPrimary(false);
    setUploadError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [preview]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) selectFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) selectFile(file);
  };

  const handleUploadAndAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || uploading || busy) return;

    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadListingImage(selectedFile);
      onAddImage({
        image_url: result.url,
        alt_text: altText.trim() || null,
        is_primary: isPrimary,
      });
      resetForm();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Yükleme başarısız.");
    } finally {
      setUploading(false);
    }
  };

  const isDisabled = busy || uploading;

  return (
    <form onSubmit={handleUploadAndAdd} className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isDisabled && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : preview
              ? "border-border bg-card"
              : "border-muted-foreground/25 bg-muted/30 hover:border-primary/40 hover:bg-muted/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          disabled={isDisabled}
          className="sr-only"
        />

        {preview ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Önizleme"
              className="max-h-40 rounded-md object-contain"
            />
            <p className="text-xs text-muted-foreground">
              {selectedFile?.name} — Değiştirmek için tıkla veya sürükle
            </p>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Fotoğraf sürükle veya tıkla
              </p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                JPEG, PNG veya WebP • Maks. 5 MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Options row */}
      {selectedFile && (
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <Label htmlFor="imgUploadAlt">Açıklama (opsiyonel)</Label>
            <Input
              id="imgUploadAlt"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Kısa açıklama"
              disabled={isDisabled}
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer pb-1">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              disabled={isDisabled}
              className="h-4 w-4 rounded border-input"
            />
            <span>Birincil görsel</span>
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
              disabled={isDisabled}
            >
              Vazgeç
            </Button>
            <Button type="submit" size="sm" disabled={isDisabled || !selectedFile}>
              {uploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…</>
              ) : (
                <><ImagePlus className="h-4 w-4" /> Yükle</>
              )}
            </Button>
          </div>
        </div>
      )}

      {uploadError && (
        <p className="text-sm text-destructive">{uploadError}</p>
      )}
    </form>
  );
}

function ImageCard({
  image,
  index,
  total,
  busy,
  onMove,
  onDelete,
}: {
  image: AdminListingImage;
  index: number;
  total: number;
  busy: boolean;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.imageUrl}
        alt={image.altText ?? ""}
        className="w-full aspect-[4/3] object-cover bg-muted"
      />
      <div className="p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px] tabular-nums">Sıra #{image.sortOrder}</Badge>
          {image.isPrimary && (
            <Badge variant="success" className="text-[10px]">Birincil</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {image.altText ?? "Açıklama yok"}
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMove(-1)}
            disabled={busy || index === 0}
            className="h-7 px-2"
            aria-label="Yukarı taşı"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMove(1)}
            disabled={busy || index === total - 1}
            className="h-7 px-2"
            aria-label="Aşağı taşı"
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={busy}
            className="h-7 px-2 ml-auto"
            aria-label="Görseli sil"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function moveImage(
  images: AdminListingImage[],
  index: number,
  direction: -1 | 1,
  onReorder: (orderedIds: string[]) => void,
) {
  const next = [...images];
  const target = index + direction;
  if (target < 0 || target >= next.length) return;
  const tmp = next[index];
  next[index] = next[target];
  next[target] = tmp;
  onReorder(next.map((image) => image.id));
}
