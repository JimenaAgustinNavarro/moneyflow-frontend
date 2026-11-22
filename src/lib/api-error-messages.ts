import { ApiError } from '@/lib/api-client';

const DEFAULT_FALLBACK_MESSAGE = 'Ocurrió un error inesperado. Inténtalo nuevamente.';

function isSafeBusinessMessage(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return false;
  }
  // Evitar exponer stacktraces o errores internos multi-línea en la UI
  if (trimmed.includes('\n') || /\bat\s+\S+\s*\(/.test(trimmed)) {
    return false;
  }
  return true;
}

/**
 * Traduce errores HTTP (`ApiError`) o desconocidos a mensajes claros y accionables en español.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK_MESSAGE,
): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  if (error.statusCode === 0) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.';
  }

  if (error.statusCode === 401) {
    return 'Tu sesión ha expirado. Inicia sesión nuevamente.';
  }

  if (error.statusCode === 403) {
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      return 'Debes verificar tu correo electrónico antes de continuar.';
    }
    return 'No tienes permisos para realizar esta acción.';
  }

  if (error.statusCode === 404) {
    return 'El recurso solicitado no fue encontrado o ya no está disponible.';
  }

  if (error.statusCode === 429) {
    return 'Has realizado demasiadas solicitudes. Espera un momento e inténtalo nuevamente.';
  }

  if (error.statusCode >= 500) {
    return 'El servicio no está disponible temporalmente. Inténtalo nuevamente en unos minutos.';
  }

  if (error.statusCode === 400 || error.statusCode === 409 || error.statusCode === 422) {
    if (isSafeBusinessMessage(error.message)) {
      return error.message;
    }
    return error.statusCode === 409
      ? 'La operación entró en conflicto con el estado actual del recurso.'
      : 'Los datos enviados no son válidos. Revisa el formulario e inténtalo nuevamente.';
  }

  return isSafeBusinessMessage(error.message) ? error.message : fallback;
}
