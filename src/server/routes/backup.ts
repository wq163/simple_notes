import { Router, Request, Response } from 'express';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { adminMiddleware } from '../middleware/auth.js';
import { getDb } from '../utils/database.js';
import { loadConfig } from '../utils/config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import archiver from 'archiver';

const router = Router();

// All routes require admin
router.use(adminMiddleware);

// ---- Helpers ----

interface BackupConfigRow {
  id: number;
  s3_endpoint: string;
  s3_region: string;
  s3_bucket: string;
  s3_access_key: string;
  s3_secret_key: string;
  s3_path_prefix: string;
  retention_count: number;
  updated_at: string;
}

function getBackupConfig(): BackupConfigRow | null {
  const db = getDb();
  return db.prepare('SELECT * FROM backup_config WHERE id = 1').get() as BackupConfigRow | null;
}

function createS3Client(cfg: BackupConfigRow): S3Client {
  return new S3Client({
    endpoint: cfg.s3_endpoint,
    region: cfg.s3_region || 'us-east-1',
    credentials: {
      accessKeyId: cfg.s3_access_key,
      secretAccessKey: cfg.s3_secret_key,
    },
    forcePathStyle: true, // 兼容 MinIO 等自建对象存储
  });
}

// ---- GET /config — 获取 S3 配置（脱敏） ----
router.get('/config', (_req: Request, res: Response) => {
  try {
    const cfg = getBackupConfig();
    if (!cfg) {
      res.json({
        s3Endpoint: '',
        s3Region: 'us-east-1',
        s3Bucket: '',
        s3AccessKey: '',
        s3SecretKey: '',
        s3PathPrefix: 'notes-backup',
        retentionCount: 5,
      });
      return;
    }
    res.json({
      s3Endpoint: cfg.s3_endpoint,
      s3Region: cfg.s3_region,
      s3Bucket: cfg.s3_bucket,
      s3AccessKey: cfg.s3_access_key,
      s3SecretKey: cfg.s3_secret_key ? '****' : '',
      s3PathPrefix: cfg.s3_path_prefix,
      retentionCount: cfg.retention_count,
    });
  } catch (error) {
    console.error('Get backup config error:', error);
    res.status(500).json({ error: '获取备份配置失败' });
  }
});

