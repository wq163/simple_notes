import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../utils/database.js';

const router = Router();

// GET /api/categories
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const categories = db.prepare(
      'SELECT id, name, is_default, sort_order, created_at FROM categories WHERE user_id = ? ORDER BY is_default DESC, sort_order ASC, created_at ASC'
    ).all(req.user!.userId);

    // Count notes per category
    const countStmt = db.prepare(
      'SELECT COUNT(*) as count FROM notes WHERE category_id = ? AND is_deleted = 0'
    );

    res.json(categories.map((c: any) => {
      const { count } = countStmt.get(c.id) as any;
      return {
        id: c.id,
        name: c.name,
        isDefault: !!c.is_default,
        sortOrder: c.sort_order,
        noteCount: count,
        createdAt: c.created_at,
      };
    }));
  } catch (error) {
    console.error('List categories error:', error);
    res.status(500).json({ error: '获取分类列表失败' });
  }
});

// POST /api/categories
router.post('/', (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: '请输入分类名称' });
      return;
    }

    const db = getDb();

    // Check duplicate name
    const existing = db.prepare(
      'SELECT id FROM categories WHERE user_id = ? AND name = ?'
    ).get(req.user!.userId, name.trim());

    if (existing) {
      res.status(400).json({ error: '分类名称已存在' });
      return;
    }

    const id = uuidv4();
    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as maxOrder FROM categories WHERE user_id = ?'
    ).get(req.user!.userId) as any;

    db.prepare(`
      INSERT INTO categories (id, user_id, name, is_default, sort_order)
      VALUES (?, ?, ?, 0, ?)
    `).run(id, req.user!.userId, name.trim(), (maxOrder?.maxOrder || 0) + 1);

    res.status(201).json({
      id,
      name: name.trim(),
      isDefault: false,
      sortOrder: (maxOrder?.maxOrder || 0) + 1,
      noteCount: 0,
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: '创建分类失败' });
  }
});

// PUT /api/categories/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, sortOrder } = req.body;

    const db = getDb();
    const category = db.prepare(
      'SELECT id, is_default FROM categories WHERE id = ? AND user_id = ?'
    ).get(id, req.user!.userId) as any;

    if (!category) {
      res.status(404).json({ error: '分类不存在' });
      return;
    }

    if (category.is_default) {
      res.status(400).json({ error: '默认分类不能修改' });
      return;
    }

    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ error: '分类名称不能为空' });
        return;
      }

      const existing = db.prepare(
        'SELECT id FROM categories WHERE user_id = ? AND name = ? AND id != ?'
      ).get(req.user!.userId, name.trim(), id);

      if (existing) {
        res.status(400).json({ error: '分类名称已存在' });
        return;
      }

      db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name.trim(), id);
    }

    if (sortOrder !== undefined) {
      db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').run(sortOrder, id);
    }

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: '更新分类失败' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const category = db.prepare(
      'SELECT id, is_default FROM categories WHERE id = ? AND user_id = ?'
    ).get(id, req.user!.userId) as any;

    if (!category) {
      res.status(404).json({ error: '分类不存在' });
      return;
    }

    if (category.is_default) {
      res.status(400).json({ error: '默认分类不能删除' });
      return;
    }

    // Check if category has notes
    const noteCount = db.prepare(
      'SELECT COUNT(*) as count FROM notes WHERE category_id = ? AND is_deleted = 0'
    ).get(id) as any;

    if (noteCount.count > 0) {
      res.status(400).json({ error: '该分类下还有笔记，不能删除' });
      return;
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);

    res.json({ message: '分类已删除' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: '删除分类失败' });
  }
});

export default router;
