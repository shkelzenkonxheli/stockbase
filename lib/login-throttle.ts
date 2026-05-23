const MAX_LOGIN_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

type LoginThrottleEntry = {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __stockAppLoginThrottleStore: Map<string, LoginThrottleEntry> | undefined;
}

function getStore() {
  if (!globalThis.__stockAppLoginThrottleStore) {
    globalThis.__stockAppLoginThrottleStore = new Map<string, LoginThrottleEntry>();
  }

  return globalThis.__stockAppLoginThrottleStore;
}

function now() {
  return Date.now();
}

function normalizeEntry(entry: LoginThrottleEntry | undefined) {
  if (!entry) {
    return null;
  }

  const currentTime = now();

  if (entry.lockedUntil && entry.lockedUntil <= currentTime) {
    return null;
  }

  if (currentTime - entry.firstAttemptAt > WINDOW_MS) {
    return null;
  }

  return entry;
}

export function getLoginThrottleKey(email: string, ipAddress?: string | null) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedIp = ipAddress?.split(",")[0]?.trim() || "unknown";
  return `${normalizedEmail}:${normalizedIp}`;
}

export function getLoginThrottleState(key: string) {
  const store = getStore();
  const entry = normalizeEntry(store.get(key));

  if (!entry) {
    store.delete(key);
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (entry.lockedUntil && entry.lockedUntil > now()) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - now()) / 1000)),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function recordLoginFailure(key: string) {
  const store = getStore();
  const currentTime = now();
  const existing = normalizeEntry(store.get(key));

  if (!existing) {
    store.set(key, {
      attempts: 1,
      firstAttemptAt: currentTime,
      lockedUntil: null,
    });
    return;
  }

  const attempts = existing.attempts + 1;
  const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? currentTime + LOCK_MS : null;

  store.set(key, {
    attempts,
    firstAttemptAt: existing.firstAttemptAt,
    lockedUntil,
  });
}

export function clearLoginFailures(key: string) {
  getStore().delete(key);
}
