import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '../utils/database.js';
import { loadConfig } from '../utils/config.js';
import { ensureUserDirs } from '../utils/database.js';

const router = Router();

// GET /api/notes - List notes (with filtering)
router.get('/', (req: Request, res: Response) => {
  try {
    const { categoryId, tagId, search, trash } = req.query;
    const db = getDb();
    const userId = req.user!.userId;
    const config = loadConfig();

    let query: string;
    let params: any[];

    if (trash === '1') {
      // Trash view
      query = `
        SELECT n.id, n.category_id, n.file_path, n.is_pinned, n.created_at, n.updated_at, n.deleted_at,
               c.name as category_name
        FROM notes n
        LEFT JOIN categories c ON n.category_id = c.id
        WHERE n.user_id = ? AND n.is_deleted = 1
        ORDER BY n.deleted_at DESC
      `;
      params = [userId];
    } else if (tagId) {
      query = `
        SELECT n.id, n.category_id, n.file_path, n.is_pinned, n.created_at, n.updated_at,
               c.name as category_name
        FROM notes n
        JOIN note_tags nt ON n.id = nt.note_id
        LEFT JOIN categories c ON n.category_id = c.id
        WHERE n.user_id = ? AND nt.tag_id = ? AND n.is_deleted = 0
        ORDER BY n.is_pinned DESC, n.updated_at DESC
      `;
      params = [userId, tagId as string];
    } else if (categoryId) {
      query = `
        SELECT n.id, n.category_id, n.file_path, n.is_pinned, n.created_at, n.updated_at,
               c.name as category_name
        FROM notes n
        LEFT JOIN categories c ON n.category_id = c.id
        WHERE n.user_id = ? AND n.category_id = ? AND n.is_deleted = 0
        ORDER BY n.is_pinned DESC, n.updated_at DESC
      `;
      params = [userId, categoryId as string];
    } else {
      // Default: show notes in default category
      query = `
        SELECT n.id, n.category_id, n.file_path, n.is_pinned, n.created_at, n.updated_at,
               c.name as category_name
        FROM notes n
        LEFT JOIN categories c ON n.category_id = c.id
        WHERE n.user_id = ? AND c.is_default = 1 AND n.is_deleted = 0
        ORDER BY n.is_pinned DESC, n.updated_at DESC
      `;
      params = [userId];
    }

    const notes = db.prepare(query).all(...params) as any[];

    // Read file content for each note (first line as title, preview)
    const result = notes.map(note => {
      const filePath = path.join(config.data.dir, 'users', req.user!.username, 'notes', note.file_path);
      let content = '';
      let title = '无标题笔记';
      let preview = '';

      try {
        content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          title = lines[0].replace(/^#+\s*/, '').trim() || '无标题笔记';
          preview = lines.slice(1, 4).join(' ').substring(0, 200);
        }
      } catch { /* file might not exist yet */ }

      // Get tags for this note
      const tags = db.prepare(
        'SELECT t.id, t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?'
      ).all(note.id) as any[];

      return {
        id: note.id,
        title,
        preview,
        categoryId: note.category_id,
        categoryName: note.category_name,
        isPinned: !!note.is_pinned,
        tags: tags.map(t => ({ id: t.id, name: t.name })),
        createdAt: note.created_at,
        updatedAt: note.updated_at,
        deletedAt: note.deleted_at,
      };
    });

    // Full-text search filter
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.toLowerCase();
      const filtered = result.filter(note => {
        const filePath = path.join(config.data.dir, 'users', req.user!.username, 'notes', notes.find(n => n.id === note.id)?.file_path || '');
        try {
          const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
          return content.includes(searchLower) || note.title.toLowerCase().includes(searchLower);
        } catch {
          return note.title.toLowerCase().includes(searchLower);
        }
      });
      res.json(filtered);
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('List notes error:', error);
    res.status(500).json({ error: '获取笔记列表失败' });
  }
});

// POST /api/notes
router.post('/', (req: Request, res: Response) => {
  try {
    const { content, categoryId, tagIds } = req.body;
    const db = getDb();
    const userId = req.user!.userId;
    const config = loadConfig();

    // Decide category
    let catId = categoryId;
    if (!catId) {
      const defaultCat = db.prepare(
        'SELECT id FROM categories WHERE user_id = ? AND is_default = 1'
      ).get(userId) as any;
      catId = defaultCat.id;
    }

    // Verify category belongs to user
    const cat = db.prepare(
      'SELECT id FROM categories WHERE id = ? AND user_id = ?'
    ).get(catId, userId);
    if (!cat) {
      res.status(400).json({ error: '分类不存在' });
      return;
    }

    const noteId = uuidv4();
    const fileName = `${noteId}.md`;

    // Ensure user dirs exist
    ensureUserDirs(req.user!.username);

    // Write markdown file
    const filePath = path.join(config.data.dir, 'users', req.user!.username, 'notes', fileName);
    fs.writeFileSync(filePath, content || '', 'utf-8');

    // Insert note record
    db.prepare(`
      INSERT INTO notes (id, user_id, category_id, file_path)
      VALUES (?, ?, ?, ?)
    `).run(noteId, userId, catId, fileName);

    // Insert tag associations
    if (tagIds && Array.isArray(tagIds)) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)');
      for (const tagId of tagIds) {
        insertTag.run(noteId, tagId);
      }
    }

    res.status(201).json({ id: noteId });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: '创建笔记失败' });
  }
});

