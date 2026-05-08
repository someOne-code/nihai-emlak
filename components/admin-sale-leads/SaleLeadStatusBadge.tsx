"use client";

import { Badge } from "@/components/ui/badge";
import type { SaleLeadStatus } from "@/lib/admin-ui/sale-leads-view-model";
import { SALE_LEAD_STATUS_LABELS } from "@/lib/admin-ui/sale-leads-view-model";

const STATUS_VARIANTS: Record<
  SaleLeadStatus,
  "default" | "secondary" | "destructive" | "warning" | "success"
> = {
  new: "warning",
  called: "secondary",
  meeting_planned: "default",
  not_interested: "destructive",
  closed: "success",
};

export function SaleLeadStatusBadge({ status }: { status: SaleLeadStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{SALE_LEAD_STATUS_LABELS[status]}</Badge>;
}
