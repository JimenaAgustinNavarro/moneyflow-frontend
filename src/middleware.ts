import { NextResponse, type NextRequest } from 'next/server';

export const ACCESS_TOKEN_COOKIE_NAME = 'mf_access_token';

/**
 * Middleware de frontera Next.js App Router.
 *
 * Nota de diseño: `mf_refresh_token` tiene `Path=/api/v1/auth` en el API Gateway,
 * por lo que Next.js nunca lo recibe en `request.cookies`. Si `mf_access_token`
 * expiró (15m), no se debe redirigir prematuramente a `/login` para permitir que
 * `AuthProvider` ejecute `GET /api/v1/auth/me` y dispare el auto-refresh `single-flight`.
 */
export function middleware(request: NextRequest): NextResponse {
  const hasAccessCookie = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value);
  const response = NextResponse.next();
  response.headers.set('x-mf-has-access-cookie', hasAccessCookie ? '1' : '0');
  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
  ],
};
