import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ADMIN_DASHBOARD_ACTION_CARDS,
  ADMIN_DASHBOARD_STATUS_CARDS,
} from "@/lib/admin-ui/dashboard-view-model";

// Phase 8.6 Task 3: /admin dashboard skeleton.
//
// This is an orientation surface, not a reporting dashboard. Numeric
// metrics, charts, and live counters are intentionally out of scope.
// All card content is driven by `lib/admin-ui/dashboard-view-model`
// so the contract can be exercised in node:test without a renderer.

export default function AdminDashboardView() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Operasyon Paneli
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Operasyon paneli girişi. İlan yönetimine, operasyon kuyruğuna ve
          içerik yönetimine buradan ulaşırsın. Faz 8.6&apos;nın asıl işi
          ilan yönetim ekranını ürünleştirmek; bu sayfa sadece kısayol ve
          yönlendirme sağlar.
        </p>
      </header>

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

      <section
        aria-labelledby="admin-dashboard-status"
        className="flex flex-col gap-3"
      >
        <h3
          id="admin-dashboard-status"
          className="text-sm font-medium text-muted-foreground"
        >
          Operasyon yüzeyleri
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {ADMIN_DASHBOARD_STATUS_CARDS.map((card) => (
            <Card
              key={card.title}
              className="flex h-full flex-col justify-between"
            >
              <CardHeader>
                <CardTitle className="text-base">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={card.cta.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {card.cta.label}
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
