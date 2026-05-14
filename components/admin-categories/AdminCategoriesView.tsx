"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  createAdminCategory,
  deleteAdminCategory,
  updateAdminCategory,
} from "@/lib/admin-ui/content-client";
import {
  loadCategoriesModel,
  loadContentDetailModel,
  refreshContentModelAfterMutation,
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
  CategoriesListViewModel,
  CategoryDetail,
  CategoryRow as CategoryRowType,
} from "@/lib/admin-ui/content-view-model";
import {
  type CategoryFormSlugState,
  CATEGORIES_EMPTY_TEXT,
  CATEGORIES_FILTERED_EMPTY_TEXT,
  SLUG_FIELD_LABEL,
  SLUG_FIELD_HELPER,
  IS_ACTIVE_LABELS,
  computeSlugFromTitle,
  computeSlugFromManualEdit,
  buildCategoryCreatePayload,
  buildCategoryUpdatePayload,
} from "@/lib/admin-ui/content-categories-ui-helpers";

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
  adminLayout,
  safeErrorMessage,
} from "@/components/admin-content-shared";

import CategoriesPageHeader from "./CategoriesPageHeader";
import CategoriesList from "./CategoriesList";

// ── Types ──────────────────────────────────────────────────────────────────────

const INITIAL_VM: CategoriesListViewModel = {
  rows: [],
  total: 0,
  page: 1,
  totalPages: 0,
  isEmpty: true,
};

