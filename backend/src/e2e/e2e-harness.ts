import { existsSync } from 'fs';
import http, { type Server } from 'http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app';
import { supportGateway } from '../modules/realtime/support.gateway';

const WINDOWS_MONGOD = 'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe';

export type ApiEnvelope<T> = {
  message: string;
  data: T;
  errorCode?: string;
};

type ApiRequestInit = {
  method?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export type ApiE2EHarness = {
  baseUrl: string;
  request<T>(path: string, init?: ApiRequestInit): Promise<{
    response: Response;
    payload: ApiEnvelope<T>;
  }>;
  stop(): Promise<void>;
};

type ApiE2EHarnessOptions = {
  databaseName?: string;
  port?: number;
};

const listen = (server: Server, port: number) => new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', () => {
    server.off('error', reject);
    resolve();
  });
});

const closeServer = (server: Server) => new Promise<void>((resolve, reject) => {
  if (!server.listening) {
    resolve();
    return;
  }
  server.close((error) => error ? reject(error) : resolve());
});

export const startApiE2EHarness = async (
  options: ApiE2EHarnessOptions = {},
): Promise<ApiE2EHarness> => {
  const configuredMongod = process.env.MONGOMS_SYSTEM_BINARY;
  const systemBinary = configuredMongod || (existsSync(WINDOWS_MONGOD) ? WINDOWS_MONGOD : undefined);
  const binaryVersion = process.env.MONGOMS_VERSION
    || (systemBinary === WINDOWS_MONGOD ? '8.3.2' : undefined);
  const replicaSet = await MongoMemoryReplSet.create({
    binary: systemBinary ? { systemBinary, version: binaryVersion } : undefined,
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  await mongoose.connect(replicaSet.getUri(options.databaseName ?? 'fashion-ecommerce-api-e2e'));
  const server = http.createServer(app);
  supportGateway.attach(server);
  await listen(server, options.port ?? 0);
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('E2E API server did not expose a TCP port');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    async request<T>(path: string, init: ApiRequestInit = {}) {
      const headers = new Headers(init.headers);
      if (init.token) headers.set('Authorization', `Bearer ${init.token}`);

      let body: BodyInit | undefined;
      if (init.body instanceof FormData) {
        body = init.body;
      } else if (init.body !== undefined) {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(init.body);
      }

      const response = await fetch(`${baseUrl}${path}`, {
        method: init.method ?? (body ? 'POST' : 'GET'),
        headers,
        body,
        redirect: 'manual',
      });
      const contentType = response.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json')
        ? await response.json() as ApiEnvelope<T>
        : { message: await response.text(), data: undefined as T };
      return { response, payload };
    },
    async stop() {
      await supportGateway.close();
      await closeServer(server);
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
      await replicaSet.stop();
    },
  };
};
