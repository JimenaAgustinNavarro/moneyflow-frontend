'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';
import { AuthCardShell } from '@/components/auth/auth-card-shell';
import { PasswordRequirements } from '@/components/auth/password-requirements';
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
import { register as registerRequest, resendVerification } from '@/lib/auth-api';
import { registerSchema, type RegisterFormValues } from '@/lib/auth-schemas';

export default function RegisterPage(): React.JSX.Element {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const [resendFeedback, setResendFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password') ?? '';

  const onSubmit = async (values: RegisterFormValues): Promise<void> => {
    setFormError(null);

    try {
      const response = await registerRequest({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });
      setRegisteredEmail(response.user.email);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setFormError('Ya existe una cuenta registrada con este correo electrónico.');
          return;
        }
        if (err.statusCode === 429) {
          setFormError(
            'Demasiados intentos de registro. Espera un momento antes de volver a intentarlo.',
          );
          return;
        }
        setFormError(err.message || 'No se pudo completar el registro.');
        return;
      }

      setFormError('Ocurrió un error inesperado al registrar tu cuenta.');
    }
  };

  const handleResendVerification = async (): Promise<void> => {
    if (!registeredEmail || isResending) {
      return;
    }
    setIsResending(true);
    setResendFeedback(null);

    try {
      await resendVerification({ email: registeredEmail });
      setResendFeedback({
        type: 'success',
        message: 'Te hemos enviado nuevamente el correo de verificación.',
      });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 429) {
        setResendFeedback({
          type: 'error',
          message: 'Demasiadas solicitudes de reenvío. Espera un momento.',
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
          {registeredEmail ? (
            <>
              <CardHeader>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-income/15 text-income">
                  <MailCheck className="h-6 w-6" aria-hidden="true" />
                </div>
                <CardTitle>Revisa tu correo electrónico</CardTitle>
                <CardDescription>
                  Creamos tu cuenta en MoneyFlow. Enviamos un enlace de activación a{' '}
                  <span className="font-medium text-foreground">{registeredEmail}</span>.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Registro completado</AlertTitle>
                  <AlertDescription>
                    Abre el correo de verificación y confirma tu dirección para poder iniciar sesión.
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

                <div className="flex flex-col gap-2">
                  <Link
                    href="/login"
                    className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Ir a iniciar sesión
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleResendVerification()}
                    disabled={isResending}
                    className="w-full gap-2"
                  >
                    {isResending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Reenviar correo de verificación
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Crear cuenta</CardTitle>
                <CardDescription>
                  Regístrate en MoneyFlow para organizar tus fondos, gastos y presupuestos.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No se pudo crear la cuenta</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="register-fullName">Nombre completo</Label>
                    <Input
                      id="register-fullName"
                      type="text"
                      autoComplete="name"
                      placeholder="Ana Pérez"
                      aria-invalid={Boolean(errors.fullName)}
                      aria-describedby={errors.fullName ? 'register-fullName-error' : undefined}
                      {...register('fullName')}
                    />
                    {errors.fullName && (
                      <p
                        id="register-fullName-error"
                        role="alert"
                        className="text-xs text-destructive"
                      >
                        {errors.fullName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-email">Correo electrónico</Label>
                    <Input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      placeholder="tu@correo.com"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'register-email-error' : undefined}
                      {...register('email')}
                    />
                    {errors.email && (
                      <p id="register-email-error" role="alert" className="text-xs text-destructive">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="pr-10"
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={errors.password ? 'register-password-error' : undefined}
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
                      <p
                        id="register-password-error"
                        role="alert"
                        className="text-xs text-destructive"
                      >
                        {errors.password.message}
                      </p>
                    )}
                    <PasswordRequirements password={passwordValue} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-confirmPassword">Confirmar contraseña</Label>
                    <div className="relative">
                      <Input
                        id="register-confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="pr-10"
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={
                          errors.confirmPassword ? 'register-confirmPassword-error' : undefined
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
                        id="register-confirmPassword-error"
                        role="alert"
                        className="text-xs text-destructive"
                      >
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Crear cuenta
                  </Button>
                </form>
              </CardContent>

              <CardFooter className="justify-center border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  ¿Ya tienes una cuenta?{' '}
                  <Link
                    href="/login"
                    className="font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Iniciar sesión
                  </Link>
                </p>
              </CardFooter>
            </>
          )}
        </Card>
      </AuthCardShell>
    </GuestOnlyRoute>
  );
}
