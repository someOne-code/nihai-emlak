"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ADMIN_DASHBOARD_ACTION_CARDS,
  buildAdminDashboardMetricCards,
} from "@/lib/admin-ui/dashboard-view-model";
import {
  AdminDashboardClientError,
  fetchAdminDashboardSummary,
} from "@/lib/admin-ui/dashboard-client";
import type { AdminDashboardSummaryDto } from "@/lib/admin-ui/dashboard-summary-view-model";

// Phase 8.6 Task 3: /admin dashboard skeleton.
//
// This is an orientation surface, not a reporting dashboard. Numeric
// metrics, charts, and live counters are intentionally out of scope.
// All card content is driven by `lib/admin-ui/dashboard-view-model`
// so the contract can be exercised in node:test without a renderer.

export default function AdminDashboardView() {
  const [summary, setSummary] = useState<AdminDashboardSummaryDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextSummary = await fetchAdminDashboardSummary();
      setSummary(nextSummary);
    } catch (error: unknown) {
      const message =
        error instanceof AdminDashboardClientError
          ? error.message
          : "Dashboard metrikleri şu anda alınamıyor.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const metricCards = summary ? buildAdminDashboardMetricCards(summary) : [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Operasyon Paneli
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Operasyon ekibinin canlı metrik görünümü. İlan sağlığı, checkout
          hazırlığı ve operasyon kuyruğu özetini buradan izleyebilirsin.
        </p>
      </header>

      <section
        aria-labelledby="admin-dashboard-metrics"
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h3
            id="admin-dashboard-metrics"
            className="text-sm font-medium text-muted-foreground"
          >
            Canlı metrikler
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadSummary();
            }}
            disabled={isLoading}
          >
            Yenile
          </Button>
        </div>

        {errorMessage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metrikler alınamadı</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                type="button"
                onClick={() => {
                  void loadSummary();
                }}
              >
                Tekrar dene
              </Button>
            </CardFooter>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={`dashboard-loading-${index}`} className="flex h-full flex-col justify-between">
                <CardHeader>
                  <CardDescription className="h-4 w-24 rounded bg-muted" />
                  <CardTitle className="h-8 w-16 rounded bg-muted text-transparent">
                    000
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-4 w-full rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((card) => (
              <Card
                key={card.title}
                className="flex h-full flex-col justify-between"
              >
                <CardHeader>
                  <CardDescription>{card.title}</CardDescription>
                  <CardTitle
                    className={
                      card.isNull
                        ? "text-sm font-normal italic text-muted-foreground"
                        : "text-3xl"
                    }
                  >
                    {card.valueText}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                  <Link
                    href={card.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {card.ctaLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="admin-dashboard-actions"
        className="flex flex-col gap-3"
      >
        <h3
          id="admin-dashboard-actions"
          className="text-sm font-medium text-muted-foreground"
        >
          Hızlı erişim
        </h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_DASHBOARD_ACTION_CARDS.map((card) => (
            <Card
              key={card.href}
              className="flex h-full flex-col justify-between"
            >
              <CardHeader>
                <CardTitle className="text-base">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {card.ctaLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
