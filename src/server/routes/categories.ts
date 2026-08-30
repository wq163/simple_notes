import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../utils/database.js';

const router = Router();

// GET /api/categories
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const categories = db.prepare(
      `SELECT c.id, c.name, c.is_default, c.sort_order, c.created_at,
              c.notebook_id, nb.name AS notebook_name, nb.sort_order AS notebook_sort_order
       FROM categories c
       LEFT JOIN notebooks nb ON c.notebook_id = nb.id
       WHERE c.user_id = ?
       ORDER BY c.is_default DESC, nb.is_default DESC,
                nb.sort_order ASC, nb.created_at ASC,
                c.sort_order ASC, c.created_at ASC`
    ).all(req.user!.userId);

    // Count notes per category
    const countStmt = db.prepare(
      'SELECT COUNT(*) as count FROM notes WHERE category_id = ? AND is_deleted = 0'
    );
    const totalCountStmt = db.prepare(
      'SELECT COUNT(*) as count FROM notes WHERE category_id = ?'
    );

    res.json(categories.map((c: any) => {
      const { count } = countStmt.get(c.id) as any;
      const { count: totalCount } = totalCountStmt.get(c.id) as any;
      return {
        id: c.id,
        name: c.name,
        isDefault: !!c.is_default,
        sortOrder: c.sort_order,
        noteCount: count,
        totalNoteCount: totalCount,
        notebookId: c.notebook_id,
        notebookName: c.notebook_name,
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
    const { name, notebookId } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: '请输入分类名称' });
      return;
    }
    if (!notebookId) {
      res.status(400).json({ error: '请选择笔记本' });
      return;
    }

    const db = getDb();
    const notebook = db.prepare(
      'SELECT id, name FROM notebooks WHERE id = ? AND user_id = ?'
    ).get(notebookId, req.user!.userId) as { id: string; name: string } | undefined;
    if (!notebook) {
      res.status(400).json({ error: '请选择有效的笔记本' });
      return;
    }

    const id = uuidv4();
    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as maxOrder FROM categories WHERE notebook_id = ?'
    ).get(notebookId) as any;
    const sortOrder = (maxOrder?.maxOrder ?? -1) + 1;

    db.prepare(`
      INSERT INTO categories (id, user_id, name, is_default, sort_order, notebook_id)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(id, req.user!.userId, name.trim(), sortOrder, notebookId);

    res.status(201).json({
      id,
      name: name.trim(),
      isDefault: false,
      sortOrder,
      noteCount: 0,
      totalNoteCount: 0,
      notebookId,
      notebookName: notebook.name,
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
    const { name, sortOrder, notebookId } = req.body;

    const db = getDb();
    const category = db.prepare(
      'SELECT id, is_default, notebook_id FROM categories WHERE id = ? AND user_id = ?'
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

      db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name.trim(), id);
    }

    if (notebookId !== undefined && notebookId !== category.notebook_id) {
      const notebook = db.prepare(
        'SELECT id FROM notebooks WHERE id = ? AND user_id = ?'
      ).get(notebookId, req.user!.userId);
      if (!notebook) {
        res.status(400).json({ error: '请选择有效的笔记本' });
        return;
      }

      const maxOrder = db.prepare(
        'SELECT MAX(sort_order) AS maxOrder FROM categories WHERE notebook_id = ?'
      ).get(notebookId) as { maxOrder: number | null };
      db.prepare('UPDATE categories SET notebook_id = ?, sort_order = ? WHERE id = ?')
        .run(notebookId, (maxOrder?.maxOrder ?? -1) + 1, id);
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

    // Check all notes, including trash, to preserve the category foreign key.
    const noteCount = db.prepare(
      'SELECT COUNT(*) as count FROM notes WHERE category_id = ?'
    ).get(id) as any;

    if (noteCount.count > 0) {
      res.status(400).json({ error: '该分类下还有笔记（包含回收站），不能删除' });
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
