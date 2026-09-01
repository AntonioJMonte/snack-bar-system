import { route } from './types';

// Usuários e perfis — apps/api/src/users/users.controller.ts
// Exclusivo do administrador (seção 5.5). A senha nunca volta em resposta.
export const userRoute = {
  list: route('GET', () => '/users', 'admin'),
  create: route('POST', () => '/users', 'admin'),
  update: route('PATCH', (userId: string) => `/users/${userId}`, 'admin'),
} as const;
