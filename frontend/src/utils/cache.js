const isBrowser = typeof window !== 'undefined';

export const cacheGet = (key) => {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.expiry && parsed.expiry < Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed?.value ?? null;
  } catch (error) {
    console.warn(`cacheGet falhou para ${key}:`, error);
    return null;
  }
};

export const cacheSet = (key, value, ttlMs) => {
  if (!isBrowser) return;
  try {
    const payload = {
      value,
      expiry: typeof ttlMs === 'number' ? Date.now() + ttlMs : null,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn(`cacheSet falhou para ${key}:`, error);
  }
};

export const cacheClear = (key) => {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`cacheClear falhou para ${key}:`, error);
  }
};
