'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AuthCardShell } from '@/components/auth/auth-card-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { GuestOnlyRoute } from '@/components/auth/route-guards';
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
import { login as loginRequest, resendVerification } from '@/lib/auth-api';
import { loginSchema, type LoginFormValues } from '@/lib/auth-schemas';

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const { setAuthenticatedUser } = useAuth();

  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const [resendFeedback, setResendFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setFormError(null);
    setUnverifiedEmail(null);
    setResendFeedback(null);

    try {
      const response = await loginRequest({
        email: values.email,
        password: values.password,
      });
      setAuthenticatedUser(response.user);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setFormError('Correo o contraseña inválidos.');
          return;
        }
        if (err.statusCode === 403 && err.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(values.email);
          return;
        }
        if (err.statusCode === 429) {
          setFormError(
            'Demasiados intentos de inicio de sesión. Espera un momento antes de volver a intentarlo.',
          );
          return;
        }
        setFormError(err.message || 'No se pudo iniciar sesión.');
        return;
      }

      setFormError('Ocurrió un error inesperado al iniciar sesión.');
    }
  };

  const handleResendVerification = async (): Promise<void> => {
    if (!unverifiedEmail || isResending) {
      return;
    }
    setIsResending(true);
    setResendFeedback(null);

    try {
      await resendVerification({ email: unverifiedEmail });
      setResendFeedback({
        type: 'success',
        message:
          'Si el correo está pendiente de verificación, te hemos enviado un nuevo enlace de activación.',
      });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 429) {
        setResendFeedback({
          type: 'error',
          message: 'Demasiadas solicitudes de reenvío. Espera un momento antes de intentar de nuevo.',
        });
      } else if (err instanceof ApiError) {
        setResendFeedback({
          type: 'error',
          message: err.message,
        });
      } else {
        setResendFeedback({
          type: 'error',
          message: 'No se pudo reenviar el correo de verificación.',
        });
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <GuestOnlyRoute>
      <AuthCardShell>
        <Card>
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>
              Ingresa a tu cuenta de MoneyFlow para gestionar tus finanzas personales.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No se pudo iniciar sesión</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {unverifiedEmail && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Correo pendiente de verificación</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    Debes confirmar tu correo electrónico ({unverifiedEmail}) antes de iniciar
                    sesión.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleResendVerification()}
                    disabled={isResending}
                    className="gap-2"
                  >
                    {isResending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Reenviar correo de verificación
                  </Button>
                </AlertDescription>
              </Alert>
            )}

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

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Correo electrónico</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="login-email-error" role="alert" className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="login-password">Contraseña</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pr-10"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p id="login-password-error" role="alert" className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Iniciar sesión
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <Link
                href="/register"
                className="font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Crear cuenta
              </Link>
            </p>
          </CardFooter>
        </Card>
      </AuthCardShell>
    </GuestOnlyRoute>
  );
}
