import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBaseApiUrl, getHealth, ApiError } from '../api-client';

describe('api-client', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
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
      process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
      const mockPayload = {
        status: 'ok',
        gateway: 'up',
        coreService: 'up',
        database: 'up',
        timestamp: '2026-11-22T02:00:00.000Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      } as Response);

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
      process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
      const errorPayload = {
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Core service or database is unavailable',
        timestamp: '2026-11-22T02:00:00.000Z',
        path: '/api/v1/health',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => errorPayload,
      } as Response);

      await expect(getHealth()).rejects.toThrow(ApiError);
    });

    it('lanza ApiError con statusCode 0 y NetworkError cuando el backend está apagado o inalcanzable', async () => {
      process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(getHealth()).rejects.toMatchObject({
        name: 'ApiError',
        statusCode: 0,
        error: 'NetworkError',
      });
    });
  });
});
