import { useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../../../../config/api'
import { getAdminSession } from '../auth/adminSession'
import { refreshAdminSession } from '../auth/auth.service'
import type { SupportMessage, SupportTicket } from './support.types'

export type SupportRealtimeEvent =
  | { type: 'message'; ticketId: string; message: SupportMessage; isInternal?: boolean; scope?: 'admin' | 'customer'; at: string }
  | { type: 'typing'; ticketId: string; scope?: 'admin' | 'customer'; senderId?: string; isTyping: boolean; at: string }
  | { type: 'read'; ticketId: string; scope?: 'admin' | 'customer'; at: string }
  | { type: 'updated'; ticketId: string; ticket: SupportTicket; scope?: 'admin' | 'customer'; at: string }
  | { type: 'summary'; at: string }

const SOCKET_PATH = '/realtime/support'
const SOCKET_URL = (() => {
  try {
    const url = new URL(API_BASE_URL)
    return `${url.protocol}//${url.host}`
  } catch {
    return API_BASE_URL
  }
})()

let sharedSocket: Socket | null = null
let referenceCount = 0

const getSharedSocket = (token: string) => {
  if (sharedSocket && sharedSocket.connected) return sharedSocket
  if (sharedSocket) {
    sharedSocket.auth = { token }
    return sharedSocket
  }
  sharedSocket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  })
  return sharedSocket
}

const releaseSharedSocket = () => {
  referenceCount = Math.max(0, referenceCount - 1)
  if (referenceCount === 0 && sharedSocket) {
    sharedSocket.disconnect()
    sharedSocket = null
  }
}

const acquireSharedSocket = (token: string) => {
  referenceCount += 1
  return getSharedSocket(token)
}

export type SupportRealtimeHandlers = {
  onMessage?: (ticketId: string, message: SupportMessage, isInternal: boolean) => void
  onTyping?: (ticketId: string, isTyping: boolean, senderId?: string) => void
  onRead?: (ticketId: string, scope: 'admin' | 'customer') => void
  onUpdated?: (ticketId: string, ticket: SupportTicket) => void
  onSummary?: () => void
}

export function useSupportRealtime(handlers: SupportRealtimeHandlers) {
  const handlersRef = useRef(handlers)
  const [connected, setConnected] = useState(false)

  useEffect(() => { handlersRef.current = handlers })

  useEffect(() => {
    const session = getAdminSession()
    if (!session) return
    let socket: Socket | null = acquireSharedSocket(session.accessToken)

    const refreshAndReconnect = async () => {
      try {
        const next = await refreshAdminSession()
        if (sharedSocket) sharedSocket.auth = { token: next.accessToken }
        socket?.connect()
      } catch {
        /* ignore */
      }
    }

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onConnectError = (err: Error & { message?: string }) => {
      if (err.message === 'Invalid or expired token') void refreshAndReconnect()
    }
    const onEvent = (event: SupportRealtimeEvent) => {
      const h = handlersRef.current
      if (event.type === 'message' && h.onMessage) h.onMessage(event.ticketId, event.message, Boolean(event.isInternal))
      else if (event.type === 'typing' && h.onTyping) h.onTyping(event.ticketId, event.isTyping, event.senderId)
      else if (event.type === 'read' && h.onRead && event.scope) h.onRead(event.ticketId, event.scope)
      else if (event.type === 'updated' && h.onUpdated) h.onUpdated(event.ticketId, event.ticket)
      else if (event.type === 'summary' && h.onSummary) h.onSummary()
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('ticket:event', onEvent)

    if (!socket.connected) socket.connect()

    return () => {
      socket?.off('connect', onConnect)
      socket?.off('disconnect', onDisconnect)
      socket?.off('connect_error', onConnectError)
      socket?.off('ticket:event', onEvent)
      releaseSharedSocket()
      socket = null
    }
  }, [])

  return useMemo(() => ({
    connected,
    subscribeTicket: (ticketId: string) => {
      if (!sharedSocket) return
      sharedSocket.emit('ticket:subscribe', ticketId)
    },
    unsubscribeTicket: (ticketId: string) => {
      if (!sharedSocket) return
      sharedSocket.emit('ticket:unsubscribe', ticketId)
    },
    emitTyping: (ticketId: string, isTyping: boolean) => {
      if (!sharedSocket) return
      sharedSocket.emit('ticket:typing', { ticketId, isTyping })
    },
  }), [connected])
}