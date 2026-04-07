import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../utils/database.js';
import { generateToken, AuthPayload } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password, rememberMe } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: '请输入用户名和密码' });
      return;
    }

    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, password_hash, display_name, role FROM users WHERE username = ?'
    ).get(username) as any;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }

    const payload: AuthPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const token = generateToken(payload, !!rememberMe);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// POST /api/auth/logout (client-side token removal, this is just a placeholder)
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: '已登出' });
});

export default router;
