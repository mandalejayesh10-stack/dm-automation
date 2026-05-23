"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { getAuthBackendUrl } from "@/lib/backend";

const API_URL = getAuthBackendUrl();

type SessionResponse = {
  user: {
    id: string;
    authProviderId: string;
    email: string;
    name: string | null;
    imageUrl: string | null;
    onboardingComplete: boolean;
  };
  brands: Array<{
    id: string;
    name: string;
    socialAccounts: Array<{ provider: "INSTAGRAM" | "FACEBOOK"; username: string | null; isActive: boolean }>;
  }>;
  activeBrandId: string | null;
};

export function SessionBootstrap({ children }: { children: React.ReactNode }) {
  const setAuthUser = useAppStore((state) => state.setAuthUser);
  const setBrands = useAppStore((state) => state.setBrands);
  const setActiveBrand = useAppStore((state) => state.setActiveBrand);
  const setAuthLoading = useAppStore((state) => state.setAuthLoading);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setAuthLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/auth/session`, { credentials: "include" });
        if (!response.ok) {
          if (!cancelled) {
            setAuthUser(null);
            setBrands([]);
            setAuthLoading(false);
          }
          return;
        }

        const session = (await response.json()) as SessionResponse;
        if (cancelled) return;

        setAuthUser(session.user);
        setBrands(
          session.brands.map((brand) => ({
            id: brand.id,
            name: brand.name,
            status: brand.socialAccounts.some((account) => account.isActive) ? "connected" : "needs_reconnect",
            instagram: brand.socialAccounts.find((account) => account.provider === "INSTAGRAM")?.username ?? "Instagram not connected",
            facebook: brand.socialAccounts.find((account) => account.provider === "FACEBOOK")?.username ?? "Facebook not connected"
          }))
        );
        if (session.activeBrandId) {
          setActiveBrand(session.activeBrandId);
        }
        setAuthLoading(false);
      } catch {
        if (cancelled) return;
        setAuthUser(null);
        setBrands([]);
        setAuthLoading(false);
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [setActiveBrand, setAuthLoading, setAuthUser, setBrands]);

  return children;
}
