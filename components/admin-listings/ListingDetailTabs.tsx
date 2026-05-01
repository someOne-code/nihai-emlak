"use client";

import { useState, type ReactNode } from "react";

import {
  ADMIN_LISTING_DETAIL_TABS,
  DEFAULT_ADMIN_LISTING_DETAIL_TAB,
  type AdminListingDetailTabId,
} from "@/lib/admin-ui/listings-product-layout";

// Phase 8.6 Task 4: tab shell for the listing detail panels.
//
// All tab panels stay mounted in the DOM; the inactive ones are hidden
// via class + aria. This preserves form-local state inside the
// existing DetailPanel/ImagesPanel/MainItemsPanel/ServicesPanel
// components when the admin switches tabs.

type ListingDetailTabsProps = {
  general: ReactNode;
  images: ReactNode;
  mainItems: ReactNode;
  services: ReactNode;
  checkout: ReactNode;
  initialTab?: AdminListingDetailTabId;
};

export default function ListingDetailTabs({
  general,
  images,
  mainItems,
  services,
  checkout,
  initialTab = DEFAULT_ADMIN_LISTING_DETAIL_TAB,
}: ListingDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<AdminListingDetailTabId>(initialTab);

  const panels: Record<AdminListingDetailTabId, ReactNode> = {
    general,
    images,
    "main-items": mainItems,
    services,
    checkout,
  };

  return (
    <div className="lstTabs">
      <div role="tablist" aria-label="İlan detay tablari" className="lstTabList">
        {ADMIN_LISTING_DETAIL_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`lstTabButton-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`lstTabPanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={
                isActive ? "lstTabButton lstTabButtonActive" : "lstTabButton"
              }
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {ADMIN_LISTING_DETAIL_TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <div
            key={tab.id}
            id={`lstTabPanel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`lstTabButton-${tab.id}`}
            hidden={!isActive}
            className={
              isActive ? "lstTabPanel" : "lstTabPanel lstTabPanelHidden"
            }
          >
            {panels[tab.id]}
          </div>
        );
      })}
    </div>
  );
}
