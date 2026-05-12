"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Briefcase, Phone, Upload, User } from "lucide-react";

import {
  ContentAdminClientError,
  createAdminConsultant,
  deleteAdminConsultant,
  updateAdminConsultant,
  uploadConsultantPhoto,
} from "@/lib/admin-ui/content-client";
import {
  loadConsultantsModel,
  loadContentDetailModel,
} from "@/lib/admin-ui/content-controller";
import {
  createContentLoadGuard,
  shouldStartContentLoad,
} from "@/lib/admin-ui/content-load-guard";
import {
  createContentRefreshGate,
  refreshContentViews,
  shouldRefreshContentOnResume,
} from "@/lib/admin-ui/content-refresh";
import type {
  ConsultantsListViewModel,
  ConsultantDetail,
  ConsultantRow as ConsultantRowType,
} from "@/lib/admin-ui/content-view-model";
import {
  type ConsultantFormSlugState,
  CONSULTANTS_EMPTY_TEXT,
  CONSULTANTS_FILTERED_EMPTY_TEXT,
  SLUG_FIELD_LABEL,
  SLUG_FIELD_HELPER,
  IS_PUBLISHED_LABELS,
  PHOTO_FIELD_LABEL,
  PHOTO_HELPER_TEXT,
  PHOTO_UPLOAD_TEXT,
  PHOTO_REPLACE_TEXT,
  PHOTO_UPLOADED_STATUS,
  computeSlugFromFullName,
  computeSlugFromManualEdit,
  buildConsultantCreatePayload,
  buildConsultantUpdatePayload,
} from "@/lib/admin-ui/content-consultants-ui-helpers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AdminField,
  AdminFormSection,
  adminLayout,
  safeErrorMessage,
} from "@/components/admin-content-shared";

import ConsultantsPageHeader from "./ConsultantsPageHeader";
import ConsultantsList from "./ConsultantsList";

// ── Types ──────────────────────────────────────────────────────────────────────

