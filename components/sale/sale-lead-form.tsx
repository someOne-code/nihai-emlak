"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSaleLead } from "@/lib/api/sale-leads";
import { getLoginRedirectUrl } from "@/lib/auth/redirect";
import type { ApiListingDetail } from "@/types/listing";

type FormState = {
  error: string | null;
  success: string | null;
};

export function SaleLeadForm({
  isAuthenticated,
  listing,
}: {
  isAuthenticated: boolean;
  listing: ApiListingDetail;
}) {
  const [state, setState] = useState<FormState>({ error: null, success: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">
          İletişim talebi göndermek için giriş yapmalısınız.
        </p>
        <Button asChild>
          <Link href={getLoginRedirectUrl(`/listings/${listing.id}`)}>Giriş Yap</Link>
        </Button>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const contactName = String(formData.get("contactName") ?? "").trim();
    const contactEmail = String(formData.get("contactEmail") ?? "").trim();
    const contactPhone = String(formData.get("contactPhone") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();

    const validationError = validateSaleLeadForm({
      contactName,
      contactEmail,
      contactPhone,
      message,
    });
    if (validationError) {
      setState({ error: validationError, success: null });
      return;
    }

    setIsSubmitting(true);
    setState({ error: null, success: null });
    try {
      await createSaleLead({
        listingId: listing.id,
        contactName,
        contactEmail,
        contactPhone,
        message,
      });
      form.reset();
      setState({
        error: null,
        success: "Talebiniz alındı. Danışmanımız sizinle iletişime geçecek.",
      });
    } catch (error) {
      setState({
        error: error instanceof Error ? error.message : "Talep gönderilemedi.",
        success: null,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="sale-contact-name">Ad Soyad</Label>
        <Input id="sale-contact-name" name="contactName" required minLength={2} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sale-contact-email">E-posta</Label>
        <Input id="sale-contact-email" name="contactEmail" type="email" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sale-contact-phone">Telefon</Label>
        <Input id="sale-contact-phone" name="contactPhone" maxLength={40} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sale-message">Mesaj</Label>
        <Textarea
          id="sale-message"
          name="message"
          required
          minLength={5}
          defaultValue="Bu satılık ilanla ilgileniyorum."
        />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-muted-foreground">{state.success}</p> : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Gönderiliyor..." : "Talep Gönder"}
      </Button>
    </form>
  );
}

function validateSaleLeadForm(input: {
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  message: string;
}): string | null {
  if (input.contactName.length < 2) {
    return "Ad soyad en az 2 karakter olmalı.";
  }
  if (input.message.length < 5) {
    return "Mesaj en az 5 karakter olmalı.";
  }
  if (input.contactPhone.length > 40) {
    return "Telefon en fazla 40 karakter olabilir.";
  }
  if (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
    return "Geçerli bir e-posta adresi yazın.";
  }

  return null;
}
