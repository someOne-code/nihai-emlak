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
  const title = isAuthenticated
    ? `${listing.title} için danışmana mesaj gönderme yakında`
    : "Danışmana mesaj göndermek için giriş gerekli";

  return (
    <Button variant="outline" disabled title={title} aria-label={title}>
      <MessageCircle data-icon="inline-start" className="mr-2 size-4" />
      Danışmana Sor
    </Button>
  );
}
