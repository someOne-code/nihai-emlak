export type PublicListingFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type PublicListingDistrictOption = PublicListingFilterOption & {
  city: string;
};

export type PublicListingRange = {
  min: number | null;
  max: number | null;
};

export type PublicListingFilters = {
  cities: PublicListingFilterOption[];
  districts: PublicListingDistrictOption[];
  priceRange: PublicListingRange;
  areaRange: PublicListingRange;
};
