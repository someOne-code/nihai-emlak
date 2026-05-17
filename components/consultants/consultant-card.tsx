import { Linkedin, Mail, MessageCircle, Phone, UserRound } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import type { PublicConsultant } from "@/types/consultant";

export function ConsultantCard({ consultant }: { consultant: PublicConsultant }) {
  const hasActions = Boolean(
    consultant.phone || consultant.email || consultant.whatsappUrl || consultant.linkedinUrl,
  );

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#DDEAF5] bg-property-surface shadow-[0_18px_50px_rgba(16,45,71,0.10)] transition duration-300 hover:-translate-y-1 hover:border-[#2F73F2]/30 hover:shadow-[0_26px_70px_rgba(16,45,71,0.16)] dark:border-white/10">
      <div className="bg-[linear-gradient(135deg,#EAF6FF_0%,#D1F2FF_100%)] p-5 dark:bg-[linear-gradient(135deg,#102D47_0%,#1F2A37_100%)]">
        {consultant.photoUrl ? (
          <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-[0_18px_42px_rgba(16,45,71,0.14)] dark:border-white/10 dark:bg-white/10">
            <Image
              src={consultant.photoUrl}
              alt={consultant.fullName}
              fill
              sizes="(min-width: 1536px) 260px, (min-width: 1280px) 22vw, (min-width: 768px) 36vw, 82vw"
              className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <div className="mx-auto flex aspect-square w-full max-w-[260px] items-center justify-center rounded-2xl border border-white/80 bg-white/65 text-[#2F73F2] shadow-[0_18px_42px_rgba(16,45,71,0.14)] dark:border-white/10 dark:bg-white/10">
            <div className="flex size-24 items-center justify-center rounded-full border border-white/70 bg-white/65 shadow-[0_14px_34px_rgba(16,45,71,0.12)] dark:border-white/10 dark:bg-white/10">
              <UserRound className="h-12 w-12" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <div>
          <h2 className="text-2xl font-bold leading-tight text-property-midnight transition group-hover:text-[#2F73F2] dark:text-white">
            {consultant.fullName}
          </h2>
          {consultant.title ? (
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#2F73F2]">
              {consultant.title}
            </p>
          ) : null}
        </div>

        {consultant.shortBio ? (
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-property-gray">
            {consultant.shortBio}
          </p>
        ) : null}

        {hasActions ? (
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[#E5EDF5] pt-5 dark:border-white/10">
            {consultant.phone ? (
              <ConsultantAction href={`tel:${consultant.phone.replace(/[^0-9+]/g, "")}`} label="Telefonla ara">
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span>Ara</span>
              </ConsultantAction>
            ) : null}
            {consultant.email ? (
              <ConsultantAction href={`mailto:${consultant.email}`} label="E-posta gönder">
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>E-posta</span>
              </ConsultantAction>
            ) : null}
            {consultant.whatsappUrl ? (
              <ConsultantAction href={consultant.whatsappUrl} label="WhatsApp'tan yaz" external featured>
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                <span>WhatsApp</span>
              </ConsultantAction>
            ) : null}
            {consultant.linkedinUrl ? (
              <ConsultantAction href={consultant.linkedinUrl} label="LinkedIn profilini aç" external>
                <Linkedin className="h-4 w-4" aria-hidden="true" />
                <span>LinkedIn</span>
              </ConsultantAction>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ConsultantAction({
  children,
  external = false,
  featured = false,
  href,
  label,
}: {
  children: ReactNode;
  external?: boolean;
  featured?: boolean;
  href: string;
  label: string;
}) {
  const className = featured
    ? "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#2F73F2] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(47,115,242,0.22)] transition hover:bg-blue-700"
    : "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#D8E4EF] px-4 text-sm font-semibold text-[#5B7288] transition hover:border-[#2F73F2] hover:bg-[#2F73F2] hover:text-white dark:border-white/10 dark:text-[#AAB7C4]";

  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}
