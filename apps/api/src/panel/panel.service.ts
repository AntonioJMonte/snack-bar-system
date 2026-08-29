import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Painel considera "morto" um dispositivo sem sinal há mais que este limite
// (heartbeat é a cada 30s; 2 minutos = 4 batidas perdidas).
const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000;

@Injectable()
export class PanelService {
  constructor(private readonly prisma: PrismaService) {}

  listActiveOrders() {
    return this.prisma.order.findMany({
      where: {
        status: { in: ['awaiting_acceptance', 'accepted', 'preparing', 'ready', 'out_for_delivery'] },
      },
      orderBy: { createdAt: 'asc' },
      include: { items: { include: { addons: true } } },
    });
  }

  heartbeat(userId: string, device: string, soundArmed: boolean) {
    const lastHeartbeatAt = new Date();
    return this.prisma.panelSession.upsert({
      where: { userId_device: { userId, device } },
      create: { userId, device, soundArmed, lastHeartbeatAt },
      update: { soundArmed, lastHeartbeatAt },
    });
  }

  async listSessions() {
    const sessions = await this.prisma.panelSession.findMany({
      include: { user: { select: { name: true, role: true } } },
      orderBy: { lastHeartbeatAt: 'desc' },
    });
    const now = Date.now();
    return sessions.map((s) => ({
      ...s,
      active: now - s.lastHeartbeatAt.getTime() < ACTIVE_THRESHOLD_MS,
    }));
  }
}
