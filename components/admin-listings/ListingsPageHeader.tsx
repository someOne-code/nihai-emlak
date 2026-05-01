"use client";

// Phase 8.6 Task 4: presentational page header for /admin/listings.
//
// Owns no data and never calls Supabase or admin client helpers.
// AdminListingsView remains responsible for data fetching and
// orchestration; this component only renders the page intro and the
// "Yeni ilan" entry point.

type ListingsPageHeaderProps = {
  disabled: boolean;
  onCreateClick: () => void;
};

export default function ListingsPageHeader({
  disabled,
  onCreateClick,
}: ListingsPageHeaderProps) {
  return (
    <header className="lstPageHeader">
      <div className="lstPageHeaderText">
        <h1 className="opsHeading">İlan Yönetimi</h1>
        <p className="opsLead">
          İlan, görsel, ana ödeme kalemi ve ek hizmet ayarlarını tek
          ekrandan yönet. Kritik state geçişleri yine yetkili route ve
          DB iş akışları üzerinden yürütülür.
        </p>
      </div>
      <div className="lstPageHeaderActions">
        <button
          type="button"
          className="lstPrimaryButton"
          disabled={disabled}
          onClick={onCreateClick}
        >
          Yeni ilan
        </button>
      </div>
    </header>
  );
}
