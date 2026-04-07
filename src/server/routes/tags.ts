import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDb } from '../utils/database.js';
import { loadConfig } from '../utils/config.js';

const router = Router();

// GET /api/tags
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const tags = db.prepare(
      'SELECT id, name, created_at FROM tags WHERE user_id = ? ORDER BY name ASC'
    ).all(req.user!.userId);

    // Count notes per tag
    const countStmt = db.prepare(
      'SELECT COUNT(*) as count FROM note_tags nt JOIN notes n ON nt.note_id = n.id WHERE nt.tag_id = ? AND n.is_deleted = 0'
    );

    res.json((tags as any[]).map(t => {
      const { count } = countStmt.get(t.id) as any;
      return {
        id: t.id,
        name: t.name,
        noteCount: count,
        createdAt: t.created_at,
      };
    }));
  } catch (error) {
    console.error('List tags error:', error);
    res.status(500).json({ error: '获取标签列表失败' });
  }
});

// POST /api/tags
router.post('/', (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: '请输入标签名称' });
      return;
    }

    const db = getDb();

    const existing = db.prepare(
      'SELECT id FROM tags WHERE user_id = ? AND name = ?'
    ).get(req.user!.userId, name.trim());

    if (existing) {
      res.status(400).json({ error: '标签名称已存在' });
      return;
    }

    const id = uuidv4();
    db.prepare('INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)')
      .run(id, req.user!.userId, name.trim());

    res.status(201).json({
      id,
      name: name.trim(),
      noteCount: 0,
    });
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: '创建标签失败' });
  }
});

// PUT /api/tags/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: '标签名称不能为空' });
      return;
    }

    const db = getDb();

    const tag = db.prepare(
      'SELECT id, name FROM tags WHERE id = ? AND user_id = ?'
    ).get(id, req.user!.userId) as any;

    if (!tag) {
      res.status(404).json({ error: '标签不存在' });
      return;
    }


    const oldName = tag.name;
    const newName = name.trim();

    db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(newName, id);

    // Update all note files containing this tag
    const config = loadConfig();
    const notesWithTag = db.prepare(`
      SELECT n.id, n.file_path 
      FROM notes n 
      JOIN note_tags nt ON n.id = nt.note_id 
      WHERE nt.tag_id = ? AND n.is_deleted = 0
    `).all(id) as any[];

    // Regular expression: non-word boundary at left, #, the old name, and non-word or end of string at right
    // We use a negative lookahead to ensure the tag isn't just a prefix of a longer tag
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const oldTagRegex = new RegExp(`(^|\\s)(\\\\?)#${escapeRegExp(oldName)}(?![a-zA-Z0-9_\\u4e00-\\u9fa5])`, 'gi');

    for (const note of notesWithTag) {
      const filePath = path.join(config.data.dir, 'users', req.user!.username, 'notes', note.file_path);
      try {
        let content = fs.readFileSync(filePath, 'utf-8');
        const newContent = content.replace(oldTagRegex, `$1$2#${newName}`);
        fs.writeFileSync(filePath, newContent, 'utf-8');
      } catch (err) {
        console.error('Failed to update note content for tag rename:', err);
      }
    }

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('Update tag error:', error);
    res.status(500).json({ error: '更新标签失败' });
  }
});

// DELETE /api/tags/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const tag = db.prepare(
      'SELECT id FROM tags WHERE id = ? AND user_id = ?'
    ).get(id, req.user!.userId);

    if (!tag) {
      res.status(404).json({ error: '标签不存在' });
      return;
    }

    // Check if tag is used
    const countRow = db.prepare(
      'SELECT COUNT(*) as count FROM note_tags WHERE tag_id = ?'
    ).get(id) as any;

    if (countRow.count > 0) {
      res.status(400).json({ error: '该标签下有笔记，无法删除' });
      return;
    }

    // Delete tag
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);

    res.json({ message: '标签已删除' });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({ error: '删除标签失败' });
  }
});

export default router;
