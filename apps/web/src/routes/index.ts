// Ponto único para enxergar TODAS as rotas que o site conhece.
// Cada arquivo espelha um controller da API e contém apenas a declaração das
// rotas daquele caso de uso — a chamada em si vive em `lib/*-endpoints.ts`.

export { authRoute } from './authRoute';
export { menuRoute } from './menuRoute';
export { storeRoute } from './storeRoute';
export { orderRoute, type OrderHistoryQuery } from './orderRoute';
export { paymentRoute } from './paymentRoute';
export { panelRoute } from './panelRoute';
export { userRoute } from './userRoute';
export { auditRoute, type AuditQuery } from './auditRoute';
export { route, type HttpMethod, type Route } from './types';
