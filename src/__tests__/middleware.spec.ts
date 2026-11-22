import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config, ACCESS_TOKEN_COOKIE_NAME } from '../middleware';

describe('Next.js Middleware (src/middleware.ts)', () => {
  it('declara el matcher esperado para rutas protegidas y de autenticación', () => {
    expect(config.matcher).toEqual([
      '/dashboard/:path*',
      '/login',
      '/register',
      '/verify-email',
      '/forgot-password',
      '/reset-password',
    ]);
  });

  it('no redirige prematuramente /dashboard cuando falta mf_access_token (permite auto-refresh vía /auth/me)', () => {
    const request = new NextRequest('http://localhost:3001/dashboard');
    const response = middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-mf-has-access-cookie')).toBe('0');
  });

  it('marca x-mf-has-access-cookie=1 cuando mf_access_token está presente sin bloquear la petición', () => {
    const request = new NextRequest('http://localhost:3001/dashboard', {
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE_NAME}=jwt-token-val`,
      },
    });
    const response = middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-mf-has-access-cookie')).toBe('1');
  });
});
