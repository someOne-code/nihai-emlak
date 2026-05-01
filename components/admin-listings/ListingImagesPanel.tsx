"use client";

import { useState, type FormEvent } from "react";

import type { AdminListingImage } from "@/lib/admin-ui/listings-view-model";

// Phase 8.6 Task 7: presentational panel for the "Görseller" tab. Owns
// no data and never calls the admin client; the parent
// (AdminListingsView) keeps mutation orchestration and passes
// onAddImage / onDeleteImage / onReorder callbacks down.
//
// The panel:
//  - keeps the existing URL-only flow (no binary upload UI)
//  - renders an explicit add box separated from the gallery
//  - renders each image as a card with thumbnail, primary badge, alt
//    text, sort order, reorder buttons, and a danger-styled delete
//  - shows an empty state when there are no images attached

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
    <div className="lstPanel">
      <div className="lstPanelHeader">
        <div className="lstGeneralPanelTitleGroup">
          <h2 className="lstPanelTitle">Görseller</h2>
          <p className="lstPanelDescription">
            İlan vitrininde kullanılacak görsel URL kayıtlarını yönet.
          </p>
        </div>
        <span className="lstOptionMeta">{images.length} görsel</span>
      </div>

      <ImageAddBox busy={busy} onAddImage={onAddImage} />

      <p className="lstHelperNote">
        Görseller harici bir yerde barındırılmalı; bu panel yalnızca URL
        kaydeder. Birincil görsel ilan kartında öne çıkar.
      </p>

      {images.length === 0 ? (
        <div className="lstEmpty">Bu ilana henüz görsel eklenmedi.</div>
      ) : (
        <div className="lstImageList">
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
    </div>
  );
}

function ImageAddBox({
  busy,
  onAddImage,
}: {
  busy: boolean;
  onAddImage: (payload: AddImagePayload) => void;
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl) return;
    onAddImage({
      image_url: trimmedUrl,
      alt_text: altText.trim() || null,
      is_primary: isPrimary,
    });
    setImageUrl("");
    setAltText("");
    setIsPrimary(false);
  };

  return (
    <form onSubmit={handleAdd} className="lstImageAddBox">
      <div className="lstField">
        <label htmlFor="lstImageAddUrl">Görsel URL</label>
        <input
          id="lstImageAddUrl"
          type="url"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="https://..."
          required
        />
      </div>
      <div className="lstField">
        <label htmlFor="lstImageAddAlt">Alternatif metin</label>
        <input
          id="lstImageAddAlt"
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          placeholder="Erişilebilirlik için kısa açıklama"
        />
      </div>
      <div className="lstField">
        <label>Birincil</label>
        <label className="lstCheckboxRow">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
          />
          <span>İlan kartında ilk göster</span>
        </label>
      </div>
      <div className="lstButtonRow" style={{ marginTop: 0 }}>
        <button
          type="submit"
          className="lstPrimaryButton"
          disabled={busy}
        >
          Görsel ekle
        </button>
      </div>
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
    <div className="lstImageCard">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.imageUrl}
        alt={image.altText ?? ""}
        className="lstImageCardThumb"
      />
      <div className="lstImageCardMeta">
        <div className="lstMainItemBadges">
          <span className="lstChip">Sıra #{image.sortOrder}</span>
          {image.isPrimary && (
            <span className="lstChip lstChipSuccess">Birincil</span>
          )}
        </div>
        <p className="lstImageCardAlt">
          {image.altText ?? "Alt metin tanımlı değil"}
        </p>
      </div>
      <div className="lstImageCardActions">
        <button
          type="button"
          className="lstSecondaryButton"
          onClick={() => onMove(-1)}
          disabled={busy || index === 0}
        >
          Yukarı
        </button>
        <button
          type="button"
          className="lstSecondaryButton"
          onClick={() => onMove(1)}
          disabled={busy || index === total - 1}
        >
          Aşağı
        </button>
        <button
          type="button"
          className="lstDangerButton"
          onClick={onDelete}
          disabled={busy}
        >
          Sil
        </button>
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
