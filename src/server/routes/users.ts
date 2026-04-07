import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../utils/database.js';

const router = Router();

// GET /api/users/me
router.get('/me', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, display_name, role, created_at FROM users WHERE id = ?'
    ).get(req.user!.userId) as any;

    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// PUT /api/users/me
router.put('/me', (req: Request, res: Response) => {
  try {
    const { displayName } = req.body;
    const db = getDb();

    if (displayName !== undefined) {
      db.prepare('UPDATE users SET display_name = ?, updated_at = datetime("now") WHERE id = ?')
        .run(displayName, req.user!.userId);
    }

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// PUT /api/users/me/password
router.put('/me/password', (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: '请输入旧密码和新密码' });
      return;
    }

    if (newPassword.length < 4) {
      res.status(400).json({ error: '新密码至少4个字符' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(req.user!.userId) as any;

    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      res.status(400).json({ error: '旧密码错误' });
      return;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?')
      .run(newHash, req.user!.userId);

    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: '密码修改失败' });
  }
});

export default router;
