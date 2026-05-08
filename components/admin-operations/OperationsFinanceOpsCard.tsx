"use client";

import { Landmark } from "lucide-react";

import type { OperationsFinanceStatus } from "@/lib/admin-ui/operations-controller.ts";
import type { OperationsFinanceOpsViewModel } from "@/lib/admin-ui/operations-view-model.ts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FINANCE_ACTIONS: Array<{
  status: OperationsFinanceStatus;
  label: string;
  variant: "default" | "outline" | "destructive";
}> = [
  { status: "refund_requested", label: "İptal talebini onayla", variant: "default" },
  { status: "deposit_forfeited", label: "İptal talebini reddet", variant: "destructive" },
  { status: "refund_completed", label: "İadeyi tamamladım", variant: "default" },
  { status: "manual_resolution_required", label: "Kontrol sürüyor", variant: "outline" },
  { status: "conflict_payment", label: "Kontrol sürüyor", variant: "outline" },
  { status: "issue_resolved", label: "Ödeme alındı, devam et", variant: "default" },
  { status: "payment_not_received", label: "Ödeme alınmadı, süreci kapat", variant: "destructive" },
];

export function OperationsFinanceOpsCard({
  financeOps,
  disabled,
  noteText,
  noteError,
  pendingStatus,
  onApproveRefundRequest,
  onNoteChange,
  onUpdate,
}: {
  financeOps: OperationsFinanceOpsViewModel | null;
  disabled: boolean;
  noteText: string;
  noteError?: string | null;
  pendingStatus: OperationsFinanceStatus | null;
  onApproveRefundRequest: () => void;
  onNoteChange: (value: string) => void;
  onUpdate: (status: OperationsFinanceStatus) => void;
}) {
  const statusLabel = financeOps?.statusLabel ?? "Finans kararı yok";
  const recommendedLabel = formatRecommendedStatus(financeOps?.recommendedStatus ?? null);
  const adminNote = financeOps?.adminNote ?? "Not yok";
  const adminDisplayText = financeOps?.adminDisplayText ?? "Admin";
  const updatedAt = formatDateTime(financeOps?.updatedAt ?? null);
  const issueLabels = formatIssueLabels(financeOps);
  const badgeVariant = financeOps?.status === "conflict_payment" ? "destructive" : "secondary";
  const allowedStatuses = new Set(financeOps?.allowedStatuses ?? []);
  const visibleActions = FINANCE_ACTIONS.filter((action) => allowedStatuses.has(action.status));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4 text-muted-foreground" aria-hidden />
          İade / Ödeme Takibi
        </CardTitle>
        <Badge variant={badgeVariant}>{statusLabel}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 text-sm md:grid-cols-5">
          <MetaItem label="Sipariş" value={financeOps?.orderId ?? "-"} />
          <MetaItem label="Ödeme" value={financeOps?.paymentId ?? "-"} />
          <MetaItem label="Öneri" value={recommendedLabel} />
          <MetaItem label="Son güncelleme" value={updatedAt} />
          <MetaItem label="Admin" value={adminDisplayText} />
        </div>

        {issueLabels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {issueLabels.map((issue) => (
              <Badge key={issue} variant="destructive">{issue}</Badge>
            ))}
          </div>
        )}

        {financeOps?.status === "refund_required" && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            Müşterinin iptal / iade talebi alındı. İnceleme sonucuna göre talebi onaylayabilir
            veya reddedebilirsin.
          </p>
        )}

        {financeOps?.status === "refund_requested" && (
          <p className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-sm leading-relaxed text-blue-900 dark:text-blue-100">
            Müşteriye ödemeyi gerçek hayatta yaptıktan sonra buradan iadeyi tamamlandı olarak
            işaretle. Böylece manuel iade süreci kapanır.
          </p>
        )}

        {(financeOps?.status === "manual_resolution_required" || financeOps?.status === "conflict_payment") && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            Banka/muhasebe kontrolü sonucu paranın hesaba geçip geçmediğini seç. Ödeme alındıysa belge süreci başlar;
            ödeme alınmadıysa rezervasyon kapanır ve ilan tekrar yayına döner.
          </p>
        )}

        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">Son not</p>
          <p className="rounded-md border bg-muted/30 p-3 text-sm">{adminNote}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="finance-ops-note">Admin notu</Label>
          <Textarea
            id="finance-ops-note"
            value={noteText}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Bu işlem için admin notu"
            disabled={disabled || pendingStatus !== null}
            aria-invalid={Boolean(noteError)}
            aria-describedby={noteError ? "finance-ops-note-error" : undefined}
          />
          {noteError && (
            <p id="finance-ops-note-error" className="text-sm font-medium text-destructive">
              {noteError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleActions.map((action) => (
            <Button
              key={action.status}
              type="button"
              variant={action.variant}
              size="sm"
              disabled={disabled || pendingStatus !== null}
              onClick={() => {
                if (financeOps?.status === "refund_required" && action.status === "refund_requested") {
                  onApproveRefundRequest();
                  return;
                }

                onUpdate(action.status);
              }}
            >
              {pendingStatus === action.status ? "İşleniyor..." : action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function formatIssueLabels(financeOps: OperationsFinanceOpsViewModel | null): string[] {
  if (!financeOps) {
    return [];
  }

  const labels: string[] = [];
  if (financeOps.issueFlags.amountDrift) labels.push("Tutar uyumsuzluğu");
  if (financeOps.issueFlags.ownershipDrift) labels.push("Kayıt eşleşmesi sorunlu");
  if (financeOps.issueFlags.missingPayment) labels.push("Ödeme kaydı yok");
  return labels;
}

function formatRecommendedStatus(value: string | null): string {
  if (!value) {
    return "-";
  }

  const map: Record<string, string> = {
    refund_required: "İade gerekli",
    refund_requested: "Manuel iade bekliyor",
    refund_completed: "İade tamamlandı",
    deposit_forfeited: "Kapora iade edilmeyecek",
    manual_resolution_required: "Ödeme sorunu",
    conflict_payment: "Ödeme sorunu",
    issue_resolved: "Ödeme sorunu çözüldü",
    payment_not_received: "Ödeme alınmadı",
  };

  return map[value] ?? value;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
