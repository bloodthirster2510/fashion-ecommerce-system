import React from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { useSupportRealtime } from '../supportSocket';

jest.mock('../../../config/api', () => ({
  API_BASE_URL: 'https://api.example.com/api',
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
  },
}));

type Handler = (...args: unknown[]) => void;

class FakeSocket {
  connected = false;
  handlers = new Map<string, Set<Handler>>();
  on = jest.fn((event: string, handler: Handler) => {
    const handlers = this.handlers.get(event) ?? new Set<Handler>();
    handlers.add(handler);
    this.handlers.set(event, handlers);
    return this;
  });
  off = jest.fn((event: string, handler: Handler) => {
    this.handlers.get(event)?.delete(handler);
    return this;
  });
  emit = jest.fn();
  connect = jest.fn(() => this);
  disconnect = jest.fn(() => {
    this.connected = false;
    return this;
  });

  trigger(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((handler) => handler(...args));
  }
}

const renderer = jest.requireActual('react-test-renderer') as {
  act: (action: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    update: (element: React.ReactElement) => void;
    unmount: () => void;
  };
};
const mockedIo = io as jest.MockedFunction<typeof io>;
const mockedAppState = AppState as typeof AppState & {
  addEventListener: jest.Mock;
};

describe('mobile support realtime lifecycle', () => {
  let socket: FakeSocket;
  let appStateHandler: ((state: string) => void) | undefined;
  let realtime: ReturnType<typeof useSupportRealtime>;
  let tree: ReturnType<typeof renderer.create> | null = null;

  const Consumer = ({ token }: { token: string | null }) => {
    realtime = useSupportRealtime(token, {});
    return null;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(mockedAppState, 'currentState', { value: 'active', writable: true });
    socket = new FakeSocket();
    mockedIo.mockReturnValue(socket as never);
    mockedAppState.addEventListener.mockImplementation((_event, handler) => {
      appStateHandler = handler;
      return { remove: jest.fn() };
    });
  });

  afterEach(async () => {
    if (tree) {
      await renderer.act(async () => tree?.unmount());
      tree = null;
    }
  });

  const renderHook = async (token: string | null = 'access-token') => {
    await renderer.act(async () => {
      tree = renderer.create(<Consumer token={token} />);
    });
  };

  it('re-subscribes active tickets whenever the socket reconnects', async () => {
    await renderHook();
    realtime.subscribeTicket('665000000000000000000001');
    expect(socket.emit).not.toHaveBeenCalled();

    await renderer.act(async () => {
      socket.connected = true;
      socket.trigger('connect');
    });
    await renderer.act(async () => {
      socket.connected = false;
      socket.trigger('disconnect');
      socket.connected = true;
      socket.trigger('connect');
    });

    expect(socket.emit).toHaveBeenCalledTimes(2);
    expect(socket.emit).toHaveBeenLastCalledWith(
      'ticket:subscribe',
      '665000000000000000000001',
    );
  });

  it('does not replay stale typing events after reconnecting', async () => {
    await renderHook();
    realtime.emitTyping('665000000000000000000001', true);
    expect(socket.emit).not.toHaveBeenCalled();

    await renderer.act(async () => {
      socket.connected = true;
      socket.trigger('connect');
    });
    realtime.emitTyping('665000000000000000000001', true);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('ticket:typing', {
      ticketId: '665000000000000000000001',
      isTyping: true,
    });
  });

  it('disconnects in background and reconnects when the app becomes active', async () => {
    await renderHook();

    expect(mockedIo).toHaveBeenCalledWith(
      'https://api.example.com',
      expect.objectContaining({ autoConnect: false }),
    );
    expect(mockedAppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    await renderer.act(async () => appStateHandler?.('background'));
    expect(socket.disconnect).toHaveBeenCalled();

    await renderer.act(async () => appStateHandler?.('active'));
    expect(socket.connect).toHaveBeenCalledTimes(2);
  });

  it('does not start a socket while the app is already in the background', async () => {
    Object.defineProperty(mockedAppState, 'currentState', { value: 'background', writable: true });
    await renderHook();

    expect(socket.connect).not.toHaveBeenCalled();
    await renderer.act(async () => appStateHandler?.('active'));
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it('clears connected state and the old socket when the user logs out', async () => {
    await renderHook();
    await renderer.act(async () => {
      socket.connected = true;
      socket.trigger('connect');
    });
    expect(realtime.connected).toBe(true);

    await renderer.act(async () => {
      tree?.update(<Consumer token={null} />);
    });

    expect(socket.disconnect).toHaveBeenCalled();
    expect(realtime.connected).toBe(false);
  });
});
