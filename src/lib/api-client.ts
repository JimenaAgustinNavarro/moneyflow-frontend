import { ApiErrorResponse, GatewayHealthResponse } from '@/types/api';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly error: string;
  public readonly timestamp?: string;
  public readonly path?: string;

  constructor(
    statusCode: number,
    error: string,
    message: string | string[],
    timestamp?: string,
    path?: string,
  ) {
    const formattedMessage = Array.isArray(message) ? message.join('; ') : message;
    super(formattedMessage);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.timestamp = timestamp;
    this.path = path;
  }
}

export function getBaseApiUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  return rawUrl.replace(/\/+$/, '');
}

export async function fetchFromApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
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

  if (!response.ok) {
    let errorData: ApiErrorResponse | null = null;
    try {
      errorData = (await response.json()) as ApiErrorResponse;
    } catch {
      // Si la respuesta no es JSON válido
    }

    if (errorData && errorData.statusCode) {
      throw new ApiError(
        errorData.statusCode,
        errorData.error,
        errorData.message,
        errorData.timestamp,
        errorData.path,
      );
    }

    throw new ApiError(
      response.status,
      response.statusText || 'HttpError',
      `Error HTTP ${response.status} recibido del Gateway`,
    );
  }

  return (await response.json()) as T;
}

export async function getHealth(): Promise<GatewayHealthResponse> {
  return fetchFromApi<GatewayHealthResponse>('/api/v1/health');
}
