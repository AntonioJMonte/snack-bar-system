'use client';

import type { Role } from '@lanchonete/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ApiError } from '@/lib/api';
import { createUser, fetchUsers, updateUser } from '@/lib/admin-endpoints';

const ROLE_LABELS: Record<Role, string> = {
  attendant: 'Atendente',
  manager: 'Gerente',
  admin: 'Administrador',
};

// Gestão de usuários e perfis: exclusiva do administrador (seção 5.5). O servidor
// rejeita um gerente que chame estas rotas diretamente.
export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('attendant');
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['users'] });
  }

  const create = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setName('');
      setEmail('');
      setPassword('');
      setRole('attendant');
      invalidate();
    },
    onError: (caught) => {
      setError(
        caught instanceof ApiError && caught.code === 'EMAIL_IN_USE'
          ? 'Já existe um usuário com esse e-mail.'
          : 'Não foi possível criar o usuário.',
      );
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: Role; active?: boolean } }) =>
      updateUser(id, data),
    onSuccess: invalidate,
    onError: () => setError('Não foi possível atualizar o usuário.'),
  });

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('A senha precisa ter ao menos 8 caracteres.');
      return;
    }
    create.mutate({ name, email, password, role });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border-subtle bg-surface p-5">
        <h2 className="mb-4 font-semibold">Usuários</h2>
        <ul className="divide-y divide-border-subtle">
          {(users ?? []).map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {user.name}
                  {!user.active && (
                    <span className="ml-2 text-xs text-ink-muted">(desativado)</span>
                  )}
                </p>
                <p className="truncate text-sm text-ink-muted">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={user.role}
                  onChange={(event) =>
                    update.mutate({ id: user.id, data: { role: event.target.value as Role } })
                  }
                  className="w-40 py-2"
                  aria-label={`Perfil de ${user.name}`}
                >
                  {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
                    <option key={value} value={value}>
                      {ROLE_LABELS[value]}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update.mutate({ id: user.id, data: { active: !user.active } })}
                  disabled={update.isPending}
                >
                  {user.active ? 'Desativar' : 'Reativar'}
                </Button>
              </div>
            </li>
          ))}
          {(users ?? []).length === 0 && (
            <li className="py-3 text-sm text-ink-muted">Nenhum usuário cadastrado.</li>
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-border-subtle bg-surface p-5">
        <h2 className="mb-4 font-semibold">Novo usuário</h2>
        <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="new-name" required>
            <Input
              id="new-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>

          <Field label="E-mail" htmlFor="new-email" required>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>

          <Field label="Senha" htmlFor="new-password" required hint="Mínimo de 8 caracteres.">
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </Field>

          <Field label="Perfil" htmlFor="new-role" required>
            <Select
              id="new-role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Criando…' : 'Criar usuário'}
            </Button>
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
