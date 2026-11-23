import { randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { loadConfig } from '../utils/config.js';
import { getDb } from '../utils/database.js';

export interface AuthPayload {
  userId: string;
  username: string;
  role: string;
}

type RememberedAuthPayload = AuthPayload & { sessionId?: string };

export const renewedTokenHeader = 'X-Renewed-Token';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function generateToken(payload: AuthPayload, rememberMe: boolean = false): string {
  return signToken(rememberMe ? { ...payload, sessionId: randomUUID() } : payload);
}

function signToken(payload: RememberedAuthPayload): string {
  const config = loadConfig();
  const expiresIn = (payload.sessionId ? config.jwt.rememberMeExpiresIn : config.jwt.expiresIn) as SignOptions['expiresIn'];
  return jwt.sign(payload, config.jwt.secret, { expiresIn });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录或登录已过期' });
    return;
  }

  const token = authHeader.slice(7);
  const config = loadConfig();

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as RememberedAuthPayload;

    // Verify user still exists
    const user = getDb().prepare('SELECT id AS userId, username, role FROM users WHERE id = ?')
      .get(decoded.userId) as AuthPayload | undefined;
    if (!user) {
      res.status(401).json({ error: '用户不存在' });
      return;
    }

    req.user = user;
    if (decoded.sessionId) {
      res.setHeader(renewedTokenHeader, signToken({ ...user, sessionId: decoded.sessionId }));
      res.setHeader('Cache-Control', 'private, no-store');
    }
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
    return;
  }
  next();
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  next();
}
