import { Router, Request, Response } from 'express';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { loadConfig } from '../utils/config.js';

const router = Router();

// GET /api/export
router.get('/', (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const userDir = path.join(config.data.dir, 'users', req.user!.username);

    if (!fs.existsSync(userDir)) {
      res.status(404).json({ error: '没有可导出的数据' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="notes-export-${new Date().toISOString().slice(0, 10)}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).end();
    });

    archive.pipe(res);

    // Add notes directory
    const notesDir = path.join(userDir, 'notes');
    if (fs.existsSync(notesDir)) {
      archive.directory(notesDir, 'notes');
    }

    // Add attachments directory
    const attachmentsDir = path.join(userDir, 'attachments');
    if (fs.existsSync(attachmentsDir)) {
      archive.directory(attachmentsDir, 'attachments');
    }

    archive.finalize();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

export default router;
