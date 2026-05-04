import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConsultantsPageHeaderProps = {
  disabled: boolean;
  onCreateClick: () => void;
};

export default function ConsultantsPageHeader({
  disabled,
  onCreateClick,
}: ConsultantsPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-balance">
          Danışmanlar
        </h1>
        <p className="text-sm text-muted-foreground text-pretty max-w-xl">
          Danışman profillerini oluşturun, düzenleyin ve yayın durumunu yönetin.
          İçerik Payload üzerinden kaydedilir; erişim custom admin proxy
          katmanından geçer.
        </p>
      </div>
      <Button disabled={disabled} onClick={onCreateClick}>
        <UserPlus className="size-4" aria-hidden="true" />
        Yeni danışman
      </Button>
    </header>
  );
}
