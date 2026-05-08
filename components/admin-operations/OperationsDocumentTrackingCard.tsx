"use client";

import { FileCheck2 } from "lucide-react";

import type { OperationsDocumentTrackingViewModel } from "@/lib/admin-ui/operations-view-model.ts";
import type { OperationsDocumentStatus } from "@/lib/admin-ui/operations-controller.ts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DOCUMENT_ACTIONS: Array<{
  status: OperationsDocumentStatus;
  label: string;
  description: string;
}> = [
  {
    status: "requested",
    label: "Belge istendi",
    description: "Müşteriden belge istendiğini kaydeder. Rezervasyon ve ilan durumu değişmez.",
  },
  {
    status: "waiting",
    label: "Belge bekleniyor",
    description: "Belgelerin müşteriden beklendiğini kaydeder. Rezervasyon ve ilan durumu değişmez.",
  },
  {
    status: "completed",
    label: "Belgeler tamamlandı",
    description: "Belgeler tamamlanır; rezervasyon sözleşme tamamlandı olur ve ilan kiralandı/pasif duruma geçer.",
  },
  {
    status: "failed",
    label: "Eksik/başarısız",
    description: "Belgeleri eksik veya başarısız olarak işaretler. Rezervasyon iptal olmaz ve ilan otomatik yayına alınmaz.",
  },
];

export function OperationsDocumentTrackingCard({
  documentTracking,
  disabled,
  noteText,
  noteError,
  pendingStatus,
  onNoteChange,
  onUpdate,
}: {
  documentTracking: OperationsDocumentTrackingViewModel | null;
  disabled: boolean;
  noteText: string;
  noteError?: string | null;
  pendingStatus: OperationsDocumentStatus | null;
  onNoteChange: (value: string) => void;
  onUpdate: (status: OperationsDocumentStatus) => void;
}) {
  const statusLabel = documentTracking?.statusLabel ?? "Belge istenmedi";
  const adminNote = documentTracking?.adminNote ?? "Not yok";
  const adminDisplayText = documentTracking?.adminDisplayText ?? "Admin";
  const updatedAt = formatDateTime(documentTracking?.updatedAt ?? null);
  const allowedStatuses = new Set(documentTracking?.allowedStatuses ?? []);
  const disabledReason = documentTracking?.disabledReason ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          Belge Takibi
        </CardTitle>
        <Badge variant={documentTracking?.status === "failed" ? "destructive" : "secondary"}>
          {statusLabel}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <MetaItem label="Sipariş" value={documentTracking?.orderId ?? "-"} />
          <MetaItem label="Son güncelleme" value={updatedAt} />
          <MetaItem label="Admin" value={adminDisplayText} />
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">Son not</p>
          <p className="rounded-md border bg-muted/30 p-3 text-sm">{adminNote}</p>
        </div>

        {disabledReason && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            {disabledReason}
          </p>
        )}

        <div className="grid gap-2">
          <Label htmlFor="document-tracking-note">Admin notu</Label>
          <Textarea
            id="document-tracking-note"
            value={noteText}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Belge süreci için admin notu"
            disabled={disabled || pendingStatus !== null}
            aria-invalid={Boolean(noteError)}
            aria-describedby={noteError ? "document-tracking-note-error" : undefined}
          />
          {noteError && (
            <p id="document-tracking-note-error" className="text-sm font-medium text-destructive">
              {noteError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {DOCUMENT_ACTIONS.map((action) => {
            const allowed = allowedStatuses.has(action.status);
            const description = allowed
              ? action.description
              : disabledReason ?? "Mevcut belge durumunda bu geçiş kullanılamaz.";
            return (
              <Button
                key={action.status}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || pendingStatus !== null || !allowed}
                title={description}
                onClick={() => onUpdate(action.status)}
              >
                {pendingStatus === action.status ? "İşleniyor..." : action.label}
              </Button>
            );
          })}
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
