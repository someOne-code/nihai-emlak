"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  OperationsActionId,
  OperationsActionViewModel,
} from "@/lib/admin-ui/operations-view-model";

export type OperationsActionPanelProps = {
  actions: OperationsActionViewModel[];
  actionPending: OperationsActionId | null;
  noteText: string;
  noteError?: string | null;
  refundDecision: "manual_refund" | "no_refund";
  onRefundDecisionChange: (value: "manual_refund" | "no_refund") => void;
  onNoteChange: (value: string) => void;
  onExecute: (actionId: OperationsActionId) => void;
};

const ACTION_VARIANT_MAP: Record<OperationsActionId, "destructive" | "default" | "outline"> = {
  cancel: "destructive",
  confirm: "default",
  reopen: "outline",
};

export function OperationsActionPanel({
  actions,
  actionPending,
  noteText,
  noteError,
  refundDecision,
  onRefundDecisionChange,
  onNoteChange,
  onExecute,
}: OperationsActionPanelProps) {
  const [cancelOpen, setCancelOpen] = useState(false);

  if (actions.length === 0) {
    return null;
  }

  const enabledLabels = actions.filter((a) => a.enabled).map((a) => a.label);
  const eligibilityMessage =
    enabledLabels.length === 0
      ? "Bu kayıtta yapılacak manuel işlem yok. Pasif butonların üstüne gelerek nedenini görebilirsin."
      : `Şu anda yapılabilecek işlemler: ${enabledLabels.join(", ")}.`;
  const cancelAction = actions.find((action) => action.id === "cancel");
  const otherActions = actions.filter((action) => action.id !== "cancel");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aksiyonlar</CardTitle>
        <p className="text-sm text-muted-foreground">{eligibilityMessage}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="ops-note" className="text-sm font-medium text-muted-foreground">
            Admin notu
          </label>
          <Textarea
            id="ops-note"
            value={noteText}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="İşlem notu"
            disabled={actionPending !== null}
            aria-invalid={Boolean(noteError)}
            aria-describedby={noteError ? "ops-note-error" : undefined}
          />
          {noteError && (
            <p id="ops-note-error" className="text-sm font-medium text-destructive">
              {noteError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cancelAction && (
            <div className="group relative">
              <Button
                variant="destructive"
                className="w-full"
                disabled={actionPending !== null || !cancelAction.enabled}
                title={cancelAction.disabledReason ?? undefined}
                onClick={() => setCancelOpen(true)}
              >
                {actionPending === "cancel" ? "İşleniyor..." : cancelAction.label}
              </Button>
              {!cancelAction.enabled && cancelAction.disabledReason && actionPending !== "cancel" && (
                <DisabledActionTooltip reason={cancelAction.disabledReason} />
              )}
            </div>
          )}

          {otherActions.map((action) => (
            <div key={action.id} className="group relative">
              <Button
                variant={ACTION_VARIANT_MAP[action.id]}
                className="w-full"
                disabled={actionPending !== null || !action.enabled}
                title={action.disabledReason ?? undefined}
                onClick={() => onExecute(action.id)}
              >
                {actionPending === action.id ? "İşleniyor..." : action.label}
              </Button>
              {!action.enabled && action.disabledReason && actionPending !== action.id && (
                <DisabledActionTooltip reason={action.disabledReason} />
              )}
            </div>
          ))}
        </div>

        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogHeader>
            <AlertDialogTitle>Rezervasyonu iptal et</AlertDialogTitle>
            <AlertDialogDescription>
              Rezervasyon iptal edilecek ve ilan tekrar yayına alınacak. İade yapılacak mı?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <input
                type="radio"
                name="refund-decision"
                className="mt-1"
                checked={refundDecision === "manual_refund"}
                onChange={() => onRefundDecisionChange("manual_refund")}
              />
              <span>
                <span className="block font-medium">Evet, manuel iade yapılacak</span>
                <span className="text-muted-foreground">
                  Rezervasyon kapanır, ilan yayına alınır ve kayıt manuel iade kuyruğuna düşer.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <input
                type="radio"
                name="refund-decision"
                className="mt-1"
                checked={refundDecision === "no_refund"}
                onChange={() => onRefundDecisionChange("no_refund")}
              />
              <span>
                <span className="block font-medium">Hayır, iade yapılmayacak</span>
                <span className="text-muted-foreground">
                  Rezervasyon kapanır ve ilan yayına alınır; manuel iade işi oluşmaz.
                </span>
              </span>
            </label>
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={actionPending !== null}
              onClick={() => {
                onExecute("cancel");
                setCancelOpen(false);
              }}
            >
              İptal et
            </Button>
          </AlertDialogFooter>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function DisabledActionTooltip({ reason }: { reason: string }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-min min-w-72 max-w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 space-y-1 rounded-md border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-lg group-hover:block group-focus-within:block">
      <p>
        <span className="font-medium text-foreground">Sebep:</span> {reason}
      </p>
      <p>
        <span className="font-medium text-foreground">Sonraki adım:</span> {getNextStepForDisabledReason(reason)}
      </p>
    </div>
  );
}

function getNextStepForDisabledReason(reason: string): string {
  const normalized = reason.toLocaleLowerCase("tr-TR");

  if (normalized.includes("ödeme") || normalized.includes("banka")) {
    return "Ödeme sonucu netleşmeden bu işlemi ilerletme; önce banka ödeme durumunu kontrol et.";
  }

  if (normalized.includes("iptal") || normalized.includes("kapalı") || normalized.includes("terminal")) {
    return "Bu kayıt kapanmış görünüyor; gerekiyorsa ilgili ilan veya yeni rezervasyon üzerinden devam et.";
  }

  if (normalized.includes("başka bir rezervasyon") || normalized.includes("başka tamamlanmış")) {
    return "Aynı ilana bağlı diğer rezervasyonu kontrol et; çakışma çözülmeden sözleşme tamamlanamaz.";
  }

  if (normalized.includes("ilan")) {
    return "İlan durumunu kontrol et; ilan uygun duruma gelmeden bu işlem çalışmaz.";
  }

  return "Önce ödeme, iade veya belge tarafındaki açık işi kapat; sonra bu aksiyonu tekrar dene.";
}
