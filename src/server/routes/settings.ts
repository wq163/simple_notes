import { Router, Request, Response } from 'express';
import { getDb } from '../utils/database.js';

const router = Router();

// GET /api/settings
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const settings = db.prepare(
      'SELECT theme, font_size, default_editor_mode FROM user_settings WHERE user_id = ?'
    ).get(req.user!.userId) as any;

    if (!settings) {
      res.json({ theme: 'light', fontSize: 16, defaultEditorMode: 'edit' });
      return;
    }

    res.json({
      theme: settings.theme,
      fontSize: settings.font_size,
      defaultEditorMode: settings.default_editor_mode,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: '获取设置失败' });
  }
});

// PUT /api/settings
router.put('/', (req: Request, res: Response) => {
  try {
    const { theme, fontSize, defaultEditorMode } = req.body;
    const db = getDb();

    const updates: string[] = [];
    const values: any[] = [];

    if (theme !== undefined) {
      if (!['light', 'dark'].includes(theme)) {
        res.status(400).json({ error: '无效的主题' });
        return;
      }
      updates.push('theme = ?');
      values.push(theme);
    }

    if (fontSize !== undefined) {
      if (fontSize < 12 || fontSize > 24) {
        res.status(400).json({ error: '字体大小范围：12-24' });
        return;
      }
      updates.push('font_size = ?');
      values.push(fontSize);
    }

    if (defaultEditorMode !== undefined) {
      if (!['edit', 'preview'].includes(defaultEditorMode)) {
        res.status(400).json({ error: '无效的编辑器模式' });
        return;
      }
      updates.push('default_editor_mode = ?');
      values.push(defaultEditorMode);
    }

    if (updates.length > 0) {
      values.push(req.user!.userId);
      db.prepare(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
    }

    res.json({ message: '设置已保存' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: '更新设置失败' });
  }
});

export default router;
