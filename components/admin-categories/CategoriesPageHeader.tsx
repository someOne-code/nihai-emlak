import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type CategoriesPageHeaderProps = {
  disabled: boolean;
  onCreateClick: () => void;
};

export default function CategoriesPageHeader({
  disabled,
  onCreateClick,
}: CategoriesPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-balance">
          Blog Kategorileri
        </h1>
        <p className="text-sm text-muted-foreground text-pretty max-w-xl">
          Blog kategorilerini oluşturun ve yönetin. Kategoriler Payload
          üzerinden kaydedilir; erişim custom admin proxy katmanından geçer.
        </p>
      </div>
      <Button disabled={disabled} onClick={onCreateClick}>
        <FolderPlus className="size-4" aria-hidden="true" />
        Yeni kategori
      </Button>
    </header>
  );
}
