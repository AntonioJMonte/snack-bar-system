import { LoginForm } from '@/components/panel/login-form';

export default function PanelLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Painel da loja</h1>
      <p className="mb-6 text-sm text-ink-muted">Entre para ver e aceitar os pedidos.</p>
      <LoginForm />
    </main>
  );
}
