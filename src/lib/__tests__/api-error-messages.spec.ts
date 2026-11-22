import { describe, it, expect } from 'vitest';
import { ApiError } from '../api-client';
import { getApiErrorMessage } from '../api-error-messages';

describe('getApiErrorMessage', () => {
  it('mapea NetworkError (statusCode 0) a mensaje claro de conectividad', () => {
    const err = new ApiError(0, 'NetworkError', 'Failed to fetch');
    expect(getApiErrorMessage(err)).toContain('No se pudo conectar con el servidor');
  });

  it('mapea 401, 403 (incluyendo EMAIL_NOT_VERIFIED), 404, 429 y 5xx en español', () => {
    expect(getApiErrorMessage(new ApiError(401, 'Unauthorized', 'Invalid token'))).toContain(
      'sesión ha expirado',
    );
    expect(
      getApiErrorMessage(
        new ApiError(403, 'Forbidden', 'Verify email', undefined, undefined, 'EMAIL_NOT_VERIFIED'),
      ),
    ).toContain('verificar tu correo');
    expect(getApiErrorMessage(new ApiError(403, 'Forbidden', 'Forbidden'))).toContain(
      'No tienes permisos',
    );
    expect(getApiErrorMessage(new ApiError(404, 'Not Found', 'Not found'))).toContain(
      'no fue encontrado',
    );
    expect(getApiErrorMessage(new ApiError(429, 'Too Many Requests', 'Rate limit'))).toContain(
      'demasiadas solicitudes',
    );
    expect(getApiErrorMessage(new ApiError(503, 'Service Unavailable', 'Down'))).toContain(
      'no está disponible temporalmente',
    );
  });

  it('preserva mensajes seguros de negocio en 400 y 409', () => {
    const conflict = new ApiError(409, 'Conflict', 'Ya existe un fondo con ese nombre');
    expect(getApiErrorMessage(conflict)).toBe('Ya existe un fondo con ese nombre');

    const badReq = new ApiError(400, 'Bad Request', 'La suma de splits no coincide con el monto');
    expect(getApiErrorMessage(badReq)).toBe('La suma de splits no coincide con el monto');
  });

  it('oculta stacktraces en 400/409 y usa fallback ante errores no-ApiError', () => {
    const leaky = new ApiError(400, 'Bad Request', 'Error: boom\n    at Object.<anonymous> (app.ts:1:1)');
    expect(getApiErrorMessage(leaky)).toContain('Los datos enviados no son válidos');

    expect(getApiErrorMessage(new Error('raw'), 'Fallback custom')).toBe('Fallback custom');
  });
});
