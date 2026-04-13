import express from 'express';
import cors from 'cors';
import fs from 'fs';
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

const mainRouter = express.Router();

// API routes
mainRouter.use('/api/auth', authRoutes);
mainRouter.use('/api/users', authMiddleware, userRoutes);
mainRouter.use('/api/admin', authMiddleware, adminRoutes);
mainRouter.use('/api/categories', authMiddleware, categoryRoutes);
mainRouter.use('/api/tags', authMiddleware, tagRoutes);
mainRouter.use('/api/notes', authMiddleware, noteRoutes);
// Public: serve attachments (GET) without auth - images need this for <img src="...">
import { publicAttachmentHandler } from './routes/attachments.js';
mainRouter.get('/api/attachments/:username/:filename', publicAttachmentHandler);
// Authenticated: upload attachments (POST)
mainRouter.use('/api/attachments', authMiddleware, attachmentRoutes);
mainRouter.use('/api/settings', authMiddleware, settingsRoutes);
mainRouter.use('/api/export', authMiddleware, exportRoutes);
mainRouter.use('/api/admin/backup', authMiddleware, backupRoutes);

// Serve static frontend in production
const clientDistPath = path.resolve(__dirname, '../../dist/client');
mainRouter.use(express.static(clientDistPath, { index: false }));

// SPA fallback – all non-API routes serve index.html
mainRouter.use((req, res, next) => {
  if (!req.path.startsWith('/api') && req.method === 'GET') {
    const htmlPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, 'utf-8');
      const baseUrl = config.server.baseUrl || '/';
      const injectString = `<head>\n  <script>window.__APP_CONFIG__ = { baseUrl: "${baseUrl}" };</script>\n  <base href="${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}">`;
      html = html.replace('<head>', injectString);
      res.send(html);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } else {
    next();
  }
});

app.use(config.server.baseUrl || '/', mainRouter);

// Start server
const server = app.listen(config.server.port, config.server.host, () => {
  console.log(`🚀 Simple Notes server running at http://${config.server.host}:${config.server.port}${config.server.baseUrl}`);
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
