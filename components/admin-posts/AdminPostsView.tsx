"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Upload } from "lucide-react";

import {
  ContentAdminClientError,
  createAdminPost,
  updateAdminPost,
  deleteAdminPost,
  fetchAdminCategoryOptions,
  uploadBlogCoverImage,
} from "@/lib/admin-ui/content-client";
import {
  loadPostsModel,
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
import {
  type PostsListViewModel,
  type PostRow as PostRowType,
  type PostDetail,
} from "@/lib/admin-ui/content-view-model";
import {
  type PostsListFilters,
  type PostStatusFilter,
  type PostFormSlugState,
  POST_STATUS_OPTIONS,
  POST_STATUS_FORM_OPTIONS,
  POSTS_EMPTY_TEXT,
  POSTS_FILTERED_EMPTY_TEXT,
  SLUG_FIELD_LABEL,
  SLUG_FIELD_HELPER,
  COVER_IMAGE_UPLOAD_TEXT,
  COVER_IMAGE_REPLACE_TEXT,
  COVER_IMAGE_RATIO_HINT,
  COVER_IMAGE_FILE_RULES,
  COVER_IMAGE_UPLOADED_STATUS,
  SEO_TITLE_HELPER,
  SEO_DESCRIPTION_HELPER,
  computeSlugFromTitle,
  computeSlugFromManualEdit,
  buildPostCreatePayload,
  buildPostUpdatePayload,
} from "@/lib/admin-ui/content-posts-ui-helpers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

import PostsPageHeader from "./PostsPageHeader";
import PostsList from "./PostsList";

// ── Types ──────────────────────────────────────────────────────────────────────

type FilterState = {
  search: string;
  status: PostStatusFilter;
  category: string;
};

type CategoryOption = { id: string; title: string };

const INITIAL_FILTERS: FilterState = { search: "", status: "", category: "" };

const INITIAL_VM: PostsListViewModel = {
  rows: [],
  total: 0,
  page: 1,
  totalPages: 0,
  isEmpty: true,
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminPostsView() {
  const [viewModel, setViewModel] = useState<PostsListViewModel>(INITIAL_VM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const mountedRef = useRef(true);
  const initialListLoadGuardRef = useRef(createContentLoadGuard());
  const categoryLoadGuardRef = useRef(createContentLoadGuard());
  const resumeRefreshGateRef = useRef(createContentRefreshGate());
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshCategoryOptions = useCallback(async () => {
    try {
      const raw = await fetchAdminCategoryOptions();
      if (!mountedRef.current) return;
      if (Array.isArray(raw)) {
        const opts: CategoryOption[] = (raw as unknown[])
          .filter(
            (item): item is Record<string, unknown> =>
              typeof item === "object" && item !== null,
          )
          .map((item) => ({
            id: String(item.id ?? ""),
            title: String(item.title ?? ""),
          }));
        setCategories(opts);
      }
    } catch {
      // Non-fatal: category select will keep the last loaded options.
    }
  }, []);

  // Load category options once for filters, then refresh again when create opens.
  useEffect(() => {
    if (!shouldStartContentLoad(categoryLoadGuardRef.current)) {
      return;
    }

    void refreshCategoryOptions();
  }, [refreshCategoryOptions]);

  const loadList = useCallback(async (nextFilters: FilterState) => {
    setLoading(true);
    setError(null);
    try {
      const apiFilters: PostsListFilters = {};
      if (nextFilters.search) apiFilters.search = nextFilters.search;
      if (nextFilters.status) apiFilters.status = nextFilters.status;
      if (nextFilters.category) apiFilters.category = nextFilters.category;
      const vm = await loadPostsModel(undefined, apiFilters);
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

    loadList(INITIAL_FILTERS);
  }, [loadList]);

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      if (!shouldRefreshContentOnResume(resumeRefreshGateRef.current)) {
        return;
      }

      void refreshContentViews([
        () => loadList(filters),
        () => refreshCategoryOptions(),
      ]);
    };

    window.addEventListener("focus", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      window.removeEventListener("focus", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [filters, loadList, refreshCategoryOptions]);

  const loadPostDetail = useCallback(async (postId: string) => {
    const result = await loadContentDetailModel("posts", postId);
    if (!mountedRef.current) return;
    setDetail(result?.type === "post" ? result.detail : null);
  }, []);

  const handleSelectPost = useCallback(async (postId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setSelectedId(postId);
    setShowCreate(false);
    setDetailLoading(true);
    try {
      await loadPostDetail(postId);
    } catch (err) {
      if (!mountedRef.current) return;
      setActionError(safeErrorMessage(err));
    } finally {
      if (mountedRef.current) setDetailLoading(false);
    }
  }, [loadPostDetail]);

  const handleApplyFilters = useCallback(
    (nextFilters: FilterState) => {
      setFilters(nextFilters);
      loadList(nextFilters);
    },
    [loadList],
  );

  const openCreatePostPanel = useCallback(() => {
    setShowCreate(true);
    setSelectedId(null);
    setDetail(null);
    void refreshCategoryOptions();
  }, [refreshCategoryOptions]);

  const refreshAfterMutation = useCallback(
    async (postId: string | null, message: string) => {
      setActionSuccess(message);
      setActionError(null);
      if (postId) {
        setSelectedId(postId);
        setDetailLoading(true);
      }

      try {
        await refreshContentViews([
          () => loadList(filters),
          ...(postId ? [() => loadPostDetail(postId)] : []),
        ]);
      } finally {
        if (postId && mountedRef.current) setDetailLoading(false);
      }
    },
    [filters, loadList, loadPostDetail],
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

  // ── Loading / error screens ────────────────────────────────────────────────

  if (loading && viewModel.rows.length === 0) {
    return (
      <div className={adminLayout.container}>
        <PostsPageHeader disabled onCreateClick={() => setShowCreate(true)} />
        <p className={adminLayout.loadingText}>Yükleniyor...</p>
      </div>
    );
  }

  if (error && viewModel.rows.length === 0) {
    return (
      <div className={adminLayout.container}>
        <PostsPageHeader disabled onCreateClick={() => setShowCreate(true)} />
        <div className={adminLayout.errorBanner}>{error}</div>
        <div>
          <Button variant="outline" size="sm" onClick={() => loadList(filters)}>
            Tekrar dene
          </Button>
        </div>
      </div>
    );
  }

  const hasActiveFilter =
    !!filters.search || !!filters.status || !!filters.category;
  const shouldRenderDetailPanel =
    showCreate || detail || detailLoading || viewModel.rows.length > 0;

  return (
    <div className={adminLayout.container}>
      <PostsPageHeader
        disabled={busy || loading}
        onCreateClick={openCreatePostPanel}
      />

      {(error || actionError) && (
        <div className={adminLayout.errorBanner}>{error ?? actionError}</div>
      )}
      {actionSuccess && (
        <div className={adminLayout.successBanner}>{actionSuccess}</div>
      )}

      <div className={adminLayout.workspace}>
        <PostsList
          rowsCount={viewModel.rows.length}
          loading={loading}
          emptyTitle={hasActiveFilter ? "Sonuç yok" : "Henüz yazı yok"}
          emptyText={
            hasActiveFilter ? POSTS_FILTERED_EMPTY_TEXT : POSTS_EMPTY_TEXT
          }
          toolbar={
            <FilterControls
              filters={filters}
              categories={categories}
              disabled={busy || loading}
              onChange={handleApplyFilters}
            />
          }
        >
          {viewModel.rows.map((row) => (
            <PostRowItem
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              onSelect={handleSelectPost}
            />
          ))}
        </PostsList>

        {shouldRenderDetailPanel && (
          <section className={adminLayout.detailPanel}>
            {showCreate && (
              <CreatePostPanel
                busy={busy}
                categories={categories}
                onCancel={() => setShowCreate(false)}
                onCreate={(payload) =>
                  runAction("Yazı oluşturuldu.", async () => {
                    await createAdminPost(payload);
                    setShowCreate(false);
                    return null;
                  })
                }
              />
            )}

            {!showCreate && detail && (
              <EditPostPanel
                key={`edit-${detail.id}`}
                detail={detail}
                busy={busy || detailLoading}
                categories={categories}
                onSave={(payload) =>
                  runAction("Yazı güncellendi.", async () => {
                    await updateAdminPost(detail.id, payload);
                    return detail.id;
                  })
                }
                onDelete={() =>
                  runAction("Yazı silindi.", async () => {
                    await deleteAdminPost(detail.id);
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
                  ✎
                </div>
                <h3 className="text-sm font-semibold">Yazı seçilmedi</h3>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Detayı görüntülemek için soldan bir yazı seçin veya yeni bir
                  yazı oluşturun.
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

// ── Filter controls ────────────────────────────────────────────────────────────

function FilterControls({
  filters,
  categories,
  disabled,
  onChange,
}: {
  filters: FilterState;
  categories: CategoryOption[];
  disabled: boolean;
  onChange: (f: FilterState) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Input
        type="search"
        placeholder="Başlıkta ara..."
        value={filters.search}
        disabled={disabled}
        className="h-8 min-w-[140px] flex-[2] text-xs"
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <Select
        value={filters.status}
        disabled={disabled}
        className="h-8 min-w-[120px] flex-1 text-xs"
        onChange={(e) =>
          onChange({ ...filters, status: e.target.value as PostStatusFilter })
        }
      >
        {POST_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <Select
        value={filters.category}
        disabled={disabled || categories.length === 0}
        className="h-8 min-w-[120px] flex-1 text-xs"
        aria-label="Kategori filtresi"
        onChange={(e) => onChange({ ...filters, category: e.target.value })}
      >
        <option value="">Tüm kategoriler</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.title}
          </option>
        ))}
      </Select>
    </div>
  );
}

// ── Post row item ──────────────────────────────────────────────────────────────

function PostRowItem({
  row,
  selected,
  onSelect,
}: {
  row: PostRowType;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row.id)}
      className={selected ? adminLayout.listItemSelected : adminLayout.listItem}
    >
      <div className={adminLayout.listItemHeader}>
        <h3 className={adminLayout.listItemTitle}>{row.title}</h3>
        <StatusBadge statusLabel={row.statusLabel} />
      </div>
      <div className={adminLayout.listItemMeta}>
        <span>{row.categoryLabel}</span>
        {row.publishedAt && <span>{formatDate(row.publishedAt)}</span>}
      </div>
    </button>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ statusLabel }: { statusLabel: string }) {
  const variant =
    statusLabel === "Yayında"
      ? "success"
      : statusLabel === "Taslak"
        ? "warning"
        : "secondary";
  return <Badge variant={variant}>{statusLabel}</Badge>;
}

// ── Create post panel ──────────────────────────────────────────────────────────

function CreatePostPanel({
  busy,
  categories,
  onCancel,
  onCreate,
}: {
  busy: boolean;
  categories: CategoryOption[];
  onCancel: () => void;
  onCreate: (payload: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState("");
  const [slugState, setSlugState] = useState<PostFormSlugState>({
    slug: "",
    slugManuallyEdited: false,
  });
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [publishedAt, setPublishedAt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onCreate(
      buildPostCreatePayload({
        title: title.trim(),
        slugState,
        content: content.trim(),
        excerpt: excerpt.trim() || null,
        category: categoryId || null,
        status,
        publishedAt: publishedAt || null,
        coverImageUrl: coverImageUrl.trim() || null,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
      }),
    );
  };

  return (
    <div className={adminLayout.cardPadded}>
      <div className={adminLayout.cardHeader}>
        <h2 className={adminLayout.cardTitle}>Yeni yazı</h2>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          İptal
        </Button>
      </div>
      <form onSubmit={handleSubmit} className={adminLayout.formGrid}>
        <AdminField label="Başlık *">
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSlugState((prev) =>
                computeSlugFromTitle(e.target.value, prev),
              );
            }}
            required
            placeholder="Yazı başlığı"
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
        <AdminField label="Özet" fullWidth>
          <Textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            placeholder="Kısa özet (isteğe bağlı)"
          />
        </AdminField>
        <AdminField label="İçerik" fullWidth>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Yazı içeriği"
            required
          />
        </AdminField>
        <AdminField label="Kategori">
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— Kategori seç —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))}
          </Select>
        </AdminField>
        <AdminField label="Durum">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published")}
          >
            {POST_STATUS_FORM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </AdminField>
        <AdminFormSection label="Yayın ve SEO" />
        <AdminField label="Yayın tarihi">
          <Input
            type="date"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
          />
        </AdminField>
        <AdminField label="Kapak görseli" fullWidth>
          <CoverImageUpload
            currentUrl={coverImageUrl}
            disabled={busy}
            onUploaded={setCoverImageUrl}
          />
        </AdminField>
        <AdminField label="SEO başlığı" fullWidth hint={SEO_TITLE_HELPER}>
          <Input
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
          />
        </AdminField>
        <AdminField
          label="SEO açıklaması"
          fullWidth
          hint={SEO_DESCRIPTION_HELPER}
        >
          <Textarea
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            rows={2}
          />
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

// ── Edit post panel ────────────────────────────────────────────────────────────

function EditPostPanel({
  detail,
  busy,
  categories,
  onSave,
  onDelete,
}: {
  detail: PostDetail;
  busy: boolean;
  categories: CategoryOption[];
  onSave: (payload: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(detail.title);
  const [slug, setSlug] = useState(detail.slug);
  const [excerpt, setExcerpt] = useState(detail.excerpt ?? "");
  const [content, setContent] = useState(detail.content);
  const [categoryId, setCategoryId] = useState(detail.category?.id ?? "");
  const [status, setStatus] = useState<"draft" | "published">(
    detail.status === "published" ? "published" : "draft",
  );
  const [publishedAt, setPublishedAt] = useState(
    detail.publishedAt ? detail.publishedAt.slice(0, 10) : "",
  );
  const [coverImageUrl, setCoverImageUrl] = useState(
    detail.coverImageUrl ?? "",
  );
  const [seoTitle, setSeoTitle] = useState(detail.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    detail.seoDescription ?? "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave(
      buildPostUpdatePayload({
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        content: content.trim(),
        category: categoryId || null,
        status,
        publishedAt: publishedAt || null,
        coverImageUrl: coverImageUrl.trim() || null,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
      }),
    );
  };

  return (
    <div className={adminLayout.cardPadded}>
      <div className={adminLayout.cardHeader}>
        <h2 className={adminLayout.cardTitle}>Yazıyı düzenle</h2>
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
            Bu yazıyı silmek istediğinizden emin misiniz?
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
        <AdminField label="Başlık *">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </AdminField>
        <AdminField label={SLUG_FIELD_LABEL} hint={SLUG_FIELD_HELPER}>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="url-adi"
          />
        </AdminField>
        <AdminField label="Özet" fullWidth>
          <Textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
          />
        </AdminField>
        <AdminField label="İçerik" fullWidth>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            required
          />
        </AdminField>
        <AdminField label="Kategori">
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— Kategori seç —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))}
          </Select>
        </AdminField>
        <AdminField label="Durum">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published")}
          >
            {POST_STATUS_FORM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </AdminField>
        <AdminField label="Yayın tarihi">
          <Input
            type="date"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
          />
        </AdminField>
        <AdminField label="Kapak görseli" fullWidth>
          <CoverImageUpload
            currentUrl={coverImageUrl}
            disabled={busy}
            onUploaded={setCoverImageUrl}
          />
        </AdminField>
        <AdminFormSection label="SEO" />
        <AdminField label="SEO başlığı" fullWidth hint={SEO_TITLE_HELPER}>
          <Input
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
          />
        </AdminField>
        <AdminField
          label="SEO açıklaması"
          fullWidth
          hint={SEO_DESCRIPTION_HELPER}
        >
          <Textarea
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            rows={2}
          />
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

// ── Cover image upload ─────────────────────────────────────────────────────────

function CoverImageUpload({
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
      const url = await uploadBlogCoverImage(file);
      onUploaded(url);
    } catch (err) {
      setUploadError(
        err instanceof ContentAdminClientError
          ? err.message
          : "Görsel yüklenemedi.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {currentUrl && (
        <div className="relative aspect-video w-full max-w-[360px] overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt="Kapak görseli önizleme"
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
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-3.5" aria-hidden="true" />
          {uploading
            ? "Yükleniyor..."
            : currentUrl
              ? COVER_IMAGE_REPLACE_TEXT
              : COVER_IMAGE_UPLOAD_TEXT}
        </Button>
        {!uploading && currentUrl && (
          <span className="text-xs text-muted-foreground">
            {COVER_IMAGE_UPLOADED_STATUS}
          </span>
        )}
      </div>
      <p className="text-[0.72rem] text-muted-foreground">
        {COVER_IMAGE_RATIO_HINT}
      </p>
      <p className="text-[0.72rem] text-muted-foreground">
        {COVER_IMAGE_FILE_RULES}
      </p>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  );
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}
