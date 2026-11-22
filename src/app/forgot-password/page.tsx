'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { AuthCardShell } from '@/components/auth/auth-card-shell';
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
import { forgotPassword } from '@/lib/auth-api';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/lib/auth-schemas';

export default function ForgotPasswordPage(): React.JSX.Element {
  const [submitted, setSubmitted] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues): Promise<void> => {
    setFormError(null);

    try {
      await forgotPassword({ email: values.email });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 429) {
          setFormError(
            'Demasiadas solicitudes de recuperación. Espera un momento antes de intentarlo de nuevo.',
          );
          return;
        }
        setFormError(err.message || 'No se pudo procesar la solicitud.');
        return;
      }

      setFormError('Ocurrió un error inesperado al solicitar el restablecimiento.');
    }
  };

  return (
    <GuestOnlyRoute>
      <AuthCardShell>
        <Card>
          <CardHeader>
            <CardTitle>Recuperar contraseña</CardTitle>
            <CardDescription>
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu
              contraseña.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {submitted ? (
              <div className="space-y-4">
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Solicitud enviada</AlertTitle>
                  <AlertDescription>
                    Si existe una cuenta asociada a ese correo electrónico, recibirás instrucciones
                    para restablecer tu contraseña en los próximos minutos.
                  </AlertDescription>
                </Alert>

                <Link
                  href="/login"
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Volver a iniciar sesión
                </Link>
              </div>
            ) : (
              <>
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No se pudo enviar la solicitud</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Correo electrónico</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      placeholder="tu@correo.com"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                      {...register('email')}
                    />
                    {errors.email && (
                      <p id="forgot-email-error" role="alert" className="text-xs text-destructive">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enviar instrucciones
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
      </AuthCardShell>
    </GuestOnlyRoute>
  );
}
