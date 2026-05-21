import { getBackendUrl } from "@/lib/backend";

const API_URL = getBackendUrl();

export async function getCsrfToken() {
  const response = await fetch(`${API_URL}/api/csrf`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to load CSRF token");
  }

  const body = (await response.json()) as { csrfToken: string };
  return body.csrfToken;
}
