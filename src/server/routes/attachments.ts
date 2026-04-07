import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '../utils/config.js';

const router = Router();

// In-memory map: uuid-filename -> originalName (for download with original name)
const fileNameMap = new Map<string, string>();

// Configure multer
const storage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const config = loadConfig();
    const dir = path.join(config.data.dir, 'users', req.user!.username, 'attachments');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const newName = `${uuidv4()}${ext}`;
    // Store original name mapping
    fileNameMap.set(newName, file.originalname);
    cb(null, newName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: loadConfig().upload.maxFileSize,
  },
  // No fileFilter — allow all file types, only restrict by size
});

// POST /api/attachments (requires auth - applied in app.ts)
router.post('/', upload.array('files', 10), (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: '请选择文件' });
      return;
    }

    const username = req.user!.username;
    const results = files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      url: `/api/attachments/${username}/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
      isImage: file.mimetype.startsWith('image/'),
    }));

    res.status(201).json(results);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// Standalone public handler for GET /api/attachments/:username/:filename
// (registered in app.ts WITHOUT auth middleware)
export function publicAttachmentHandler(req: Request, res: Response) {
  try {
    const { username, filename } = req.params;
    const config = loadConfig();

    // Security: prevent path traversal
    const safeUser = path.basename(username as string);
    const safeName = path.basename(filename as string);
    const filePath = path.join(config.data.dir, 'users', safeUser, 'attachments', safeName);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: '文件不存在' });
      return;
    }

    // If download mode, set Content-Disposition to trigger download
    if (req.query.download) {
      const originalName = fileNameMap.get(safeName) || safeName;
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Get attachment error:', error);
    res.status(500).json({ error: '获取文件失败' });
  }
}

// Error handling for multer
router.use((err: any, _req: Request, res: Response, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: `文件大小超过限制（最大${Math.round(loadConfig().upload.maxFileSize / 1024 / 1024)}MB）` });
      return;
    }
    res.status(400).json({ error: '文件上传失败' });
    return;
  }
  if (err) {
    res.status(400).json({ error: err.message });
    return;
  }
  next();
});

export default router;
