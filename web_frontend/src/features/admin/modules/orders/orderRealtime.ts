import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../../../../config/api'
import { getAdminSession } from '../auth/adminSession'
import { refreshAdminSession } from '../auth/auth.service'

export type OrderRealtimeEvent = {
  type: 'shipping_update' | 'status_update' | 'payment_update' | 'summary'
  orderId: string
  orderCode: string
  userId?: string
  before?: { status: string; shippingStatus?: string | null }
  after?: { status: string; shippingStatus?: string | null; trackingCode?: string | null }
  milestone?: 'picked' | 'shipping' | 'delivered' | 'failed' | 'cancelled'
  at: string
}

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

const acquireSocket = (token: string) => {
  referenceCount += 1
  if (sharedSocket) {
    sharedSocket.auth = { token }
    return sharedSocket
  }
  sharedSocket = io(SOCKET_URL, {
    path: '/realtime/orders',
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

export const useOrderRealtime = (onEvent: (event: OrderRealtimeEvent) => void) => {
  const handlerRef = useRef(onEvent)
  useEffect(() => { handlerRef.current = onEvent }, [onEvent])

  useEffect(() => {
    const session = getAdminSession()
    if (!session) return
    let socket: Socket | null = acquireSocket(session.accessToken)

    const refreshAndReconnect = async () => {
      try {
        const next = await refreshAdminSession()
        if (sharedSocket) sharedSocket.auth = { token: next.accessToken }
        socket?.connect()
      } catch {
        // The normal admin auth flow will handle an expired refresh session.
      }
    }
    const handleConnectError = (error: Error) => {
      if (error.message === 'Invalid or expired token') void refreshAndReconnect()
    }
    const handleEvent = (event: OrderRealtimeEvent) => handlerRef.current(event)
    socket.on('connect_error', handleConnectError)
    socket.on('order:event', handleEvent)
    if (!socket.connected) socket.connect()

    return () => {
      socket?.off('connect_error', handleConnectError)
      socket?.off('order:event', handleEvent)
      releaseSocket()
      socket = null
    }
  }, [])
}
