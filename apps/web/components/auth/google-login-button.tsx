"use client";

import { Button } from "@/components/ui/button";
import { getBackendUrl } from "@/lib/backend";

const API_URL = getBackendUrl();

export function GoogleLoginButton({
  label,
  returnTo = "/dashboard"
}: {
  label: string;
  returnTo?: string;
}) {
  const handleClick = () => {
    const url = new URL("/api/auth/google", API_URL);
    url.searchParams.set("returnTo", returnTo);
    window.location.href = url.toString();
  };

  return (
    <Button onClick={handleClick} className="w-full sm:w-auto">
      {label}
    </Button>
  );
}
