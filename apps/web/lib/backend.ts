const DEFAULT_AUTH_BACKEND_URL = "https://aismaapi-production.up.railway.app";
const DEFAULT_META_BACKEND_URL = "https://commentdmautomation-production-ab90.up.railway.app";

export function getAuthBackendUrl() {
  return (
    process.env.NEXT_PUBLIC_AUTH_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production" ? DEFAULT_AUTH_BACKEND_URL : "http://localhost:4000")
  );
}

export function getAuthBackendOrigin() {
  return new URL(getAuthBackendUrl()).origin;
}

export function getMetaBackendUrl() {
  return (
    process.env.NEXT_PUBLIC_META_BACKEND_URL ??
    (process.env.NODE_ENV === "production" ? DEFAULT_META_BACKEND_URL : "http://localhost:4000")
  );
}

export function getMetaBackendOrigin() {
  return new URL(getMetaBackendUrl()).origin;
}
