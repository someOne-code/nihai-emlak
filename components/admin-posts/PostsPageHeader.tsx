import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

type PostsPageHeaderProps = {
  disabled: boolean;
  onCreateClick: () => void;
};

export default function PostsPageHeader({
  disabled,
  onCreateClick,
}: PostsPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-balance">
          Blog Yazıları
        </h1>
        <p className="text-sm text-muted-foreground text-pretty max-w-xl">
          Blog yazılarını oluşturun, düzenleyin ve yayınlayın. İçerik doğrudan
          Payload üzerinden kaydedilir, erişim custom admin proxy katmanından
          geçer.
        </p>
      </div>
      <Button disabled={disabled} onClick={onCreateClick}>
        <PenLine className="size-4" aria-hidden="true" />
        Yeni yazı
      </Button>
    </header>
  );
}
