// Phase 8.6 Task 3: admin dashboard skeleton view-model.
//
// Pure, framework-free helper module. Lists the orientation surfaces
// the /admin landing page advertises. The dashboard intentionally
// avoids live metrics so it does not depend on new RPCs or routes;
// when real metrics arrive they belong in a separate task with their
// own DB/RPC contract.

export type AdminDashboardActionCard = {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly ctaLabel: string;
};

export type AdminDashboardStatusCard = {
  readonly title: string;
  readonly description: string;
  readonly cta: {
    readonly label: string;
    readonly href: string;
  };
};

export const ADMIN_DASHBOARD_ACTION_CARDS: ReadonlyArray<AdminDashboardActionCard> =
  Object.freeze([
    Object.freeze({
      title: "İlan Yönetimi",
      description:
        "İlan, görsel, ana ödeme kalemi ve ek hizmet konfigürasyonunu yönet.",
      href: "/admin/listings",
      ctaLabel: "İlanlara git",
    }),
    Object.freeze({
      title: "Operasyonlar",
      description:
        "Rezervasyon, sipariş, ödeme ve olay akışını operasyon ekibi için izle.",
      href: "/admin/operations",
      ctaLabel: "Operasyonlara git",
    }),
    Object.freeze({
      title: "CMS İçerik Yönetimi",
      description:
        "Blog yazıları, kategoriler ve danışman profilleri için Payload içerik yönetimi.",
      href: "/cms",
      ctaLabel: "CMS'e git",
    }),
  ]);

export const ADMIN_DASHBOARD_STATUS_CARDS: ReadonlyArray<AdminDashboardStatusCard> =
  Object.freeze([
    Object.freeze({
      title: "İlan yapılandırması",
      description:
        "Listeleme bilgileri, görseller ve fiyat kalemlerinin tek noktadan kontrolü buradadır.",
      cta: Object.freeze({
        label: "İlan listesine git",
        href: "/admin/listings",
      }),
    }),
    Object.freeze({
      title: "Checkout hazırlığı",
      description:
        "Kiralık ilanların ana ödeme kalemi ve ek hizmet eşlemeleri checkout için hazır mı, ilan ekranından kontrol et.",
      cta: Object.freeze({
        label: "Hazırlık durumunu aç",
        href: "/admin/listings",
      }),
    }),
    Object.freeze({
      title: "Ödeme ve rezervasyon operasyonu",
      description:
        "Onay, iptal ve yeniden açma gibi operasyonel iş akışları operasyon yüzeyinden yürütülür.",
      cta: Object.freeze({
        label: "Operasyon kuyruğunu aç",
        href: "/admin/operations",
      }),
    }),
    Object.freeze({
      title: "İçerik yönetimi",
      description:
        "İçerik backend'i Payload tarafında kalır; blog ve danışman içeriği için CMS arayüzünü kullan.",
      cta: Object.freeze({
        label: "CMS'e git",
        href: "/cms",
      }),
    }),
  ]);
