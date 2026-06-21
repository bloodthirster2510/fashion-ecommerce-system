import { useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { axiosClient } from '../../services/axiosClient'
import { tokenService } from '../../services/tokenService'
import type { SupportMessage, SupportTicket } from './support.types'

export type CustomerSupportEvent =
  | { type: 'message'; ticketId: string; message: SupportMessage; at: string }
  | { type: 'typing'; ticketId: string; isTyping: boolean; senderId?: string; at: string }
  | { type: 'read'; ticketId: string; scope?: 'admin' | 'customer'; at: string }
  | { type: 'updated'; ticketId: string; ticket: SupportTicket; at: string }

const SOCKET_PATH = '/realtime/support'

const resolveSocketUrl = () => {
  const base = axiosClient.baseURL
  try {
    const url = new URL(base)
    return `${url.protocol}//${url.host}`
  } catch {
    return 'http://localhost:5000'
  }
}

let sharedSocket: Socket | null = null
let referenceCount = 0

const acquireSocket = (token: string) => {
  referenceCount += 1
  if (sharedSocket && sharedSocket.connected) return sharedSocket
  if (sharedSocket) {
    sharedSocket.auth = { token }
    return sharedSocket
  }
  sharedSocket = io(resolveSocketUrl(), {
    path: SOCKET_PATH,
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  })
  return sharedSocket
}

const releaseSocket = () => {
  referenceCount = Math.max(0, referenceCount - 1)
  if (referenceCount === 0 && sharedSocket) {
    sharedSocket.disconnect()
    sharedSocket = null
  }
}

export type CustomerSupportHandlers = {
  onMessage?: (ticketId: string, message: SupportMessage) => void
  onTyping?: (ticketId: string, isTyping: boolean) => void
  onUpdated?: (ticketId: string, ticket: SupportTicket) => void
  onStaffRead?: (ticketId: string) => void
}

export function useCustomerSupportRealtime(handlers: CustomerSupportHandlers) {
  const handlersRef = useRef(handlers)
  const [connected, setConnected] = useState(false)

  useEffect(() => { handlersRef.current = handlers })

  useEffect(() => {
    const token = tokenService.getAccessToken()
    if (!token) return
    let socket: Socket | null = acquireSocket(token)

    const refreshAndReconnect = async () => {
      try {
        const res = await fetch(`${axiosClient.baseURL}/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Refresh-Token-Mode': 'cookie' },
          credentials: 'include',
        })
        const result = (await res.json().catch(() => ({}))) as { data?: { accessToken?: string } }
        if (res.ok && result.data?.accessToken) {
          tokenService.setAccessToken(result.data.accessToken)
          if (sharedSocket) sharedSocket.auth = { token: result.data.accessToken }
          socket?.connect()
        }
      } catch { /* ignore */ }
    }

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onConnectError = (err: Error & { message?: string }) => {
      if (err.message === 'Invalid or expired token') void refreshAndReconnect()
    }
    const onEvent = (event: CustomerSupportEvent) => {
      const h = handlersRef.current
      if (event.type === 'message' && h.onMessage) h.onMessage(event.ticketId, event.message)
      else if (event.type === 'typing' && h.onTyping) h.onTyping(event.ticketId, event.isTyping)
      else if (event.type === 'updated' && h.onUpdated) h.onUpdated(event.ticketId, event.ticket)
      else if (event.type === 'read' && event.scope === 'admin' && h.onStaffRead) h.onStaffRead(event.ticketId)
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
      releaseSocket()
      socket = null
    }
  }, [])

  return useMemo(() => ({
    connected,
    subscribeTicket: (ticketId: string) => sharedSocket?.emit('ticket:subscribe', ticketId),
    unsubscribeTicket: (ticketId: string) => sharedSocket?.emit('ticket:unsubscribe', ticketId),
    emitTyping: (ticketId: string, isTyping: boolean) => sharedSocket?.emit('ticket:typing', { ticketId, isTyping }),
  }), [connected])
}