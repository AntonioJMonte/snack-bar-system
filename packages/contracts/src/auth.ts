import { z } from 'zod';

// POST /auth/login
export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// Payload do JWT (assinado pela API; o web só decodifica para exibir nome/perfil —
// a autorização REAL é sempre verificada no servidor, seção 12.2).
export const jwtPayloadSchema = z.object({
  sub: z.string(),
  role: z.enum(['attendant', 'manager', 'admin']),
  name: z.string(),
  exp: z.number().optional(),
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
