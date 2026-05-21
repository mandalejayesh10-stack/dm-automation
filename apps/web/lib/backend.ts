const DEFAULT_PRODUCTION_BACKEND_URL = "https://commentdmautomation-production-ab90.up.railway.app";

export function getBackendUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_BACKEND_URL : "http://localhost:4000")
  );
}

export function getBackendOrigin() {
  return new URL(getBackendUrl()).origin;
}
