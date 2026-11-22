'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AuthCardShell } from '@/components/auth/auth-card-shell';
import { PasswordRequirements } from '@/components/auth/password-requirements';
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
import { useAuth } from '@/components/auth/auth-provider';
import { resetPassword } from '@/lib/auth-api';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/lib/auth-schemas';

function ResetPasswordContent(): React.JSX.Element {
  const { status, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPasswordValue = watch('newPassword') ?? '';

  const onSubmit = async (values: ResetPasswordFormValues): Promise<void> => {
    if (!token) {
      return;
    }
    setFormError(null);

    try {
      await resetPassword({
        token,
        newPassword: values.newPassword,
      });
      setIsSuccess(true);
      if (status === 'authenticated') {
        void refreshUser();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 400) {
          setFormError('El enlace de restablecimiento es inválido o ha expirado. Solicita uno nuevo.');
          return;
        }
        if (err.statusCode === 429) {
          setFormError(
            'Demasiados intentos de restablecimiento. Espera un momento antes de volver a intentarlo.',
          );
          return;
        }
        setFormError(err.message || 'No se pudo restablecer la contraseña.');
        return;
      }

      setFormError('Ocurrió un error inesperado al restablecer tu contraseña.');
    }
  };

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enlace inválido</CardTitle>
          <CardDescription>
            No encontramos un token válido para restablecer tu contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Token ausente o inválido</AlertTitle>
            <AlertDescription>
              Solicita un nuevo enlace de recuperación para continuar.
            </AlertDescription>
          </Alert>
          <Link
            href="/forgot-password"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Solicitar nuevo enlace
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva contraseña</CardTitle>
        <CardDescription>
          Define una contraseña segura para recuperar el acceso a tu cuenta.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isSuccess ? (
          <div className="space-y-4">
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Contraseña actualizada</AlertTitle>
              <AlertDescription>
                Tu contraseña se restableció correctamente. Ya puedes iniciar sesión con tu nueva
                clave.
              </AlertDescription>
            </Alert>
            <Link
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error al restablecer</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{formError}</p>
                  <Link
                    href="/forgot-password"
                    className="inline-block font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Solicitar un nuevo enlace
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-newPassword">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="reset-newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pr-10"
                    aria-invalid={Boolean(errors.newPassword)}
                    aria-describedby={errors.newPassword ? 'reset-newPassword-error' : undefined}
                    {...register('newPassword')}
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
                {errors.newPassword && (
                  <p
                    id="reset-newPassword-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {errors.newPassword.message}
                  </p>
                )}
                <PasswordRequirements password={newPasswordValue} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reset-confirmPassword">Confirmar nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="reset-confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pr-10"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={
                      errors.confirmPassword ? 'reset-confirmPassword-error' : undefined
                    }
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p
                    id="reset-confirmPassword-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Restablecer contraseña
              </Button>
            </form>
          </>
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

export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <AuthCardShell>
      <React.Suspense
        fallback={
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span>Cargando formulario...</span>
            </CardContent>
          </Card>
        }
      >
        <ResetPasswordContent />
      </React.Suspense>
    </AuthCardShell>
  );
}
