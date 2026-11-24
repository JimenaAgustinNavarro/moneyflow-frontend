import * as React from 'react';

interface IdempotencyCacheEntry {
  fingerprint: string | null;
  key: string | null;
}

export function generateIdempotencyUuid(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // RFC 4122 versión 4 y variante 10xx
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export interface UseIdempotencyKeyResult {
  currentKey: string | null;
  getOrCreateKey: (fingerprint: string) => string;
  invalidateKey: () => void;
  rotateKey: () => string;
}

/**
 * Gestiona la Idempotency-Key de forma determinista por fingerprint del payload:
 * - Si el usuario reintenta exactamente el mismo payload tras un error de red, reutiliza la misma clave.
 * - Si el usuario edita cualquier campo (cambia el fingerprint o se invoca invalidateKey), genera un nuevo UUID v4.
 * - Tras un envío exitoso (201) o al iniciar otro movimiento, rotateKey/invalidateKey limpia la clave anterior.
 */
export function useIdempotencyKey(): UseIdempotencyKeyResult {
  const cacheRef = React.useRef<IdempotencyCacheEntry>({
    fingerprint: null,
    key: null,
  });
  const [currentKey, setCurrentKey] = React.useState<string | null>(null);

  const getOrCreateKey = React.useCallback((fingerprint: string): string => {
    if (
      cacheRef.current.key !== null &&
      cacheRef.current.fingerprint === fingerprint
    ) {
      return cacheRef.current.key;
    }

    const nextKey = generateIdempotencyUuid();
    cacheRef.current = {
      fingerprint,
      key: nextKey,
    };
    setCurrentKey(nextKey);
    return nextKey;
  }, []);

  const invalidateKey = React.useCallback((): void => {
    if (cacheRef.current.key === null && cacheRef.current.fingerprint === null) {
      return;
    }
    cacheRef.current = {
      fingerprint: null,
      key: null,
    };
    setCurrentKey(null);
  }, []);

  const rotateKey = React.useCallback((): string => {
    const nextKey = generateIdempotencyUuid();
    cacheRef.current = {
      fingerprint: null,
      key: nextKey,
    };
    setCurrentKey(nextKey);
    return nextKey;
  }, []);

  return {
    currentKey,
    getOrCreateKey,
    invalidateKey,
    rotateKey,
  };
}
