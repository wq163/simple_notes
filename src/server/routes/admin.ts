import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../utils/database.js';
import { ensureUserDirs } from '../utils/database.js';
import { adminMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require admin
router.use(adminMiddleware);

// GET /api/admin/users
router.get('/users', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const users = db.prepare(
      'SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC'
    ).all();

    res.json(users.map((u: any) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      createdAt: u.created_at,
    })));
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// POST /api/admin/users
router.post('/users', (req: Request, res: Response) => {
  try {
    const { username, password, displayName } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: '请输入用户名和密码' });
      return;
    }

    if (password.length < 4) {
      res.status(400).json({ error: '密码至少4个字符' });
      return;
    }

    const db = getDb();

    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(400).json({ error: '用户名已存在' });
      return;
    }

    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, 'user')
    `).run(userId, username, passwordHash, displayName || username);

    // Create default category for new user
    const defaultCatId = uuidv4();
    db.prepare(`
      INSERT INTO categories (id, user_id, name, is_default, sort_order)
      VALUES (?, ?, '默认', 1, 0)
    `).run(defaultCatId, userId);

    // Create default settings
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(userId);

    // Create user directories
    ensureUserDirs(username);

    res.status(201).json({
      id: userId,
      username,
      displayName: displayName || username,
      role: 'user',
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: '创建用户失败' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    if (user.role === 'admin') {
      res.status(400).json({ error: '不能删除管理员账号' });
      return;
    }

    // CASCADE will handle related data cleanup
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.json({ message: '用户已删除' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

export default router;
