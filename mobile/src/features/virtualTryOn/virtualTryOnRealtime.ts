import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URLS } from '../../config/api';

export type VirtualTryOnRealtimeEvent = {
  type: 'queued' | 'processing' | 'progress' | 'succeeded' | 'failed' | 'canceled';
  jobId: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  progress: number;
  generatedImageUrl?: string | null;
  generatedVideoUrl?: string | null;
  errorMessage?: string | null;
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

export const useVirtualTryOnRealtime = (
  token: string | null | undefined,
  onEvent: (event: VirtualTryOnRealtimeEvent) => void,
) => {
  const handlerRef = useRef(onEvent);
  const subscriptionsRef = useRef(new Set<string>());
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketUrlIndex, setSocketUrlIndex] = useState(0);

  useEffect(() => { handlerRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!token) return;
    const socketUrl = SOCKET_URLS[socketUrlIndex] ?? 'http://localhost:5000';
    let didConnect = false;
    const socket = io(socketUrl, {
      path: '/realtime/virtual-try-on',
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
      subscriptionsRef.current.forEach((jobId) => socket.emit('virtual_try_on:subscribe', jobId));
    };
    const handleDisconnect = () => setConnected(false);
    const handleConnectError = () => {
      if (didConnect || SOCKET_URLS.length <= 1) return;
      setSocketUrlIndex((current) => (current + 1) % SOCKET_URLS.length);
    };
    const handleEvent = (event: VirtualTryOnRealtimeEvent) => handlerRef.current(event);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('virtual_try_on:event', handleEvent);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('virtual_try_on:event', handleEvent);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [socketUrlIndex, token]);

  return useMemo(() => ({
    connected,
    subscribeJob: (jobId: string) => {
      subscriptionsRef.current.add(jobId);
      socketRef.current?.emit('virtual_try_on:subscribe', jobId);
    },
    unsubscribeJob: (jobId: string) => {
      subscriptionsRef.current.delete(jobId);
      socketRef.current?.emit('virtual_try_on:unsubscribe', jobId);
    },
  }), [connected]);
};

