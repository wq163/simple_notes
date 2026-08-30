import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../utils/database.js';

const router = Router();

// GET /api/notebooks
router.get('/', (req: Request, res: Response) => {
  try {
    const notebooks = getDb().prepare(`
      SELECT id, name, is_default, sort_order, created_at
      FROM notebooks
      WHERE user_id = ?
      ORDER BY is_default DESC, sort_order ASC, created_at ASC
    `).all(req.user!.userId) as any[];

    res.json(notebooks.map(notebook => ({
      id: notebook.id,
      name: notebook.name,
      isDefault: !!notebook.is_default,
      sortOrder: notebook.sort_order,
      createdAt: notebook.created_at,
    })));
  } catch (error) {
    console.error('List notebooks error:', error);
    res.status(500).json({ error: '获取笔记本列表失败' });
  }
});

// POST /api/notebooks
router.post('/', (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      res.status(400).json({ error: '请输入笔记本名称' });
      return;
    }

    const db = getDb();
    const notebookId = uuidv4();
    const categoryId = uuidv4();
    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) AS maxOrder FROM notebooks WHERE user_id = ?'
    ).get(req.user!.userId) as { maxOrder: number | null };
    const sortOrder = (maxOrder?.maxOrder ?? -1) + 1;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO notebooks (id, user_id, name, is_default, sort_order)
        VALUES (?, ?, ?, 0, ?)
      `).run(notebookId, req.user!.userId, name, sortOrder);

      db.prepare(`
        INSERT INTO categories (id, user_id, name, is_default, sort_order, notebook_id)
        VALUES (?, ?, '通用', 0, 0, ?)
      `).run(categoryId, req.user!.userId, notebookId);
    })();

    const { created_at: createdAt } = db.prepare(
      'SELECT created_at FROM notebooks WHERE id = ?'
    ).get(notebookId) as { created_at: string };

    res.status(201).json({
      id: notebookId,
      name,
      isDefault: false,
      sortOrder,
      createdAt,
      category: {
        id: categoryId,
        name: '通用',
        isDefault: false,
        sortOrder: 0,
        noteCount: 0,
        totalNoteCount: 0,
        notebookId,
        notebookName: name,
      },
    });
  } catch (error) {
    console.error('Create notebook error:', error);
    res.status(500).json({ error: '创建笔记本失败' });
  }
});

// PUT /api/notebooks/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, sortOrder } = req.body;
    const db = getDb();
    const notebook = db.prepare(
      'SELECT id FROM notebooks WHERE id = ? AND user_id = ?'
    ).get(id, req.user!.userId);

    if (!notebook) {
      res.status(404).json({ error: '笔记本不存在' });
      return;
    }

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        res.status(400).json({ error: '笔记本名称不能为空' });
        return;
      }
      db.prepare("UPDATE notebooks SET name = ?, updated_at = datetime('now') WHERE id = ?")
        .run(trimmedName, id);
    }

    if (sortOrder !== undefined) {
      db.prepare("UPDATE notebooks SET sort_order = ?, updated_at = datetime('now') WHERE id = ?")
        .run(sortOrder, id);
    }

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('Update notebook error:', error);
    res.status(500).json({ error: '更新笔记本失败' });
  }
});

// DELETE /api/notebooks/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const notebook = db.prepare(
      'SELECT id, is_default FROM notebooks WHERE id = ? AND user_id = ?'
    ).get(id, req.user!.userId) as { id: string; is_default: number } | undefined;

    if (!notebook) {
      res.status(404).json({ error: '笔记本不存在' });
      return;
    }
    if (notebook.is_default) {
      res.status(400).json({ error: '默认笔记本不能删除' });
      return;
    }

    const { count } = db.prepare(
      'SELECT COUNT(*) AS count FROM categories WHERE notebook_id = ?'
    ).get(id) as { count: number };
    if (count > 0) {
      res.status(400).json({ error: '笔记本下还有分类，不能删除' });
      return;
    }

    db.prepare('DELETE FROM notebooks WHERE id = ?').run(id);
    res.json({ message: '笔记本已删除' });
  } catch (error) {
    console.error('Delete notebook error:', error);
    res.status(500).json({ error: '删除笔记本失败' });
  }
});

export default router;
