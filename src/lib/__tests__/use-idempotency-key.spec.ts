import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { generateIdempotencyUuid, useIdempotencyKey } from '@/lib/use-idempotency-key';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('useIdempotencyKey', () => {
  it('genera UUID v4 válidos de 36 caracteres', () => {
    const id1 = generateIdempotencyUuid();
    const id2 = generateIdempotencyUuid();

    expect(id1).toMatch(UUID_V4_REGEX);
    expect(id2).toMatch(UUID_V4_REGEX);
    expect(id1).not.toBe(id2);
  });

  it('reutiliza la misma clave en reintentos con idéntico fingerprint y rota cuando cambia el payload o se invalida', () => {
    const { result } = renderHook(() => useIdempotencyKey());

    let keyAttempt1 = '';
    act(() => {
      keyAttempt1 = result.current.getOrCreateKey('EXPENSE:{"amount":"45.00"}');
    });
    expect(keyAttempt1).toMatch(UUID_V4_REGEX);
    expect(result.current.currentKey).toBe(keyAttempt1);

    // Reintento idéntico (ej. tras fallo de red sin tocar campos)
    let keyAttempt2 = '';
    act(() => {
      keyAttempt2 = result.current.getOrCreateKey('EXPENSE:{"amount":"45.00"}');
    });
    expect(keyAttempt2).toBe(keyAttempt1);

    // El usuario modifica el monto -> cambia el fingerprint -> nueva clave
    let keyAfterEdit = '';
    act(() => {
      keyAfterEdit = result.current.getOrCreateKey('EXPENSE:{"amount":"50.00"}');
    });
    expect(keyAfterEdit).toMatch(UUID_V4_REGEX);
    expect(keyAfterEdit).not.toBe(keyAttempt1);

    // El usuario invalida al editar un campo y vuelve al valor anterior -> nueva clave fresca
    act(() => {
      result.current.invalidateKey();
    });
    expect(result.current.currentKey).toBeNull();

    let keyAfterInvalidate = '';
    act(() => {
      keyAfterInvalidate = result.current.getOrCreateKey('EXPENSE:{"amount":"50.00"}');
    });
    expect(keyAfterInvalidate).toMatch(UUID_V4_REGEX);
    expect(keyAfterInvalidate).not.toBe(keyAfterEdit);

    // Rotación explícita tras éxito (201)
    let rotatedKey = '';
    act(() => {
      rotatedKey = result.current.rotateKey();
    });
    expect(rotatedKey).toMatch(UUID_V4_REGEX);
    expect(rotatedKey).not.toBe(keyAfterInvalidate);
  });
});
