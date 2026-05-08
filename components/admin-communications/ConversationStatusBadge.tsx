"use client";

import { Badge } from "@/components/ui/badge";
import type { ChatwootConversationStatus } from "@/lib/admin-ui/communications-view-model";

const STATUS_CONFIG: Record<
  ChatwootConversationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "warning" | "success" }
> = {
  ready: { label: "Hazır", variant: "success" },
  provisioning: { label: "Oluşturuluyor", variant: "warning" },
  failed: { label: "Başarısız", variant: "destructive" },
};

export function ConversationStatusBadge({ status }: { status: ChatwootConversationStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
