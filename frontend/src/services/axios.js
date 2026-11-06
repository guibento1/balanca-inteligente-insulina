import axios from "axios";

const DEFAULT_BASE = "http://127.0.0.1:8000/api/v1";

const ensureApiBase = (value) => {
  const trimmed = (value ?? "").trim();
  const raw = trimmed || DEFAULT_BASE;
  const withoutTrailing = raw.replace(/\/+$/, "");

  if (withoutTrailing.includes("/api/")) {
    return `${withoutTrailing}/`;
  }

  if (withoutTrailing.endsWith("/api")) {
    return `${withoutTrailing}/v1/`;
  }

  return `${withoutTrailing}/api/v1/`;
};

const baseURL = ensureApiBase(import.meta.env?.VITE_API_URL);

const api = axios.create({
  baseURL,
  timeout: 10000,
  // opcional: headers comuns
  // headers: { 'Accept': 'application/json' },
});

export default api;
