import { route } from './types';

export interface AuditQuery {
  entity?: string;
  action?: string;
  limit?: number;
}

// Registro de auditoria — apps/api/src/audit/audit.controller.ts
// Exclusivo do administrador (seção 5.5).
export const auditRoute = {
  list: route(
    'GET',
    (query: AuditQuery = {}) => {
      const params = new URLSearchParams();
      if (query.entity) params.set('entity', query.entity);
      if (query.action) params.set('action', query.action);
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      const search = params.toString();
      return search ? `/audit?${search}` : '/audit';
    },
    'admin',
  ),
} as const;
