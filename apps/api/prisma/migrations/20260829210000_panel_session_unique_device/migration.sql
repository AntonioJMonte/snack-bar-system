-- Um registro de sessão de painel por usuário+dispositivo, para o heartbeat
-- fazer upsert (seção 8.2: sinal de vida a cada 30s).
CREATE UNIQUE INDEX "panel_sessions_user_id_device_key" ON "panel_sessions"("user_id", "device");
