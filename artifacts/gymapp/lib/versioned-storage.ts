export const CURRENT_STORAGE_VERSION = 1;

type VersionedStorageValue<T> = {
  storageVersion: number;
  payload: T;
};

type DecodeVersionedResult<T> = {
  value: T;
  shouldMigrate: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function encodeVersioned<T>(payload: T): string {
  const value: VersionedStorageValue<T> = {
    storageVersion: CURRENT_STORAGE_VERSION,
    payload,
  };
  return JSON.stringify(value);
}

export function decodeVersioned<T>(raw: string | null, fallback: T): DecodeVersionedResult<T> {
  if (!raw) {
    return { value: fallback, shouldMigrate: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (isRecord(parsed) && typeof parsed.storageVersion === "number" && "payload" in parsed) {
      return {
        value: parsed.payload as T,
        shouldMigrate: parsed.storageVersion !== CURRENT_STORAGE_VERSION,
      };
    }

    return { value: parsed as T, shouldMigrate: true };
  } catch {
    return { value: fallback, shouldMigrate: false };
  }
}

export function decodeVersionedWithLegacyFallback<T>(
  raw: string | null,
  legacyRaw: string | null,
  fallback: T,
): DecodeVersionedResult<T> & { usedLegacyFallback: boolean } {
  const usedLegacyFallback = raw == null && legacyRaw != null;
  const decoded = decodeVersioned(usedLegacyFallback ? legacyRaw : raw, fallback);

  return {
    ...decoded,
    shouldMigrate: decoded.shouldMigrate || usedLegacyFallback,
    usedLegacyFallback,
  };
}