type CategoryMutationRefreshTarget =
  | string
  | null
  | {
      categoryId: string | null;
      document?: unknown;
      reuseList?: boolean;
    };

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminCategoriesView() {
  const [viewModel, setViewModel] =
    useState<CategoriesListViewModel>(INITIAL_VM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
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
      const vm = await loadCategoriesModel();
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

  const loadCategoryDetail = useCallback(async (categoryId: string) => {
    const result = await loadContentDetailModel("categories", categoryId);
    if (!mountedRef.current) return;
    setDetail(result?.type === "category" ? result.detail : null);
  }, []);

  const handleSelectCategory = useCallback((row: CategoryRowType) => {
    setActionError(null);
    setActionSuccess(null);
    setSelectedId(row.id);
    setShowCreate(false);
    setDetail(row.detail);
    setDetailLoading(false);
    void loadCategoryDetail(row.id);
  }, [loadCategoryDetail]);

  const refreshAfterMutation = useCallback(
    async (target: CategoryMutationRefreshTarget, message: string) => {
      const refreshTarget = normalizeCategoryMutationRefreshTarget(target);
      setActionSuccess(message);
      setActionError(null);
      if (refreshTarget.categoryId) {
        setSelectedId(refreshTarget.categoryId);
        setDetailLoading(true);
      }

      try {
        const categoryId = refreshTarget.categoryId;
        if (refreshTarget.reuseList && refreshTarget.document !== undefined) {
          const result = refreshContentModelAfterMutation(
            "categories",
            viewModel,
            refreshTarget.document,
          );
          setViewModel(result.model);
          setDetail(result.detail);
          return;
        }

        await refreshContentViews([
          () => loadList(),
          ...(categoryId ? [() => loadCategoryDetail(categoryId)] : []),
        ]);
      } finally {
        if (refreshTarget.categoryId && mountedRef.current) setDetailLoading(false);
      }
    },
    [loadList, loadCategoryDetail, viewModel],
  );

  const runAction = useCallback(
    async (successMsg: string, action: () => Promise<CategoryMutationRefreshTarget>) => {
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
        row.title.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : viewModel.rows;
  const shouldRenderDetailPanel =
    showCreate || detail || detailLoading || filteredRows.length > 0;

  // ── Loading / error screens ────────────────────────────────────────────────

  if (loading && viewModel.rows.length === 0) {
    return (
      <div className={adminLayout.container}>
        <CategoriesPageHeader
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
        <CategoriesPageHeader
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
      <CategoriesPageHeader
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
        <CategoriesList
          rowsCount={filteredRows.length}
          loading={loading}
          emptyTitle={hasActiveFilter ? "Sonuç yok" : "Henüz kategori yok"}
          emptyText={
            hasActiveFilter
              ? CATEGORIES_FILTERED_EMPTY_TEXT
              : CATEGORIES_EMPTY_TEXT
          }
          toolbar={
            <Input
              type="search"
              placeholder="Başlıkta ara..."
              value={search}
              disabled={busy || loading}
              className="h-8 text-xs"
              onChange={(e) => setSearch(e.target.value)}
            />
          }
        >
          {filteredRows.map((row) => (
            <CategoryRowItem
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              onSelect={handleSelectCategory}
            />
          ))}
        </CategoriesList>

        {shouldRenderDetailPanel && (
        <section className={adminLayout.detailPanel}>
          {showCreate && (
            <CreateCategoryPanel
              busy={busy}
              onCancel={() => setShowCreate(false)}
              onCreate={(payload) =>
                runAction("Kategori oluşturuldu.", async () => {
                  await createAdminCategory(payload);
                  setShowCreate(false);
                  return null;
                })
              }
            />
          )}

          {!showCreate && detail && (
            <EditCategoryPanel
              key={`edit-${detail.id}`}
              detail={detail}
              busy={busy || detailLoading}
              onSave={(payload) =>
                runAction("Kategori güncellendi.", async () => {
                  const document = await updateAdminCategory(detail.id, payload);
                  return { categoryId: detail.id, document, reuseList: true };
                })
              }
              onDelete={() =>
                runAction("Kategori silindi.", async () => {
                  await deleteAdminCategory(detail.id);
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
                🗂️
              </div>
              <h3 className="text-sm font-semibold">Kategori seçilmedi</h3>
              <p className="max-w-xs text-xs text-muted-foreground">
                Detayı görüntülemek için soldan bir kategori seçin veya yeni bir
                kategori oluşturun.
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

// ── Category row item ──────────────────────────────────────────────────────────

function CategoryRowItem({
  row,
  selected,
  onSelect,
}: {
  row: CategoryRowType;
  selected: boolean;
  onSelect: (row: CategoryRowType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row)}
      className={selected ? adminLayout.listItemSelected : adminLayout.listItem}
    >
      <div className={adminLayout.listItemHeader}>
        <h3 className={adminLayout.listItemTitle}>{row.title}</h3>
        <ActiveBadge isActiveLabel={row.isActiveLabel} />
      </div>
      <div className={adminLayout.listItemMeta}>
        <span>Sıra: {row.sortOrder}</span>
      </div>
    </button>
  );
}

// ── Active badge ───────────────────────────────────────────────────────────────

function ActiveBadge({ isActiveLabel }: { isActiveLabel: string }) {
  const variant =
    isActiveLabel === IS_ACTIVE_LABELS.active ? "success" : "destructive";
  return <Badge variant={variant}>{isActiveLabel}</Badge>;
}

// ── Create category panel ──────────────────────────────────────────────────────

function CreateCategoryPanel({
  busy,
  onCancel,
  onCreate,
}: {
  busy: boolean;
  onCancel: () => void;
  onCreate: (payload: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState("");
  const [slugState, setSlugState] = useState<CategoryFormSlugState>({
    slug: "",
    slugManuallyEdited: false,
  });
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedSort = parseInt(sortOrder, 10);
    onCreate(
      buildCategoryCreatePayload({
        title: title.trim(),
        slugState,
        description: description.trim() || null,
        isActive,
        sortOrder: Number.isFinite(parsedSort) ? parsedSort : 0,
      }),
    );
  };

  return (
    <div className={adminLayout.cardPadded}>
      <div className={adminLayout.cardHeader}>
        <h2 className={adminLayout.cardTitle}>Yeni kategori</h2>
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
            placeholder="Kategori başlığı"
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
        <AdminField label="Açıklama" fullWidth>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Kategori açıklaması (isteğe bağlı)"
          />
        </AdminField>
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
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {IS_ACTIVE_LABELS.active} (liste ve frontend&apos;de görünür)
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

// ── Edit category panel ────────────────────────────────────────────────────────

function EditCategoryPanel({
  detail,
  busy,
  onSave,
  onDelete,
}: {
  detail: CategoryDetail;
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(detail.title);
  const [slug, setSlug] = useState(detail.slug);
  const [description, setDescription] = useState(detail.description ?? "");
  const [isActive, setIsActive] = useState(detail.isActive);
  const [sortOrder, setSortOrder] = useState(String(detail.sortOrder));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedSort = parseInt(sortOrder, 10);
    onSave(
      buildCategoryUpdatePayload({
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        isActive,
        sortOrder: Number.isFinite(parsedSort) ? parsedSort : 0,
      }),
    );
  };

  return (
    <div className={adminLayout.cardPadded}>
      <div className={adminLayout.cardHeader}>
        <h2 className={adminLayout.cardTitle}>{detail.title}</h2>
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
            Bu kategoriyi silmek istediğinizden emin misiniz?
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
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </AdminField>
        <AdminField label="Açıklama" fullWidth>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </AdminField>
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
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {IS_ACTIVE_LABELS.active} (liste ve frontend&apos;de görünür)
          </label>
        </AdminField>
        <section className="space-y-3 rounded-md border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Bağlı blog yazıları</h3>
            <span className="text-xs text-muted-foreground">
              {detail.linkedPosts.length} yazı
            </span>
          </div>
          {detail.linkedPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bu kategoriye bağlı yazı yok.
            </p>
          ) : (
            <ul className="space-y-2">
              {detail.linkedPosts.map((post) => (
                <li
                  key={post.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm font-medium">
                    {post.title}
                  </span>
                  <Badge
                    variant={
                      post.statusLabel === "Yayında" ? "success" : "secondary"
                    }
                  >
                    {post.statusLabel}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className={adminLayout.buttonRow}>
          <Button type="submit" disabled={busy}>
            Kaydet
          </Button>
        </div>
      </form>
    </div>
  );
}

function normalizeCategoryMutationRefreshTarget(target: CategoryMutationRefreshTarget): {
  categoryId: string | null;
  document?: unknown;
  reuseList?: boolean;
} {
  if (typeof target === "string" || target === null) {
    return { categoryId: target };
  }

  return target;
}
