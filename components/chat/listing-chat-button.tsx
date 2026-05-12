"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { ListingChatPanel } from "./listing-chat-panel";
import { Button } from "@/components/ui/button";
import { getLoginRedirectUrl } from "@/lib/auth/redirect";
import type { ApiListingDetail } from "@/types/listing";

export function ListingChatButton({
  isAuthenticated,
  listing,
}: {
  isAuthenticated: boolean;
  listing: ApiListingDetail;
}) {
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <Button asChild variant="outline">
        <Link href={getLoginRedirectUrl(`/listings/${listing.id}`)}>
          <MessageCircle data-icon="inline-start" />
          Danışmana Sor
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <MessageCircle data-icon="inline-start" />
        Danışmana Sor
      </Button>
      <ListingChatPanel listing={listing} open={open} onOpenChange={setOpen} />
    </>
  );
}
