import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ApiListingDetail } from "@/types/listing";

export function ListingChatButton({
  isAuthenticated,
  listing,
}: {
  isAuthenticated: boolean;
  listing: ApiListingDetail;
}) {
  return (
    <Button variant="outline" disabled title="Mesajlaşma yakında">
      <MessageCircle data-icon="inline-start" className="mr-2 size-4" />
      Danışmana Sor
    </Button>
  );
}
