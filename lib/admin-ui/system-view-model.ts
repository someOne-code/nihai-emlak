import type {
  AdminSystemHealthDto,
  AdminSystemServiceStatus,
  AdminSystemStatus,
} from "../admin/system-route.ts";

export type SystemHealthViewModel = {
  services: SystemHealthServiceView[];
};

export type SystemHealthServiceView = {
  key: "chatwoot" | "inngest" | "supabaseDatabase" | "payload" | "storage" | "payment";
  title: string;
  description: string;
  status: AdminSystemStatus;
  statusLabel: string;
  checks: SystemHealthCheckView[];
  lastCallbackLabel?: string;
  lastEventLabel?: string;
};

export type SystemHealthCheckView = {
  name: string;
  label: string;
  ok: boolean;
};

const CHECK_LABELS: Readonly<Record<string, string>> = Object.freeze({
  CHATWOOT_BASE_URL: "Temel URL",
  CHATWOOT_INBOX_IDENTIFIER: "Gelen kutusu tanımlayıcısı",
  CHATWOOT_HMAC_TOKEN: "Kimlik HMAC anahtarı",
  CHATWOOT_ACCOUNT_ID: "Hesap ID",
  INNGEST_EVENT_KEY: "Olay anahtarı",
  INNGEST_SIGNING_KEY: "İmza anahtarı",
  SUPABASE_DB_READINESS: "Veritabanı erişimi",
  DATABASE_URI: "Payload veritabanı",
  PAYLOAD_SECRET: "Payload gizli anahtarı",
  PAYLOAD_PREFLIGHT: "Koleksiyon preflight",
  "content-media": "content-media bucket",
  NEXT_PUBLIC_SUPABASE_URL: "Supabase URL",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "Supabase publishable key",
  SUPABASE_SERVICE_ROLE_KEY: "Supabase servis anahtarı",
  ISBANK_CLIENT_ID: "Mağaza istemci ID",
  ISBANK_STORE_KEY: "Mağaza anahtarı",
});

export function buildSystemHealthViewModel(
  data: AdminSystemHealthDto,
): SystemHealthViewModel {
  return {
    services: [
      buildServiceView(
        "chatwoot",
        "Chatwoot",
        "Müşteri iletişimi hazırlığı",
        data.chatwoot,
      ),
      buildServiceView(
        "inngest",
        "Inngest",
        "Arka plan olayları hazırlığı",
        data.inngest,
      ),
      buildServiceView(
        "supabaseDatabase",
        "Supabase DB",
        "Operasyon veritabanı erişimi",
        data.supabaseDatabase,
      ),
      buildServiceView(
        "payload",
        "Payload CMS",
        "İçerik backend preflight hazırlığı",
        data.payload,
      ),
      buildServiceView(
        "storage",
        "Supabase Storage",
        "İçerik medya bucket hazırlığı",
        data.storage,
      ),
      {
        ...buildServiceView(
          "payment",
          "İş Bankası",
          "Ödeme yapılandırması ve son callback özeti",
          data.payment,
        ),
        lastCallbackLabel: data.payment.lastCallbackAt ?? "Henüz callback yok",
        lastEventLabel: formatLastPaymentEvent(data.payment.lastEvent),
      },
    ],
  };
}

function buildServiceView(
  key: SystemHealthServiceView["key"],
  title: string,
  description: string,
  service: AdminSystemServiceStatus,
): SystemHealthServiceView {
  return {
    key,
    title,
    description,
    status: service.status,
    statusLabel: formatStatus(service.status),
    checks: service.checks.map((check) => ({
      name: check.name,
      label: CHECK_LABELS[check.name] ?? check.name,
      ok: check.ok,
    })),
  };
}

function formatStatus(status: AdminSystemStatus): string {
  if (status === "ready") {
    return "Hazır";
  }
  if (status === "invalid") {
    return "Geçersiz";
  }
  if (status === "degraded") {
    return "Sınırlı";
  }
  return "Eksik";
}

function formatLastPaymentEvent(
  event: AdminSystemHealthDto["payment"]["lastEvent"],
): string {
  if (!event) {
    return "Henüz event yok";
  }
  if ("status" in event) {
    return "Event okunamadı";
  }
  return event.eventType;
}
