import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getBaseApiUrl,
  getHealth,
  fetchFromApi,
  onSessionExpired,
  ApiError,
} from '../api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  } as Response;
}

describe('api-client', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });

  describe('getBaseApiUrl', () => {
    it('normaliza y elimina barras finales de NEXT_PUBLIC_API_URL', () => {
      process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000/';
      expect(getBaseApiUrl()).toBe('http://localhost:3000');

      process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000///';
      expect(getBaseApiUrl()).toBe('http://localhost:3000');

      process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
      expect(getBaseApiUrl()).toBe('http://localhost:3000');
    });

    it('usa http://localhost:3000 como fallback si no está definido', () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      expect(getBaseApiUrl()).toBe('http://localhost:3000');
    });
  });

  describe('getHealth', () => {
    it('retorna GatewayHealthResponse ante respuesta 200 OK incluyendo credentials: "include"', async () => {
      const mockPayload = {
        status: 'ok',
        gateway: 'up',
        coreService: 'up',
        database: 'up',
        timestamp: '2026-11-22T02:00:00.000Z',
      };

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse(mockPayload, 200));

      const result = await getHealth();

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/health',
        expect.objectContaining({
          credentials: 'include',
        }),
      );
      expect(result).toEqual(mockPayload);
    });

    it('lanza ApiError estructurado cuando el Gateway responde 503 Service Unavailable', async () => {
      const errorPayload = {
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Core service or database is unavailable',
        timestamp: '2026-11-22T02:00:00.000Z',
        path: '/api/v1/health',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(errorPayload, 503));

      await expect(getHealth()).rejects.toThrow(ApiError);
    });

    it('lanza ApiError con statusCode 0 y NetworkError cuando el backend está apagado o inalcanzable', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(getHealth()).rejects.toMatchObject({
        name: 'ApiError',
        statusCode: 0,
        error: 'NetworkError',
      });
    });
  });

  describe('Manejo de errores estructurados y respuestas vacías', () => {
    it('preserva code === "EMAIL_NOT_VERIFIED" en 403 sin disparar refresh', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 403,
            error: 'Forbidden',
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Please verify your email before logging in.',
            timestamp: '2026-11-22T02:00:00.000Z',
            path: '/api/v1/auth/login',
          },
          403,
        ),
      );

      await expect(
        fetchFromApi('/api/v1/auth/login', { method: 'POST', body: '{}' }),
      ).rejects.toMatchObject({
        name: 'ApiError',
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('preserva statusCode 429 y message en arreglo sin disparar refresh', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 429,
            error: 'Too Many Requests',
            message: ['ThrottlerException: Too Many Requests'],
            timestamp: '2026-11-22T02:00:00.000Z',
            path: '/api/v1/auth/login',
          },
          429,
        ),
      );

      await expect(fetchFromApi('/api/v1/funds')).rejects.toMatchObject({
        statusCode: 429,
        rawMessage: ['ThrottlerException: Too Many Requests'],
        message: 'ThrottlerException: Too Many Requests',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('maneja respuestas 204 o sin JSON válido sin lanzar SyntaxError', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input');
        },
      } as unknown as Response);

      const res = await fetchFromApi<undefined>('/api/v1/ping');
      expect(res).toBeUndefined();
    });
  });

  describe('Auto-refresh single-flight ante 401', () => {
    it('comparte una sola llamada a POST /api/v1/auth/refresh ante 3 requests concurrentes con 401', async () => {
      let refreshCount = 0;
      const attemptCount: Record<string, number> = {};

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);

        if (url.endsWith('/api/v1/auth/refresh')) {
          refreshCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 15));
          return jsonResponse({ user: { id: 'u1' }, message: 'Session refreshed successfully.' }, 200);
        }

        attemptCount[url] = (attemptCount[url] ?? 0) + 1;
        if (attemptCount[url] === 1) {
          return jsonResponse(
            {
              statusCode: 401,
              error: 'Unauthorized',
              message: 'Unauthorized',
              timestamp: '2026-11-22T02:00:00.000Z',
              path: url,
            },
            401,
          );
        }

        return jsonResponse({ ok: true, endpoint: url }, 200);
      });

      const [r1, r2, r3] = await Promise.all([
        fetchFromApi<{ ok: boolean }>('/api/v1/auth/me'),
        fetchFromApi<{ ok: boolean }>('/api/v1/funds'),
        fetchFromApi<{ ok: boolean }>('/api/v1/categories'),
      ]);

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      expect(r3.ok).toBe(true);
      expect(refreshCount).toBe(1);
      // 3 iniciales + 1 refresh + 3 reintentos = 7
      expect(fetchSpy).toHaveBeenCalledTimes(7);
    });

    it('notifica onSessionExpired y propaga 401 cuando /auth/refresh devuelve 401', async () => {
      const expiredSpy = vi.fn();
      const unsubscribe = onSessionExpired(expiredSpy);

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith('/api/v1/auth/refresh')) {
          return jsonResponse(
            {
              statusCode: 401,
              error: 'Unauthorized',
              message: 'Invalid refresh token',
              timestamp: '2026-11-22T02:00:00.000Z',
              path: '/api/v1/auth/refresh',
            },
            401,
          );
        }

        return jsonResponse(
          {
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Access token expired',
            timestamp: '2026-11-22T02:00:00.000Z',
            path: '/api/v1/auth/me',
          },
          401,
        );
      });

      await expect(fetchFromApi('/api/v1/auth/me')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Access token expired',
      });

      expect(expiredSpy).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('NO notifica onSessionExpired cuando /auth/refresh falla por error transitorio de red', async () => {
      const expiredSpy = vi.fn();
      const unsubscribe = onSessionExpired(expiredSpy);

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith('/api/v1/auth/refresh')) {
          throw new TypeError('Network failure');
        }
        return jsonResponse(
          {
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Unauthorized',
            timestamp: '2026-11-22T02:00:00.000Z',
            path: '/api/v1/auth/me',
          },
          401,
        );
      });

      await expect(fetchFromApi('/api/v1/auth/me')).rejects.toMatchObject({
        statusCode: 401,
      });

      expect(expiredSpy).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('reintenta exactamente 1 vez si el endpoint sigue devolviendo 401 tras un refresh exitoso', async () => {
      const expiredSpy = vi.fn();
      const unsubscribe = onSessionExpired(expiredSpy);
      let refreshCount = 0;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith('/api/v1/auth/refresh')) {
          refreshCount += 1;
          return jsonResponse({ user: { id: 'u1' }, message: 'Session refreshed successfully.' }, 200);
        }
        return jsonResponse(
          {
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Session revoked',
            timestamp: '2026-11-22T02:00:00.000Z',
            path: '/api/v1/auth/me',
          },
          401,
        );
      });

      await expect(fetchFromApi('/api/v1/auth/me')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Session revoked',
      });

      expect(refreshCount).toBe(1);
      // 1 intento inicial + 1 refresh + 1 único reintento = 3
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(expiredSpy).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it.each([
      '/api/v1/auth/login',
      '/api/v1/auth/login/?next=/dashboard',
      '/api/v1/auth/register',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
      '/api/v1/auth/verify-email',
      '/api/v1/auth/resend-verification',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
    ])('nunca dispara /auth/refresh cuando el 401 proviene de %s', async (excludedPath) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid credentials',
            timestamp: '2026-11-22T02:00:00.000Z',
            path: excludedPath,
          },
          401,
        ),
      );

      await expect(fetchFromApi(excludedPath, { method: 'POST' })).rejects.toMatchObject({
        statusCode: 401,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
