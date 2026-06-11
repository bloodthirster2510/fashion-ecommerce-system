import jwt from 'jsonwebtoken';

const getJwtSecret = (envName: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET', devFallback: string) => {
  const secret = process.env[envName]?.trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${envName} is required in production`);
  }

  return devFallback;
};

const JWT_ACCESS_SECRET = getJwtSecret('JWT_ACCESS_SECRET', 'local-access-secret');
const JWT_REFRESH_SECRET = getJwtSecret('JWT_REFRESH_SECRET', 'local-refresh-secret');
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
};
