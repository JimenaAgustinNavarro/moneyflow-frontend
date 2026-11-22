'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { AuthCardShell } from '@/components/auth/auth-card-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';
import { resendVerification, verifyEmail } from '@/lib/auth-api';
import type { VerifyEmailResponse } from '@/types/auth';
import {
  resendVerificationSchema,
  type ResendVerificationFormValues,
} from '@/lib/auth-schemas';

type VerificationState = 'verifying' | 'success' | 'error' | 'missing-token';

const inFlightVerifications = new Map<string, Promise<VerifyEmailResponse>>();

function VerifyEmailContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [status, setStatus] = React.useState<VerificationState>(
    token ? 'verifying' : 'missing-token',
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = React.useState<string | null>(null);
  const [resendFeedback, setResendFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResendVerificationFormValues>({
    resolver: zodResolver(resendVerificationSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
    },
  });

  React.useEffect(() => {
    let isActive = true;

    if (!token) {
      setStatus('missing-token');
      return;
    }

    setStatus('verifying');
    setErrorMessage(null);

    let verifyPromise = inFlightVerifications.get(token);
    if (!verifyPromise) {
      verifyPromise = verifyEmail({ token }).finally(() => {
        inFlightVerifications.delete(token);
      });
      inFlightVerifications.set(token, verifyPromise);
    }

    verifyPromise
      .then((response) => {
        if (!isActive) return;
        setVerifiedEmail(response.email);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (!isActive) return;
        if (err instanceof ApiError) {
          setErrorMessage(
            err.statusCode === 400
              ? 'El enlace de verificación es inválido o ha expirado.'
              : err.message,
          );
        } else {
          setErrorMessage('No se pudo verificar tu correo electrónico.');
        }
        setStatus('error');
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  const onResendSubmit = async (values: ResendVerificationFormValues): Promise<void> => {
    setResendFeedback(null);

    try {
      await resendVerification({ email: values.email });
      setResendFeedback({
        type: 'success',
        message:
          'Si tu cuenta existe y está pendiente de verificación, recibirás un nuevo correo en unos minutos.',
      });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 429) {
        setResendFeedback({
          type: 'error',
          message: 'Demasiadas solicitudes de reenvío. Espera un momento antes de volver a intentar.',
        });
      } else if (err instanceof ApiError) {
        setResendFeedback({
          type: 'error',
          message: err.message,
        });
      } else {
        setResendFeedback({
          type: 'error',
          message: 'No se pudo procesar la solicitud de reenvío.',
        });
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificación de correo</CardTitle>
        <CardDescription>Confirmamos tu dirección para activar tu cuenta de MoneyFlow.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {status === 'verifying' && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground"
          >
            <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
            <span>Verificando tu token de activación...</span>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Correo verificado</AlertTitle>
              <AlertDescription>
                {verifiedEmail
                  ? `Tu cuenta (${verifiedEmail}) fue activada correctamente.`
                  : 'Tu cuenta fue activada correctamente.'}
              </AlertDescription>
            </Alert>
            <Link
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        )}

        {(status === 'missing-token' || status === 'error') && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {status === 'missing-token'
                  ? 'Enlace de verificación incompleto'
                  : 'No pudimos verificar tu correo'}
              </AlertTitle>
              <AlertDescription>
                {status === 'missing-token'
                  ? 'Falta el token de verificación en la URL. Solicita un nuevo correo de activación.'
                  : errorMessage}
              </AlertDescription>
            </Alert>

            {resendFeedback && (
              <Alert variant={resendFeedback.type === 'success' ? 'success' : 'destructive'}>
                {resendFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{resendFeedback.message}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onResendSubmit)} noValidate className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="verify-resend-email">Reenviar enlace de verificación</Label>
                <Input
                  id="verify-resend-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'verify-resend-email-error' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p
                    id="verify-resend-email-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Reenviar correo de verificación
              </Button>
            </form>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-center border-t border-border pt-4">
        <Link
          href="/login"
          className="text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Volver a iniciar sesión
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage(): React.JSX.Element {
  return (
    <AuthCardShell>
      <React.Suspense
        fallback={
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span>Cargando verificación...</span>
            </CardContent>
          </Card>
        }
      >
        <VerifyEmailContent />
      </React.Suspense>
    </AuthCardShell>
  );
}