// GET /api/notes/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const config = loadConfig();

    const note = db.prepare(
      'SELECT id, category_id, file_path, is_pinned, is_deleted, created_at, updated_at FROM notes WHERE id = ? AND user_id = ?'
    ).get(id, req.user!.userId) as any;

    if (!note) {
      res.status(404).json({ error: '笔记不存在' });
      return;
    }

    // Read file content
    const filePath = path.join(config.data.dir, 'users', req.user!.username, 'notes', note.file_path);
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch { /* */ }

    // Get tags
    const tags = db.prepare(
      'SELECT t.id, t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?'
    ).all(id) as any[];

    res.json({
      id: note.id,
      content,
      categoryId: note.category_id,
      isPinned: !!note.is_pinned,
      isDeleted: !!note.is_deleted,
      tags: tags.map(t => ({ id: t.id, name: t.name })),
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    });
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ error: '获取笔记失败' });
  }
});

// PUT /api/notes/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, categoryId, tagIds } = req.body;
    const db = getDb();
    const config = loadConfig();

    const note = db.prepare(
      'SELECT id, file_path FROM notes WHERE id = ? AND user_id = ? AND is_deleted = 0'
    ).get(id, req.user!.userId) as any;

    if (!note) {
      res.status(404).json({ error: '笔记不存在' });
      return;
    }

    // Update content file
    if (content !== undefined) {
      const filePath = path.join(config.data.dir, 'users', req.user!.username, 'notes', note.file_path);
      fs.writeFileSync(filePath, content, 'utf-8');
    }

    // Update category
    if (categoryId !== undefined) {
      const cat = db.prepare(
        'SELECT id FROM categories WHERE id = ? AND user_id = ?'
      ).get(categoryId, req.user!.userId);
      if (!cat) {
        res.status(400).json({ error: '分类不存在' });
        return;
      }
      db.prepare('UPDATE notes SET category_id = ? WHERE id = ?').run(categoryId, id);
    }

    // Update tags
    if (tagIds !== undefined && Array.isArray(tagIds)) {
      db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(id);
      const insertTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)');
      for (const tagId of tagIds) {
        insertTag.run(id, tagId);
      }
    }

    // Update timestamp
    db.prepare("UPDATE notes SET updated_at = datetime('now') WHERE id = ?").run(id);

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: '更新笔记失败' });
  }
});

// DELETE /api/notes/empty-trash - permanently delete all soft-deleted notes
router.delete('/empty-trash', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const config = loadConfig();

    const deletedNotes = db.prepare(
      'SELECT id, file_path FROM notes WHERE user_id = ? AND is_deleted = 1'
    ).all(req.user!.userId) as any[];

    if (deletedNotes.length === 0) {
      res.json({ message: '回收站已空' });
      return;
    }

    deletedNotes.forEach(note => {
      const filePath = path.join(config.data.dir, 'users', req.user!.username, 'notes', note.file_path);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {
          console.error('Failed to delete file:', e);
        }
      }
    });

    db.prepare('DELETE FROM notes WHERE user_id = ? AND is_deleted = 1').run(req.user!.userId);

    res.json({ message: '回收站已清空' });
  } catch (error) {
    console.error('Empty trash error:', error);
    res.status(500).json({ error: '清空回收站失败' });
  }
});

// DELETE /api/notes/:id - Soft delete (move to trash)
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    const db = getDb();
    const config = loadConfig();

    const note = db.prepare(
      'SELECT id, file_path, is_deleted FROM notes WHERE id = ? AND user_id = ?'
    ).get(id, req.user!.userId) as any;

    if (!note) {
      res.status(404).json({ error: '笔记不存在' });
      return;
    }

    if (permanent === '1' || note.is_deleted) {
      // Hard delete from trash
      const filePath = path.join(config.data.dir, 'users', req.user!.username, 'notes', note.file_path);
      try { fs.unlinkSync(filePath); } catch { /* */ }
      db.prepare('DELETE FROM notes WHERE id = ?').run(id);
      res.json({ message: '笔记已永久删除' });
    } else {
      // Soft delete (move to trash)
      db.prepare(
        "UPDATE notes SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?"
      ).run(id);
      res.json({ message: '笔记已移入回收站' });
    }
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: '删除笔记失败' });
  }
});

// PUT /api/notes/:id/pin
router.put('/:id/pin', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const note = db.prepare(
      'SELECT id, is_pinned FROM notes WHERE id = ? AND user_id = ? AND is_deleted = 0'
    ).get(id, req.user!.userId) as any;

    if (!note) {
      res.status(404).json({ error: '笔记不存在' });
      return;
    }

    const newPinned = note.is_pinned ? 0 : 1;
    db.prepare('UPDATE notes SET is_pinned = ? WHERE id = ?').run(newPinned, id);

    res.json({ isPinned: !!newPinned });
  } catch (error) {
    console.error('Pin note error:', error);
    res.status(500).json({ error: '操作失败' });
  }
});

// PUT /api/notes/:id/restore - Restore from trash
router.put('/:id/restore', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const note = db.prepare(
      'SELECT id FROM notes WHERE id = ? AND user_id = ? AND is_deleted = 1'
    ).get(id, req.user!.userId) as any;

    if (!note) {
      res.status(404).json({ error: '笔记不存在或不在回收站中' });
      return;
    }

    db.prepare(
      'UPDATE notes SET is_deleted = 0, deleted_at = NULL WHERE id = ?'
    ).run(id);

    res.json({ message: '笔记已恢复' });
  } catch (error) {
    console.error('Restore note error:', error);
    res.status(500).json({ error: '恢复失败' });
  }
});

export default router;
