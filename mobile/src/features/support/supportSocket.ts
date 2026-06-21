import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../../config/api';
import type { SupportMessage, SupportTicket } from './support.types';

export type SupportRealtimeEvent =
  | { type: 'message'; ticketId: string; message: SupportMessage; at: string }
  | { type: 'typing'; ticketId: string; isTyping: boolean; senderId?: string; at: string }
  | { type: 'read'; ticketId: string; scope?: 'admin' | 'customer'; at: string }
  | { type: 'updated'; ticketId: string; ticket: SupportTicket; at: string };

const SOCKET_PATH = '/realtime/support';

const resolveSocketUrl = () => {
  try {
    const url = new URL(API_BASE_URL);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'http://localhost:5000';
  }
};

type Handlers = {
  onMessage?: (ticketId: string, message: SupportMessage) => void;
  onTyping?: (ticketId: string, isTyping: boolean) => void;
  onUpdated?: (ticketId: string, ticket: SupportTicket) => void;
  onStaffRead?: (ticketId: string) => void;
};

export function useSupportRealtime(token: string | null, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    const socket = io(resolveSocketUrl(), {
      path: SOCKET_PATH,
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onEvent = (event: SupportRealtimeEvent) => {
      const h = handlersRef.current;
      if (event.type === 'message' && h.onMessage) h.onMessage(event.ticketId, event.message);
      else if (event.type === 'typing' && h.onTyping) h.onTyping(event.ticketId, event.isTyping);
      else if (event.type === 'updated' && h.onUpdated) h.onUpdated(event.ticketId, event.ticket);
      else if (event.type === 'read' && event.scope === 'admin' && h.onStaffRead) h.onStaffRead(event.ticketId);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('ticket:event', onEvent);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('ticket:event', onEvent);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return useMemo(() => ({
    connected,
    subscribeTicket: (ticketId: string) => socketRef.current?.emit('ticket:subscribe', ticketId),
    unsubscribeTicket: (ticketId: string) => socketRef.current?.emit('ticket:unsubscribe', ticketId),
    emitTyping: (ticketId: string, isTyping: boolean) => socketRef.current?.emit('ticket:typing', { ticketId, isTyping }),
  }), [connected]);
}