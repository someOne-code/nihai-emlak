"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSaleLead } from "@/lib/api/sale-leads";
import type { ApiListingDetail } from "@/types/listing";

type FormState = {
  error: string | null;
  success: string | null;
};

export function SaleLeadForm({ listing }: { listing: ApiListingDetail }) {
  const [state, setState] = useState<FormState>({ error: null, success: null });
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
        success: "Talebiniz alındı. Ekibimiz sizinle en kısa sürede iletişime geçecektir.",
      });
    } catch {
      setState({
        error: "Talebiniz gönderilirken bir sorun oluştu. Lütfen bilgilerinizi kontrol edip tekrar deneyin.",
        success: null,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      id="sale-lead-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 border-t border-slate-100 pt-2 dark:border-slate-800"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-[#102D47] dark:text-white">İletişim Talebi</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Bu ilan hakkında bilgi almak için iletişim bilgilerinizi bırakın. Ekibimiz sizinle en kısa sürede iletişime geçecektir.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sale-contact-name">Ad Soyad</Label>
        <Input
          id="sale-contact-name"
          name="contactName"
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sale-contact-phone">Telefon</Label>
        <Input
          id="sale-contact-phone"
          name="contactPhone"
          maxLength={40}
          autoComplete="tel"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sale-contact-email">E-posta</Label>
        <Input
          id="sale-contact-email"
          name="contactEmail"
          type="email"
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sale-message">Mesaj</Label>
        <Textarea
          id="sale-message"
          name="message"
          required
          minLength={5}
          maxLength={2000}
          defaultValue="Bu satılık ilan hakkında bilgi almak istiyorum."
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {state.success}
        </p>
      ) : null}

      <Button type="submit" disabled={!isHydrated || isSubmitting} className="h-12 w-full font-semibold">
        {isSubmitting ? "Gönderiliyor..." : "Talebi Gönder"}
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
  if (input.contactName.length > 120) {
    return "Ad soyad en fazla 120 karakter olabilir.";
  }
  if (input.message.length < 5) {
    return "Mesaj en az 5 karakter olmalı.";
  }
  if (input.message.length > 2000) {
    return "Mesaj en fazla 2000 karakter olabilir.";
  }
  if (input.contactPhone.length > 40) {
    return "Telefon en fazla 40 karakter olabilir.";
  }
  if (!input.contactEmail && !input.contactPhone) {
    return "Telefon veya e-posta alanlarından en az birini yazın.";
  }
  if (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
    return "Geçerli bir e-posta adresi yazın.";
  }

  return null;
}
