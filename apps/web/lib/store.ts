import { create } from "zustand";

export type Brand = {
  id: string;
  name: string;
  status: "connected" | "needs_reconnect";
  instagram: string;
  facebook: string;
};

export type AuthUser = {
  id: string;
  authProviderId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  onboardingComplete: boolean;
};

type AppState = {
  brands: Brand[];
  activeBrandId: string | null;
  authUser: AuthUser | null;
  authLoading: boolean;
  sidebarOpen: boolean;
  setActiveBrand: (id: string) => void;
  setBrands: (brands: Brand[]) => void;
  setAuthUser: (user: AuthUser | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  brands: [],
  activeBrandId: null,
  authUser: null,
  authLoading: true,
  sidebarOpen: false,
  setActiveBrand: (id) => set({ activeBrandId: id }),
  setBrands: (brands) =>
    set((state) => ({
      brands,
      activeBrandId: state.activeBrandId ?? brands[0]?.id ?? null
    })),
  setAuthUser: (user) => set({ authUser: user, authLoading: false }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen }))
}));