const INITIAL_VM: ConsultantsListViewModel = {
  rows: [],
  total: 0,
  page: 1,
  totalPages: 0,
  isEmpty: true,
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminConsultantsView() {
  const [viewModel, setViewModel] =
    useState<ConsultantsListViewModel>(INITIAL_VM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConsultantDetail | null>(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const mountedRef = useRef(true);
  const initialListLoadGuardRef = useRef(createContentLoadGuard());
  const resumeRefreshGateRef = useRef(createContentRefreshGate());
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const vm = await loadConsultantsModel();
      if (!mountedRef.current) return;
      setViewModel(vm);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(safeErrorMessage(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shouldStartContentLoad(initialListLoadGuardRef.current)) {
      return;
    }

    loadList();
  }, [loadList]);

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      if (!shouldRefreshContentOnResume(resumeRefreshGateRef.current)) {
        return;
      }

      void refreshContentViews([() => loadList()]);
    };

    window.addEventListener("focus", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      window.removeEventListener("focus", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [loadList]);

  const loadConsultantDetail = useCallback(async (consultantId: string) => {
    const result = await loadContentDetailModel("consultants", consultantId);
    if (!mountedRef.current) return;
    setDetail(result?.type === "consultant" ? result.detail : null);
  }, []);

  const handleSelectConsultant = useCallback((row: ConsultantRowType) => {
    setActionError(null);
    setActionSuccess(null);
    setSelectedId(row.id);
    setShowCreate(false);
    setDetail(row.detail);
    setDetailLoading(false);
  }, []);

  const refreshAfterMutation = useCallback(
    async (consultantId: string | null, message: string) => {
      setActionSuccess(message);
      setActionError(null);
      if (consultantId) {
        setSelectedId(consultantId);
        setDetailLoading(true);
      }

      try {
        await refreshContentViews([
          () => loadList(),
          ...(consultantId ? [() => loadConsultantDetail(consultantId)] : []),
        ]);
      } finally {
        if (consultantId && mountedRef.current) setDetailLoading(false);
      }
    },
    [loadList, loadConsultantDetail],
  );

  const runAction = useCallback(
    async (successMsg: string, action: () => Promise<string | null>) => {
      setBusy(true);
      setActionError(null);
      setActionSuccess(null);
      try {
        const refreshTarget = await action();
        if (!mountedRef.current) return;
        await refreshAfterMutation(refreshTarget, successMsg);
      } catch (err) {
        if (!mountedRef.current) return;
        setActionError(safeErrorMessage(err));
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [refreshAfterMutation],
  );

  const hasActiveFilter = search.trim().length > 0;
  const filteredRows = hasActiveFilter
    ? viewModel.rows.filter((row) =>
        row.fullName.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : viewModel.rows;
  const shouldRenderDetailPanel =
    showCreate || detail || detailLoading || filteredRows.length > 0;

  // ── Loading / error screens ────────────────────────────────────────────────

  if (loading && viewModel.rows.length === 0) {
    return (
      <div className={adminLayout.container}>
        <ConsultantsPageHeader
          disabled
          onCreateClick={() => setShowCreate(true)}
        />
        <p className={adminLayout.loadingText}>Yükleniyor...</p>
      </div>
    );
  }

  if (error && viewModel.rows.length === 0) {
    return (
      <div className={adminLayout.container}>
        <ConsultantsPageHeader
          disabled
          onCreateClick={() => setShowCreate(true)}
        />
        <div className={adminLayout.errorBanner}>{error}</div>
        <div>
          <Button variant="outline" size="sm" onClick={() => loadList()}>
            Tekrar dene
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={adminLayout.container}>
      <ConsultantsPageHeader
        disabled={busy || loading}
        onCreateClick={() => {
          setShowCreate(true);
          setSelectedId(null);
          setDetail(null);
        }}
      />

      {(error || actionError) && (
        <div className={adminLayout.errorBanner}>{error ?? actionError}</div>
      )}
      {actionSuccess && (
        <div className={adminLayout.successBanner}>{actionSuccess}</div>
      )}

      <div className={adminLayout.workspace}>
        <ConsultantsList
          rowsCount={filteredRows.length}
          loading={loading}
          emptyTitle={hasActiveFilter ? "Sonuç yok" : "Henüz danışman yok"}
          emptyText={
            hasActiveFilter
              ? CONSULTANTS_FILTERED_EMPTY_TEXT
              : CONSULTANTS_EMPTY_TEXT
          }
          toolbar={
            <Input
              type="search"
              placeholder="Ada göre ara..."
              value={search}
              disabled={busy || loading}
              className="h-8 text-xs"
              onChange={(e) => setSearch(e.target.value)}
            />
          }
        >
          {filteredRows.map((row) => (
            <ConsultantRowItem
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              onSelect={handleSelectConsultant}
            />
          ))}
        </ConsultantsList>

        {shouldRenderDetailPanel && (
        <section className={adminLayout.detailPanel}>
          {showCreate && (
            <CreateConsultantPanel
              busy={busy}
              onCancel={() => setShowCreate(false)}
              onCreate={(payload) =>
                runAction("Danışman oluşturuldu.", async () => {
                  await createAdminConsultant(payload);
                  setShowCreate(false);
                  return null;
                })
              }
            />
          )}

          {!showCreate && detail && (
            <EditConsultantPanel
              key={`edit-${detail.id}`}
              detail={detail}
              busy={busy || detailLoading}
              onSave={(payload) =>
                runAction("Danışman güncellendi.", async () => {
                  await updateAdminConsultant(detail.id, payload);
                  return detail.id;
                })
              }
              onDelete={() =>
                runAction("Danışman silindi.", async () => {
                  await deleteAdminConsultant(detail.id);
                  setDetail(null);
                  setSelectedId(null);
                  return null;
                })
              }
            />
          )}

          {!showCreate && !detail && !detailLoading && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
              <div
                className="flex size-12 items-center justify-center rounded-xl border bg-muted text-2xl"
                aria-hidden="true"
              >
                👤
              </div>
              <h3 className="text-sm font-semibold">Danışman seçilmedi</h3>
              <p className="max-w-xs text-xs text-muted-foreground">
                Detayı görüntülemek için soldan bir danışman seçin veya yeni bir
                danışman oluşturun.
              </p>
            </div>
          )}

          {detailLoading && (
            <div className="rounded-xl border bg-card p-5">
              <p className={adminLayout.loadingText}>Yükleniyor...</p>
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  );
}

// ── Consultant row item ────────────────────────────────────────────────────────

function ConsultantRowItem({
  row,
  selected,
  onSelect,
}: {
  row: ConsultantRowType;
  selected: boolean;
  onSelect: (row: ConsultantRowType) => void;
}) {
  const initials = row.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(row)}
      className={selected ? adminLayout.listItemSelected : adminLayout.listItem}
    >
      <div className={adminLayout.listItemHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-flex size-7 min-w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-[0.6rem] font-bold uppercase text-blue-600 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400"
            aria-hidden="true"
          >
            {initials || "?"}
          </span>
          <h3 className={adminLayout.listItemTitle}>{row.fullName}</h3>
        </div>
        <PublishBadge isPublishedLabel={row.isPublishedLabel} />
      </div>
      <div className={adminLayout.listItemMeta}>
        <span className="inline-flex items-center gap-1">
          <Briefcase className="size-3 opacity-60" aria-hidden="true" />
          {row.titleLabel}
        </span>
        <span>Sıra: {row.sortOrder}</span>
      </div>
    </button>
  );
}

// ── Publish badge ──────────────────────────────────────────────────────────────

function PublishBadge({ isPublishedLabel }: { isPublishedLabel: string }) {
  const variant =
    isPublishedLabel === IS_PUBLISHED_LABELS.published ? "success" : "warning";
  return <Badge variant={variant}>{isPublishedLabel}</Badge>;
}

// ── Create consultant panel ────────────────────────────────────────────────────

function CreateConsultantPanel({
  busy,
  onCancel,
  onCreate,
}: {
  busy: boolean;
  onCancel: () => void;
  onCreate: (payload: Record<string, unknown>) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [slugState, setSlugState] = useState<ConsultantFormSlugState>({
    slug: "",
    slugManuallyEdited: false,
  });
  const [title, setTitle] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [shortBio, setShortBio] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedSort = parseInt(sortOrder, 10);
    onCreate(
      buildConsultantCreatePayload({
        fullName: fullName.trim(),
        slugState,
        title: title.trim() || null,
        photoUrl: photoUrl.trim() || null,
        shortBio: shortBio.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        whatsappUrl: whatsappUrl.trim() || null,
        linkedinUrl: linkedinUrl.trim() || null,
        isPublished,
        sortOrder: Number.isFinite(parsedSort) ? parsedSort : 0,
      }),
    );
  };

  return (
    <div className={adminLayout.cardPadded}>
      <div className={adminLayout.cardHeader}>
        <h2 className={adminLayout.cardTitle}>Yeni danışman</h2>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          İptal
        </Button>
      </div>
      <form onSubmit={handleSubmit} className={adminLayout.formGrid}>
        <AdminField label="Ad Soyad *">
          <Input
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setSlugState((prev) =>
                computeSlugFromFullName(e.target.value, prev),
              );
            }}
            required
            placeholder="Örn. Ahmet Yılmaz"
          />
        </AdminField>
        <AdminField label={SLUG_FIELD_LABEL} hint={SLUG_FIELD_HELPER}>
          <Input
            value={slugState.slug}
            onChange={(e) =>
              setSlugState(computeSlugFromManualEdit(e.target.value))
            }
            placeholder="otomatik oluşturulacak"
          />
        </AdminField>
        <AdminField label="Unvan">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn. Yatırım Danışmanı"
          />
        </AdminField>
        <AdminField label={PHOTO_FIELD_LABEL} fullWidth>
          <ConsultantPhotoUpload
            currentUrl={photoUrl}
            disabled={busy}
            onUploaded={setPhotoUrl}
          />
        </AdminField>
        <AdminField label="Kısa biyografi" fullWidth>
          <Textarea
            value={shortBio}
            onChange={(e) => setShortBio(e.target.value)}
            rows={3}
            placeholder="Kısa biyografi (isteğe bağlı)"
          />
        </AdminField>
        <AdminFormSection
          label="İletişim"
          icon={<Phone className="size-3" />}
        />
        <AdminField label="Telefon">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+90 ..."
          />
        </AdminField>
        <AdminField label="E-posta">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ad@example.com"
          />
        </AdminField>
        <AdminField label="WhatsApp linki">
          <Input
            value={whatsappUrl}
            onChange={(e) => setWhatsappUrl(e.target.value)}
            placeholder="https://wa.me/..."
          />
        </AdminField>
        <AdminField label="LinkedIn linki">
          <Input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/..."
          />
        </AdminField>
        <AdminFormSection label="Yayın" icon={<User className="size-3" />} />
        <AdminField label="Sıra numarası">
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            min={0}
          />
        </AdminField>
        <AdminField label="Durum">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            {IS_PUBLISHED_LABELS.published} (frontend&apos;de görünür)
          </label>
        </AdminField>
        <div className={adminLayout.buttonRow}>
          <Button type="submit" disabled={busy}>
            Oluştur
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Edit consultant panel ──────────────────────────────────────────────────────

function EditConsultantPanel({
  detail,
  busy,
  onSave,
  onDelete,
}: {
  detail: ConsultantDetail;
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [fullName, setFullName] = useState(detail.fullName);
  const [slug, setSlug] = useState(detail.slug);
  const [title, setTitle] = useState(detail.title ?? "");
  const [photoUrl, setPhotoUrl] = useState(detail.photoUrl ?? "");
  const [shortBio, setShortBio] = useState(detail.shortBio ?? "");
  const [phone, setPhone] = useState(detail.phone ?? "");
  const [email, setEmail] = useState(detail.email ?? "");
  const [whatsappUrl, setWhatsappUrl] = useState(detail.whatsappUrl ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(detail.linkedinUrl ?? "");
  const [isPublished, setIsPublished] = useState(detail.isPublished);
  const [sortOrder, setSortOrder] = useState(String(detail.sortOrder));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedSort = parseInt(sortOrder, 10);
    onSave(
      buildConsultantUpdatePayload({
        fullName: fullName.trim(),
        slug: slug.trim(),
        title: title.trim() || null,
        photoUrl: photoUrl.trim() || null,
        shortBio: shortBio.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        whatsappUrl: whatsappUrl.trim() || null,
        linkedinUrl: linkedinUrl.trim() || null,
        isPublished,
        sortOrder: Number.isFinite(parsedSort) ? parsedSort : 0,
      }),
    );
  };

  return (
    <div className={adminLayout.cardPadded}>
      <div className={adminLayout.cardHeader}>
        <h2 className={adminLayout.cardTitle}>{detail.fullName}</h2>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          Sil
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Bu danışmanı silmek istediğinizden emin misiniz?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Bu işlem geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(false)}
            disabled={busy}
          >
            Vazgeç
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={busy}>
            Evet, sil
          </Button>
        </AlertDialogFooter>
      </AlertDialog>

      <form onSubmit={handleSubmit} className={adminLayout.formGrid}>
        <AdminField label="Ad Soyad *">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </AdminField>
        <AdminField label={SLUG_FIELD_LABEL} hint={SLUG_FIELD_HELPER}>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </AdminField>
        <AdminField label="Unvan">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </AdminField>
        <AdminField label={PHOTO_FIELD_LABEL} fullWidth>
          <ConsultantPhotoUpload
            currentUrl={photoUrl}
            disabled={busy}
            onUploaded={setPhotoUrl}
          />
        </AdminField>
        <AdminField label="Kısa biyografi" fullWidth>
          <Textarea
            value={shortBio}
            onChange={(e) => setShortBio(e.target.value)}
            rows={3}
          />
        </AdminField>
        <AdminFormSection
          label="İletişim"
          icon={<Phone className="size-3" />}
        />
        <AdminField label="Telefon">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </AdminField>
        <AdminField label="E-posta">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AdminField>
        <AdminField label="WhatsApp linki">
          <Input
            value={whatsappUrl}
            onChange={(e) => setWhatsappUrl(e.target.value)}
          />
        </AdminField>
        <AdminField label="LinkedIn linki">
          <Input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
        </AdminField>
        <AdminFormSection label="Yayın" icon={<User className="size-3" />} />
        <AdminField label="Sıra numarası">
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            min={0}
          />
        </AdminField>
        <AdminField label="Durum">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            {IS_PUBLISHED_LABELS.published} (frontend&apos;de görünür)
          </label>
        </AdminField>
        <div className={adminLayout.buttonRow}>
          <Button type="submit" disabled={busy}>
            Kaydet
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Consultant photo upload ────────────────────────────────────────────────────

function ConsultantPhotoUpload({
  currentUrl,
  disabled,
  onUploaded,
}: {
  currentUrl: string;
  disabled: boolean;
  onUploaded: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await uploadConsultantPhoto(file);
      onUploaded(url);
    } catch (err) {
      setUploadError(
        err instanceof ContentAdminClientError
          ? err.message
          : "Fotoğraf yüklenemedi.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {currentUrl && (
        <div className="relative size-[120px] overflow-hidden rounded-full border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt="Danışman fotoğrafı"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={(e) => {
            e.preventDefault();
            fileInputRef.current?.click();
          }}
        >
          <Upload className="size-3.5" aria-hidden="true" />
          {uploading
            ? "Yükleniyor..."
            : currentUrl
              ? PHOTO_REPLACE_TEXT
              : PHOTO_UPLOAD_TEXT}
        </Button>
        {!uploading && currentUrl && (
          <span className="text-xs text-muted-foreground">
            {PHOTO_UPLOADED_STATUS}
          </span>
        )}
      </div>
      <p className="text-[0.72rem] text-muted-foreground">
        {PHOTO_HELPER_TEXT}
      </p>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  );
}
