import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { loadConfig } from '../utils/config.js';

const router = Router();

/**
 * Decode a filename that may have been mis-encoded as Latin-1 by multer/browser.
 * Some HTTP clients send UTF-8 bytes but the header is interpreted as Latin-1.
 */
function decodeOriginalName(raw: string): string {
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8');
    // Heuristic: if the decoded string contains valid CJK or other multibyte chars, use it
    if (decoded !== raw && /[^\x00-\x7F]/.test(decoded)) {
      return decoded;
    }
  } catch {
    // ignore
  }
  return raw;
}

/**
 * Sanitize filename: remove path separators and other unsafe characters,
 * but preserve Unicode (Chinese, etc.).
 */
function sanitizeFilename(name: string): string {
  // Remove path traversal characters and null bytes
  return name.replace(/[/\\:*?"<>|\x00]/g, '_').trim() || 'attachment';
}

/**
 * Resolve a unique filename in the given directory.
 * If `basename.ext` exists, try `basename-1.ext`, `basename-2.ext`, etc.
 */
function resolveUniqueFilename(dir: string, filename: string): string {
  if (!fs.existsSync(path.join(dir, filename))) {
    return filename;
  }
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let i = 1;
  while (true) {
    const candidate = `${base}-${i}${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) {
      return candidate;
    }
    i++;
  }
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const config = loadConfig();
    const dir = path.join(config.data.dir, 'users', req.user!.username, 'attachments');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req: any, file, cb) => {
    const dir = (() => {
      const config = loadConfig();
      return path.join(config.data.dir, 'users', req.user!.username, 'attachments');
    })();
    // Decode originalname (fix Chinese garbling from latin1 mis-interpretation)
    const decoded = decodeOriginalName(file.originalname);
    const safe = sanitizeFilename(decoded);
    const unique = resolveUniqueFilename(dir, safe);
    cb(null, unique);
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
    const results = files.map(file => {
      // Decode original name for display
      const displayName = decodeOriginalName(file.originalname);
      return {
        filename: file.filename,
        originalName: displayName,
        // URL-encode the filename so it's safe in URLs (handles Chinese filenames)
        // Use a relative URL (no leading slash) so it works under any baseUrl configuration
        url: `api/attachments/${username}/${encodeURIComponent(file.filename)}`,
        size: file.size,
        mimetype: file.mimetype,
        isImage: file.mimetype.startsWith('image/'),
      };
    });

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
    // Decode percent-encoded filename from URL
    const decodedFilename = decodeURIComponent(filename as string);
    const safeName = path.basename(decodedFilename);
    const filePath = path.join(config.data.dir, 'users', safeUser, 'attachments', safeName);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: '文件不存在' });
      return;
    }

    // If download mode, set Content-Disposition to trigger download with original filename
    if (req.query.download) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`
      );
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
