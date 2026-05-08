import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT_MAP: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  Beklemede: "warning",
  "Onaylandı": "success",
  "Başarılı": "success",
  "Tamamlandı": "success",
  "Kiralandı / Sözleşme tamamlandı": "success",
  "Sözleşme tamamlandı / kesinleşti": "success",
  "Ödeme sonrası tutuluyor / yayında değil": "warning",
  "İptal edildi": "destructive",
  "Başarısız": "destructive",
  "Uyuşmazlık": "destructive",
  "İade edildi": "secondary",
  "Süresi doldu": "secondary",
  Aktif: "success",
  Pasif: "secondary",
  Bilinmiyor: "secondary",
  Yok: "outline",
  pending: "warning",
  confirmed: "success",
  succeeded: "success",
  completed: "success",
  cancelled: "destructive",
  failed: "destructive",
  refunded: "secondary",
  conflict: "destructive",
  expired: "secondary",
  active: "success",
  passive: "secondary",
  unknown: "secondary",
};

export function OperationsStatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT_MAP[status] ?? "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
