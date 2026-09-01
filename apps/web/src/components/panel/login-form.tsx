'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ApiError } from '@/lib/api';
import { storeToken } from '@/lib/auth';
import { login } from '@/lib/panel-endpoints';

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { accessToken } = await login(email, password);
      storeToken(accessToken);
      // `next` só aceita caminho interno: parâmetro de URL é entrada não
      // confiável e não pode virar redirecionamento aberto.
      const next = searchParams.get('next');
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/painel';
      router.replace(target);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar agora. Tente novamente.',
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="E-mail" htmlFor="email" required>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="username"
        />
      </Field>

      <Field label="Senha" htmlFor="password" required>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-danger">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}

export function LoginForm() {
  // useSearchParams exige fronteira de Suspense no App Router.
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}
