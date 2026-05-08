"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AdminSystemClientError,
  loadAdminSystemHealth,
} from "@/lib/admin-ui/system-client";
import {
  buildSystemHealthViewModel,
  type SystemHealthViewModel,
} from "@/lib/admin-ui/system-view-model";
import { createInitialLoadGuard, shouldStartInitialLoad } from "@/lib/admin-ui/initial-load-guard";

export default function SystemHealthView() {
  const [viewModel, setViewModel] = useState<SystemHealthViewModel | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadGuardRef = useRef(createInitialLoadGuard());

  const loadHealth = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const health = await loadAdminSystemHealth();
      setViewModel(buildSystemHealthViewModel(health));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof AdminSystemClientError
          ? error.message
          : "Sistem sağlığı bilgisi alınamadı.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shouldStartInitialLoad(initialLoadGuardRef.current)) {
      return;
    }
    void loadHealth();
  }, [loadHealth]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Sistem Sağlığı</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Dış operasyon servisleri için salt okunur hazırlık kontrolleri.
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="system-health-services">
        <div className="flex items-center justify-between gap-3">
          <h3
            id="system-health-services"
            className="text-sm font-medium text-muted-foreground"
          >
            Servisler
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadHealth();
            }}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Yenile
          </Button>
        </div>

        {errorMessage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sağlık kontrolü başarısız oldu</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </CardHeader>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((index) => (
              <Card key={`system-health-loading-${index}`}>
                <CardHeader>
                  <CardDescription className="h-4 w-24 rounded bg-muted" />
                  <CardTitle className="h-6 w-32 rounded bg-muted text-transparent">
                    Yükleniyor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-20 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(viewModel?.services ?? []).map((service) => (
              <Card key={service.key}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{service.title}</CardTitle>
                      <CardDescription>{service.description}</CardDescription>
                    </div>
                    <StatusPill status={service.status} label={service.statusLabel} />
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2">
                    {service.lastCallbackLabel ? (
                      <li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                        <span>Son callback</span>
                        <span className="text-muted-foreground">{service.lastCallbackLabel}</span>
                      </li>
                    ) : null}
                    {service.lastEventLabel ? (
                      <li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                        <span>Son event</span>
                        <span className="text-muted-foreground">{service.lastEventLabel}</span>
                      </li>
                    ) : null}
                    {service.checks.map((check) => (
                      <li
                        key={check.name}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                      >
                        <span>{check.label}</span>
                        <span
                          className={
                            check.ok
                              ? "inline-flex items-center gap-1 text-emerald-700"
                              : "inline-flex items-center gap-1 text-destructive"
                          }
                        >
                          {check.ok ? (
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                          )}
                          {check.ok ? "Yapılandırıldı" : "Kurulum gerekli"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({
  status,
  label,
}: {
  status: "ready" | "missing" | "invalid" | "degraded";
  label: string;
}) {
  const className =
    status === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "invalid"
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : status === "degraded"
          ? "border-sky-200 bg-sky-50 text-sky-800"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
