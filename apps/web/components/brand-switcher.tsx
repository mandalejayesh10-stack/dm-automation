"use client";

import { ChevronDown, CircleCheck } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useBrands } from "@/src/hooks/use-api";

export function BrandSwitcher() {
  const brandsQuery = useBrands();
  const { brands, activeBrandId, setActiveBrand } = useAppStore();
  const active = brands.find((brand) => brand.id === activeBrandId) ?? brands[0];

  return (
    <label className="group flex min-w-56 items-center gap-3 rounded-md border border-white/10 bg-white/7 px-3 py-2 text-sm">
      <CircleCheck className="h-4 w-4 text-signal" />
      <select
        value={active?.id ?? ""}
        onChange={(event) => setActiveBrand(event.target.value)}
        className="w-full appearance-none bg-transparent font-semibold text-white outline-none"
        aria-label="Switch brand"
        disabled={brandsQuery.isLoading || brands.length === 0}
      >
        {brands.length === 0 && <option className="bg-ink">Loading brands</option>}
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id} className="bg-ink">
            {brand.name}
          </option>
        ))}
      </select>
      <ChevronDown className="h-4 w-4 text-white/45" />
    </label>
  );
}
