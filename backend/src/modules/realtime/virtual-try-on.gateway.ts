import type { Server as HttpServer } from 'http';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import { Types } from 'mongoose';
import {
  VirtualTryOnJob,
  type VirtualTryOnJobStatus,
  type VirtualTryOnProcessingStage,
  type VirtualTryOnVideoStatus,
} from '../../database/models';
import { isCorsOriginAllowed } from '../../middlewares/security.middleware';
import { verifyAccessToken, type JwtPayload } from '../../utils/jwt';

export type VirtualTryOnRealtimeEvent = {
  type: 'queued' | 'processing' | 'progress' | 'succeeded' | 'failed' | 'canceled';
  jobId: string;
  status: VirtualTryOnJobStatus;
  progress: number;
  processingStage?: VirtualTryOnProcessingStage;
  generatedImageUrl?: string | null;
  generatedImageUrls?: string[];
  generatedVideoUrl?: string | null;
  videoStatus?: VirtualTryOnVideoStatus;
  videoProgress?: number;
  videoErrorCode?: string | null;
  videoErrorMessage?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  at: string;
};

type VirtualTryOnSocketMeta = {
  user: JwtPayload;
};

const jobRoom = (jobId: string) => `virtual-try-on:job:${jobId}`;
const userRoom = (userId: string) => `user:${userId}`;

class VirtualTryOnRealtimeGateway {
  private io: Server | null = null;

  attach(server: HttpServer) {
    this.io = new Server(server, {
      path: '/realtime/virtual-try-on',
      cors: {
        origin(origin, callback) {
          callback(null, !origin || isCorsOriginAllowed(origin));
        },
        credentials: true,
        methods: ['GET', 'POST'],
      },
      maxHttpBufferSize: 1e6,
    });
    this.io.use((socket, next) => { void this.authenticate(socket, next); });
    this.io.on('connection', (socket) => this.handleConnection(socket));
    console.log('[realtime] Virtual try-on gateway attached at /realtime/virtual-try-on');
  }

  private async authenticate(socket: Socket, next: (error?: Error) => void) {
    try {
      const raw = (socket.handshake.auth?.token as string | undefined)
        ?? (typeof socket.handshake.query.token === 'string' ? socket.handshake.query.token : undefined);
      if (!raw) return next(new Error('Authentication required'));
      const decoded = verifyAccessToken(raw);
      if (!decoded?.userId) return next(new Error('Invalid token'));
      (socket.data as VirtualTryOnSocketMeta).user = decoded;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  }

  private handleConnection(socket: Socket) {
    const meta = socket.data as VirtualTryOnSocketMeta;
    socket.join(userRoom(meta.user.userId));

    socket.on('virtual_try_on:subscribe', async (jobId: unknown, ack?: (ok: boolean) => void) => {
      if (typeof jobId !== 'string' || !Types.ObjectId.isValid(jobId)) {
        ack?.(false);
        return;
      }

      try {
        const canSubscribe = Boolean(await VirtualTryOnJob.exists({
          _id: jobId,
          userId: meta.user.userId,
          deletedAt: null,
        }));
        if (!canSubscribe) {
          ack?.(false);
          return;
        }
        await socket.join(jobRoom(jobId));
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('virtual_try_on:unsubscribe', (jobId: unknown) => {
      if (typeof jobId === 'string') socket.leave(jobRoom(jobId));
    });
  }

  emitJobEvent(userId: string, event: VirtualTryOnRealtimeEvent) {
    if (!this.io) return;
    this.io.to(userRoom(userId)).to(jobRoom(event.jobId)).emit('virtual_try_on:event', event);
  }

  async close() {
    const io = this.io;
    this.io = null;
    if (io) await new Promise<void>((resolve) => io.close(() => resolve()));
  }
}

export const virtualTryOnGateway = new VirtualTryOnRealtimeGateway();

export const emitVirtualTryOnJobEvent = (
  userId: string,
  event: Omit<VirtualTryOnRealtimeEvent, 'at'>,
) => {
  virtualTryOnGateway.emitJobEvent(userId, {
    ...event,
    at: new Date().toISOString(),
  });
};

