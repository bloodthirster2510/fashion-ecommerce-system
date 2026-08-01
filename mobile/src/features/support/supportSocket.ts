import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
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
  const subscribedTicketIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!token) {
      subscribedTicketIdsRef.current.clear();
      setConnected(false);
      return;
    }
    const socket = io(resolveSocketUrl(), {
      path: SOCKET_PATH,
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      subscribedTicketIdsRef.current.forEach((ticketId) => {
        socket.emit('ticket:subscribe', ticketId);
      });
    };
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
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (!socket.connected) socket.connect();
        return;
      }

      setConnected(false);
      socket.disconnect();
    });
    if (AppState.currentState === 'active' && !socket.connected) socket.connect();

    return () => {
      appStateSubscription.remove();
      setConnected(false);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('ticket:event', onEvent);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const subscribeTicket = useCallback((ticketId: string) => {
    subscribedTicketIdsRef.current.add(ticketId);
    const socket = socketRef.current;
    if (socket?.connected) socket.emit('ticket:subscribe', ticketId);
  }, []);

  const unsubscribeTicket = useCallback((ticketId: string) => {
    subscribedTicketIdsRef.current.delete(ticketId);
    const socket = socketRef.current;
    if (socket?.connected) socket.emit('ticket:unsubscribe', ticketId);
  }, []);

  const emitTyping = useCallback((ticketId: string, isTyping: boolean) => {
    const socket = socketRef.current;
    if (socket?.connected) socket.emit('ticket:typing', { ticketId, isTyping });
  }, []);

  return useMemo(() => ({
    connected,
    subscribeTicket,
    unsubscribeTicket,
    emitTyping,
  }), [connected, emitTyping, subscribeTicket, unsubscribeTicket]);
}
