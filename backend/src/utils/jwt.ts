import jwt from 'jsonwebtoken';

const getJwtSecret = (envName: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET') => {
  const secret = process.env[envName]?.trim();

  if (!secret) {
    throw new Error(`${envName} is required`);
  }

  return secret;
};

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  issuedAtMs?: number;
}

export const wasTokenIssuedBeforePasswordChange = (
  payload: JwtPayload,
  passwordChangedAt?: Date | null,
) => {
  if (!passwordChangedAt) return false;
  if (typeof payload.issuedAtMs === 'number') {
    return payload.issuedAtMs < passwordChangedAt.getTime();
  }
  const changedAtSeconds = Math.floor(passwordChangedAt.getTime() / 1000);
  return typeof payload.iat !== 'number' || payload.iat < changedAtSeconds;
};

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign({ ...payload, issuedAtMs: Date.now() }, getJwtSecret('JWT_ACCESS_SECRET'), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, getJwtSecret('JWT_REFRESH_SECRET'), {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, getJwtSecret('JWT_ACCESS_SECRET'), {
    algorithms: ['HS256'],
  }) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, getJwtSecret('JWT_REFRESH_SECRET'), {
    algorithms: ['HS256'],
  }) as JwtPayload;
};
