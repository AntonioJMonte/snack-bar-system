import { route } from './types';

// Autenticação — apps/api/src/auth/auth.controller.ts
export const authRoute = {
  login: route('POST', () => '/auth/login', null),
} as const;