// ---- PUT /config — 保存 S3 配置 ----
router.put('/config', (req: Request, res: Response) => {
  try {
    const { s3Endpoint, s3Region, s3Bucket, s3AccessKey, s3SecretKey, s3PathPrefix, retentionCount } = req.body;
    const db = getDb();

    const existing = getBackupConfig();

    // If secret key is '****', keep the old value
    const finalSecretKey = (s3SecretKey === '****' && existing) ? existing.s3_secret_key : (s3SecretKey || '');

    if (existing) {
      db.prepare(`
        UPDATE backup_config SET
          s3_endpoint = ?, s3_region = ?, s3_bucket = ?,
          s3_access_key = ?, s3_secret_key = ?, s3_path_prefix = ?,
          retention_count = ?, updated_at = datetime('now')
        WHERE id = 1
      `).run(
        s3Endpoint || '', s3Region || 'us-east-1', s3Bucket || '',
        s3AccessKey || '', finalSecretKey, s3PathPrefix || 'notes-backup',
        retentionCount || 5
      );
    } else {
      db.prepare(`
        INSERT INTO backup_config (id, s3_endpoint, s3_region, s3_bucket, s3_access_key, s3_secret_key, s3_path_prefix, retention_count)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        s3Endpoint || '', s3Region || 'us-east-1', s3Bucket || '',
        s3AccessKey || '', finalSecretKey, s3PathPrefix || 'notes-backup',
        retentionCount || 5
      );
    }

    res.json({ message: '备份配置已保存' });
  } catch (error) {
    console.error('Save backup config error:', error);
    res.status(500).json({ error: '保存备份配置失败' });
  }
});

// ---- POST /test — 测试 S3 连接 ----
router.post('/test', async (_req: Request, res: Response) => {
  try {
    const cfg = getBackupConfig();
    if (!cfg || !cfg.s3_endpoint || !cfg.s3_bucket || !cfg.s3_access_key || !cfg.s3_secret_key) {
      res.status(400).json({ error: '请先完善 S3 配置信息' });
      return;
    }

    const s3 = createS3Client(cfg);
    await s3.send(new HeadBucketCommand({ Bucket: cfg.s3_bucket }));

    res.json({ message: '连接成功！Bucket 可访问。' });
  } catch (error: any) {
    console.error('S3 connection test error:', error);
    const msg = error?.name === 'NotFound' ? 'Bucket 不存在'
      : error?.name === 'AccessDenied' ? '访问被拒绝，请检查密钥权限'
      : `连接失败: ${error?.message || '未知错误'}`;
    res.status(400).json({ error: msg });
  }
});

// ---- POST /run — 执行备份 ----
router.post('/run', async (req: Request, res: Response) => {
  const config = loadConfig();
  const dataDir = config.data.dir;
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const fileName = `note-bak-${timestamp}.tar.gz`;
  const tmpFilePath = path.join(os.tmpdir(), fileName);

  try {
    const cfg = getBackupConfig();
    if (!cfg || !cfg.s3_endpoint || !cfg.s3_bucket || !cfg.s3_access_key || !cfg.s3_secret_key) {
      res.status(400).json({ error: '请先配置 S3 信息' });
      return;
    }

    // Step 1: Pack data directory into tar.gz
    console.log(`📦 开始打包数据目录: ${dataDir} -> ${tmpFilePath}`);
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(tmpFilePath);
      const archive = archiver('tar', { gzip: true, gzipOptions: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(dataDir, 'data');
      archive.finalize();
    });

    const fileSize = fs.statSync(tmpFilePath).size;
    console.log(`✅ 打包完成，大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Step 2: Upload to S3
    const s3 = createS3Client(cfg);
    const objectKey = cfg.s3_path_prefix ? `${cfg.s3_path_prefix}/${fileName}` : fileName;

    console.log(`☁️  上传到 S3: ${cfg.s3_bucket}/${objectKey}`);
    const fileBuffer = fs.readFileSync(tmpFilePath);
    await s3.send(new PutObjectCommand({
      Bucket: cfg.s3_bucket,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: 'application/gzip',
    }));
    console.log('✅ 上传完成');

    // Step 3: Delete local temp file
    fs.unlinkSync(tmpFilePath);
    console.log('🗑️  已删除本地临时文件');

    // Step 4: Enforce retention — delete old backups
    const prefix = cfg.s3_path_prefix ? `${cfg.s3_path_prefix}/note-bak-` : 'note-bak-';
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: cfg.s3_bucket,
      Prefix: prefix,
    }));

    const allBackups = (listResult.Contents || [])
      .filter(obj => obj.Key?.endsWith('.tar.gz'))
      .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));

    let deletedCount = 0;
    if (allBackups.length > cfg.retention_count) {
      const toDelete = allBackups.slice(cfg.retention_count);
      await s3.send(new DeleteObjectsCommand({
        Bucket: cfg.s3_bucket,
        Delete: {
          Objects: toDelete.map(obj => ({ Key: obj.Key! })),
          Quiet: true,
        },
      }));
      deletedCount = toDelete.length;
      console.log(`🗑️  已清理 ${deletedCount} 个旧备份`);
    }

    res.json({
      message: '备份成功',
      fileName,
      fileSize,
      totalBackups: Math.min(allBackups.length, cfg.retention_count),
      deletedOldBackups: deletedCount,
    });
  } catch (error: any) {
    console.error('Backup error:', error);
    // Ensure temp file cleanup on failure
    try { if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath); } catch {}
    res.status(500).json({ error: `备份失败: ${error?.message || '未知错误'}` });
  }
});

// ---- GET /list — 列出远端备份 ----
router.get('/list', async (_req: Request, res: Response) => {
  try {
    const cfg = getBackupConfig();
    if (!cfg || !cfg.s3_endpoint || !cfg.s3_bucket) {
      res.json([]);
      return;
    }

    const s3 = createS3Client(cfg);
    const prefix = cfg.s3_path_prefix ? `${cfg.s3_path_prefix}/note-bak-` : 'note-bak-';
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: cfg.s3_bucket,
      Prefix: prefix,
    }));

    const backups = (listResult.Contents || [])
      .filter(obj => obj.Key?.endsWith('.tar.gz'))
      .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
      .map(obj => ({
        key: obj.Key,
        fileName: obj.Key?.split('/').pop(),
        size: obj.Size,
        lastModified: obj.LastModified?.toISOString(),
      }));

    res.json(backups);
  } catch (error: any) {
    console.error('List backups error:', error);
    res.status(500).json({ error: `获取备份列表失败: ${error?.message || '未知错误'}` });
  }
});

export default router;
