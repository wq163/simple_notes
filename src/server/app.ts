import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './utils/config.js';
import { initializeDatabase, closeDb } from './utils/database.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import categoryRoutes from './routes/categories.js';
import tagRoutes from './routes/tags.js';
import noteRoutes from './routes/notes.js';
import attachmentRoutes from './routes/attachments.js';
import settingsRoutes from './routes/settings.js';
import exportRoutes from './routes/export.js';
import backupRoutes from './routes/backup.js';
import { authMiddleware } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = loadConfig();

// Initialize database
initializeDatabase();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/categories', authMiddleware, categoryRoutes);
app.use('/api/tags', authMiddleware, tagRoutes);
app.use('/api/notes', authMiddleware, noteRoutes);
// Public: serve attachments (GET) without auth - images need this for <img src="...">
import { publicAttachmentHandler } from './routes/attachments.js';
app.get('/api/attachments/:username/:filename', publicAttachmentHandler);
// Authenticated: upload attachments (POST)
app.use('/api/attachments', authMiddleware, attachmentRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/export', authMiddleware, exportRoutes);
app.use('/api/admin/backup', authMiddleware, backupRoutes);

// Serve static frontend in production
const clientDistPath = path.resolve(__dirname, '../../dist/client');
app.use(express.static(clientDistPath));

// SPA fallback – all non-API routes serve index.html
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && req.method === 'GET') {
    res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) {
        // In dev mode, client is served by Vite dev server
        res.status(404).json({ error: 'Not found' });
      }
    });
  } else {
    next();
  }
});

// Start server
const server = app.listen(config.server.port, config.server.host, () => {
  console.log(`🚀 Simple Notes server running at http://${config.server.host}:${config.server.port}`);
  console.log(`📁 Data directory: ${config.data.dir}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  closeDb();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  server.close();
  process.exit(0);
});

export default app;
