import { Linkedin, Mail, MessageCircle, Phone, User } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import type { PublicConsultant } from "@/types/consultant";

export function ConsultantCard({ consultant }: { consultant: PublicConsultant }) {
  const hasActions = Boolean(
    consultant.phone || consultant.email || consultant.whatsappUrl || consultant.linkedinUrl,
  );

  return (
    <article className="group flex h-full overflow-hidden rounded-lg bg-property-surface shadow-property transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative hidden w-40 shrink-0 overflow-hidden bg-[#EAF6FF] sm:block">
        {consultant.photoUrl ? (
          <Image
            src={consultant.photoUrl}
            alt={consultant.fullName}
            fill
            sizes="160px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#2F73F2]">
            <User className="h-16 w-16" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-6">
        <div className="mb-5 flex gap-4 sm:hidden">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[#EAF6FF]">
            {consultant.photoUrl ? (
              <Image
                src={consultant.photoUrl}
                alt={consultant.fullName}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#2F73F2]">
                <User className="h-10 w-10" aria-hidden="true" />
              </div>
            )}
          </div>
          <ConsultantHeading consultant={consultant} />
        </div>

        <div className="hidden sm:block">
          <ConsultantHeading consultant={consultant} />
        </div>

        {consultant.shortBio ? (
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-property-gray">
            {consultant.shortBio}
          </p>
        ) : null}

        {hasActions ? (
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[#E5EDF5] pt-5 dark:border-[#1E2D3D]">
            {consultant.phone ? (
              <ConsultantAction href={`tel:${consultant.phone.replace(/[^0-9+]/g, "")}`} label="Telefonla ara">
                <Phone className="h-4 w-4" aria-hidden="true" />
              </ConsultantAction>
            ) : null}
            {consultant.email ? (
              <ConsultantAction href={`mailto:${consultant.email}`} label="E-posta gönder">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </ConsultantAction>
            ) : null}
            {consultant.whatsappUrl ? (
              <ConsultantAction href={consultant.whatsappUrl} label="WhatsApp'tan yaz" external>
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
              </ConsultantAction>
            ) : null}
            {consultant.linkedinUrl ? (
              <ConsultantAction href={consultant.linkedinUrl} label="LinkedIn profilini aç" external>
                <Linkedin className="h-4 w-4" aria-hidden="true" />
              </ConsultantAction>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ConsultantHeading({ consultant }: { consultant: PublicConsultant }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-property-midnight dark:text-white">
        {consultant.fullName}
      </h2>
      {consultant.title ? (
        <p className="mt-1 text-sm font-semibold uppercase text-[#2F73F2]">
          {consultant.title}
        </p>
      ) : null}
    </div>
  );
}

function ConsultantAction({
  children,
  external = false,
  href,
  label,
}: {
  children: ReactNode;
  external?: boolean;
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E4EF] text-[#5B7288] transition hover:border-[#2F73F2] hover:bg-[#2F73F2] hover:text-white dark:border-[#243447] dark:text-[#AAB7C4]"
    >
      {children}
    </a>
  );
}
