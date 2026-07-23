import { useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../../config/api'
import {
  getOptionalCustomerAccessToken,
  getRefreshedCustomerAccessToken,
} from '../../services/customerHttp'

export type OrderRealtimeEvent = {
  type: 'shipping_update' | 'status_update' | 'payment_update' | 'summary'
  orderId: string
  orderCode: string
  userId?: string
  before?: { status: string; paymentStatus?: string | null; shippingStatus?: string | null }
  after?: {
    status: string
    paymentStatus?: string | null
    shippingStatus?: string | null
    trackingCode?: string | null
  }
  milestone?: 'ready' | 'picking' | 'picked' | 'shipping' | 'delivered' | 'failed' | 'cancelled'
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

export const useOrderRealtime = (onEvent: (event: OrderRealtimeEvent) => void) => {
  const handlerRef = useRef(onEvent)
  const socketRef = useRef<Socket | null>(null)
  const subscriptionsRef = useRef(new Set<string>())
  const [connected, setConnected] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => { handlerRef.current = onEvent }, [onEvent])

  useEffect(() => {
    let active = true
    getOptionalCustomerAccessToken()
      .then((token) => {
        if (active) setAccessToken(token)
      })
      .catch(() => {
        if (active) setAccessToken(null)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!accessToken) return

    const socket = io(SOCKET_URL, {
      path: '/realtime/orders',
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    })
    socketRef.current = socket

    const refreshAndReconnect = async () => {
      try {
        const nextAccessToken = await getRefreshedCustomerAccessToken()
        setAccessToken(nextAccessToken)
      } catch {
        setAccessToken(null)
      }
    }

    const handleConnect = () => {
      setConnected(true)
      subscriptionsRef.current.forEach((orderId) => socket.emit('order:subscribe', orderId))
    }
    const handleDisconnect = () => setConnected(false)
    const handleConnectError = (error: Error) => {
      if (error.message === 'Invalid or expired token') void refreshAndReconnect()
    }
    const handleEvent = (event: OrderRealtimeEvent) => handlerRef.current(event)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('order:event', handleEvent)
    if (!socket.connected) socket.connect()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('order:event', handleEvent)
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [accessToken])

  return useMemo(() => ({
    connected,
    subscribeOrder: (orderId: string) => {
      subscriptionsRef.current.add(orderId)
      socketRef.current?.emit('order:subscribe', orderId)
    },
    unsubscribeOrder: (orderId: string) => {
      subscriptionsRef.current.delete(orderId)
      socketRef.current?.emit('order:unsubscribe', orderId)
    },
  }), [connected])
}
