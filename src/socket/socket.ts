import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { isValidUuid } from '../utils/uuid.js';

interface SocketUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

declare module 'socket.io' {
  interface SocketData {
    user: SocketUser;
  }
}

let io: Server | null = null;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }
  return [env.FRONTEND_URL, env.CORS_ORIGIN, env.MASTER_URL].includes(origin);
}

export function initSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const authHeader = socket.handshake.headers.authorization;
    const bearer =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : undefined;
    const token = (socket.handshake.auth?.token as string | undefined) || bearer;

    if (!token || token === 'none') {
      return next(new Error('Unauthorized'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as SocketUser;
      if (!isValidUuid(decoded.id)) {
        return next(new Error('Unauthorized'));
      }
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;
    socket.join(`user:${user.id}`);
    if (user.role === 'ADMIN') {
      socket.join('admin:orders');
    }
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitOrderUpdated(order: { id: string; userId: string | null } & Record<string, unknown>): void {
  if (!io) return;
  const payload = { order };
  if (order.userId) {
    io.to(`user:${order.userId}`).emit('order:updated', payload);
  }
  io.to('admin:orders').emit('order:updated', payload);
}

export function emitStockUpdated(
  updates: {
    productId: string;
    stock: number;
    variantId?: string | null;
    variantStock?: number | null;
  }[]
): void {
  if (!io) return;
  io.emit('product:stock_updated', updates);
}
