import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { MediaItem } from "./types";

// In-memory buyer "campaign" for the License tab — a name, a one-line
// use, and the priced assets picked for it. There is no campaign table
// on the backend yet; checkout still creates real Stripe PaymentIntents
// (and PaymentMedia rows) for the selected ids. Survives navigation,
// not process death.

interface LicenseCartValue {
  campaignName: string;
  campaignUse: string;
  setCampaignName: (value: string) => void;
  setCampaignUse: (value: string) => void;
  items: MediaItem[];
  add: (item: MediaItem) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
  total: number;
}

const LicenseCartContext = createContext<LicenseCartValue | null>(null);

export function LicenseCartProvider({ children }: { children: ReactNode }) {
  const [campaignName, setCampaignName] = useState("");
  const [campaignUse, setCampaignUse] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);

  const add = useCallback((item: MediaItem) => {
    if (!item.price) return;
    setItems((current) => (current.some((row) => row.id === item.id) ? current : [...current, item]));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((row) => row.id !== id));
  }, []);

  const has = useCallback((id: string) => items.some((row) => row.id === id), [items]);

  const clear = useCallback(() => setItems([]), []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (item.price ?? 0), 0),
    [items]
  );

  const value = useMemo(
    () => ({
      campaignName,
      campaignUse,
      setCampaignName,
      setCampaignUse,
      items,
      add,
      remove,
      has,
      clear,
      total,
    }),
    [campaignName, campaignUse, items, add, remove, has, clear, total]
  );

  return <LicenseCartContext.Provider value={value}>{children}</LicenseCartContext.Provider>;
}

export function useLicenseCart(): LicenseCartValue {
  const ctx = useContext(LicenseCartContext);
  if (!ctx) {
    throw new Error("useLicenseCart must be used inside LicenseCartProvider");
  }
  return ctx;
}
