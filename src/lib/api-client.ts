import { ApiErrorResponse, GatewayHealthResponse } from '@/types/api';

const AUTH_REFRESH_ENDPOINT = '/api/v1/auth/refresh';

const AUTH_REFRESH_EXCLUDED_PATHS: ReadonlySet<string> = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/resend-verification',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
]);

type SessionExpiredListener = () => void;
type RefreshOutcome = 'ok' | 'unauthorized' | 'error';

const sessionExpiredListeners = new Set<SessionExpiredListener>();
let activeRefreshPromise: Promise<RefreshOutcome> | null = null;

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly error: string;
  public readonly code?: string;
  public readonly rawMessage: string | string[];
  public readonly timestamp?: string;
  public readonly path?: string;

  constructor(
    statusCode: number,
    error: string,
    message: string | string[],
    timestamp?: string,
    path?: string,
    code?: string,
  ) {
    const formattedMessage = Array.isArray(message) ? message.join('; ') : message;
    super(formattedMessage);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.code = code;
    this.rawMessage = message;
    this.timestamp = timestamp;
    this.path = path;
  }
}

export function getBaseApiUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  return rawUrl.replace(/\/+$/, '');
}

/**
 * Suscribe un listener que se ejecuta cuando el backend invalida la sesión
 * (401/403 en /auth/refresh o 401 tras un reintento exitoso de refresh).
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) {
    listener();
  }
}

function normalizePathname(resolvedUrl: string): string {
  try {
    const parsed = new URL(resolvedUrl);
    const trimmed = parsed.pathname.replace(/\/+$/, '');
    return trimmed || '/';
  } catch {
    const withoutQuery = resolvedUrl.split('?')[0] ?? resolvedUrl;
    const trimmed = withoutQuery.replace(/\/+$/, '');
    return trimmed || '/';
  }
}

function isRefreshExcluded(resolvedUrl: string): boolean {
  const pathname = normalizePathname(resolvedUrl);
  return AUTH_REFRESH_EXCLUDED_PATHS.has(pathname);
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  try {
    const raw = await response.json();
    return raw as T;
  } catch {
    return null;
  }
}

async function buildApiError(response: Response): Promise<ApiError> {
  const errorData = await parseJsonSafely<ApiErrorResponse>(response);

  if (errorData && typeof errorData.statusCode === 'number') {
    return new ApiError(
      errorData.statusCode,
      errorData.error,
      errorData.message,
      errorData.timestamp,
      errorData.path,
      typeof errorData.code === 'string' && errorData.code.length > 0 ? errorData.code : undefined,
    );
  }

  return new ApiError(
    response.status,
    response.statusText || 'HttpError',
    `Error HTTP ${response.status} recibido del Gateway`,
  );
}

async function executeRefreshRequest(): Promise<RefreshOutcome> {
  const baseUrl = getBaseApiUrl();
  const refreshUrl = `${baseUrl}${AUTH_REFRESH_ENDPOINT}`;

  let response: Response;
  try {
    response = await fetch(refreshUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch {
    return 'error';
  }

  if (response.ok) {
    return 'ok';
  }

  if (response.status === 401 || response.status === 403) {
    notifySessionExpired();
    return 'unauthorized';
  }

  return 'error';
}

function getOrCreateSingleFlightRefresh(): Promise<RefreshOutcome> {
  if (!activeRefreshPromise) {
    activeRefreshPromise = executeRefreshRequest().finally(() => {
      activeRefreshPromise = null;
    });
  }
  return activeRefreshPromise;
}

async function performRequest<T>(
  endpoint: string,
  options: RequestInit | undefined,
  hasRetried: boolean,
): Promise<T> {
  const baseUrl = getBaseApiUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const targetUrl = `${baseUrl}${normalizedEndpoint}`;

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      0,
      'NetworkError',
      'No se pudo conectar con el servidor API Gateway. Verifica que el backend esté encendido.',
    );
  }

  if (response.status === 401) {
    const excluded = isRefreshExcluded(targetUrl);

    if (!excluded && !hasRetried) {
      const outcome = await getOrCreateSingleFlightRefresh();
      if (outcome === 'ok') {
        return performRequest<T>(endpoint, options, true);
      }
      throw await buildApiError(response);
    }

    if (!excluded && hasRetried) {
      notifySessionExpired();
    }

    throw await buildApiError(response);
  }

  if (!response.ok) {
    throw await buildApiError(response);
  }

  const data = await parseJsonSafely<T>(response);
  return (data ?? undefined) as T;
}

export async function fetchFromApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  return performRequest<T>(endpoint, options, false);
}

export async function getHealth(): Promise<GatewayHealthResponse> {
  return fetchFromApi<GatewayHealthResponse>('/api/v1/health');
}
