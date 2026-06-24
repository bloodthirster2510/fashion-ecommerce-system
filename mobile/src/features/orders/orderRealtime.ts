import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../../config/api';

export type OrderRealtimeEvent = {
  type: 'shipping_update' | 'status_update' | 'payment_update' | 'summary';
  orderId: string;
  orderCode: string;
  userId?: string;
  before?: { status: string; shippingStatus?: string | null };
  after?: { status: string; shippingStatus?: string | null; trackingCode?: string | null };
  milestone?: 'picked' | 'shipping' | 'delivered' | 'failed' | 'cancelled';
  at: string;
};

const resolveSocketUrl = () => {
  try {
    const url = new URL(API_BASE_URL);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'http://localhost:5000';
  }
};

export const useOrderRealtime = (
  token: string | null | undefined,
  onEvent: (event: OrderRealtimeEvent) => void,
) => {
  const handlerRef = useRef(onEvent);
  useEffect(() => { handlerRef.current = onEvent; }, [onEvent]);
  const subscriptionsRef = useRef(new Set<string>());
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    const socket = io(resolveSocketUrl(), {
      path: '/realtime/orders',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      subscriptionsRef.current.forEach((orderId) => socket.emit('order:subscribe', orderId));
    };
    const handleDisconnect = () => setConnected(false);
    const handleEvent = (event: OrderRealtimeEvent) => handlerRef.current(event);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('order:event', handleEvent);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('order:event', handleEvent);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  return useMemo(() => ({
    connected,
    subscribeOrder: (orderId: string) => {
      subscriptionsRef.current.add(orderId);
      socketRef.current?.emit('order:subscribe', orderId);
    },
    unsubscribeOrder: (orderId: string) => {
      subscriptionsRef.current.delete(orderId);
      socketRef.current?.emit('order:unsubscribe', orderId);
    },
  }), [connected]);
};
