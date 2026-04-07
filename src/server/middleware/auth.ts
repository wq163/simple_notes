import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { loadConfig } from '../utils/config.js';
import { getDb } from '../utils/database.js';

export interface AuthPayload {
  userId: string;
  username: string;
  role: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function generateToken(payload: AuthPayload, rememberMe: boolean = false): string {
  const config = loadConfig();
  const expiresIn = (rememberMe ? config.jwt.rememberMeExpiresIn : config.jwt.expiresIn) as any;
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
    const decoded = jwt.verify(token, config.jwt.secret) as AuthPayload;

    // Verify user still exists
    const user = getDb().prepare('SELECT id FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      res.status(401).json({ error: '用户不存在' });
      return;
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  next();
}
