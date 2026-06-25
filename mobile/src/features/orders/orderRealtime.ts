import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URLS } from '../../config/api';

export type OrderRealtimeEvent = {
  type: 'shipping_update' | 'status_update' | 'payment_update' | 'summary';
  orderId: string;
  orderCode: string;
  userId?: string;
  before?: { status: string; paymentStatus?: string | null; shippingStatus?: string | null };
  after?: {
    status: string;
    paymentStatus?: string | null;
    shippingStatus?: string | null;
    trackingCode?: string | null;
  };
  milestone?: 'ready' | 'picking' | 'picked' | 'shipping' | 'delivered' | 'failed' | 'cancelled';
  at: string;
};

const toSocketUrl = (apiBaseUrl: string) => {
  try {
    const url = new URL(apiBaseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
};

const SOCKET_URLS = Array.from(new Set(
  API_BASE_URLS
    .map(toSocketUrl)
    .filter((value): value is string => Boolean(value)),
));

export const useOrderRealtime = (
  token: string | null | undefined,
  onEvent: (event: OrderRealtimeEvent) => void,
) => {
  const handlerRef = useRef(onEvent);
  useEffect(() => { handlerRef.current = onEvent; }, [onEvent]);
  const subscriptionsRef = useRef(new Set<string>());
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketUrlIndex, setSocketUrlIndex] = useState(0);

  useEffect(() => {
    if (!token) return;
    const socketUrl = SOCKET_URLS[socketUrlIndex] ?? 'http://localhost:5000';
    let didConnect = false;
    const socket = io(socketUrl, {
      path: '/realtime/orders',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    const handleConnect = () => {
      didConnect = true;
      setConnected(true);
      subscriptionsRef.current.forEach((orderId) => socket.emit('order:subscribe', orderId));
    };
    const handleDisconnect = () => setConnected(false);
    const handleConnectError = () => {
      if (didConnect || SOCKET_URLS.length <= 1) return;
      setSocketUrlIndex((current) => (current + 1) % SOCKET_URLS.length);
    };
    const handleEvent = (event: OrderRealtimeEvent) => handlerRef.current(event);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('order:event', handleEvent);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('order:event', handleEvent);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [socketUrlIndex, token]);

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
