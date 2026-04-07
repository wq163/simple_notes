import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  data: {
    dir: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    rememberMeExpiresIn: string;
  };
  upload: {
    maxFileSize: number; // bytes
  };
  admin: {
    defaultUsername: string;
    defaultPassword: string;
  };
}

let config: AppConfig | null = null;

// Hardcoded fallback defaults (used when config/default.json is missing)
const BUILTIN_DEFAULTS: AppConfig = {
  server: { port: 3000, host: '0.0.0.0' },
  data: { dir: './data' },
  jwt: { secret: 'simple-notes-jwt-secret-change-me', expiresIn: '24h', rememberMeExpiresIn: '30d' },
  upload: { maxFileSize: 20971520 },
  admin: { defaultUsername: 'jenwang', defaultPassword: 'jenwang' },
};

export function loadConfig(): AppConfig {
  if (config) return config;

  // Load default config – auto-generate if missing
  const defaultConfigPath = path.resolve(__dirname, '../../../config/default.json');
  let defaultConfig: any;

  if (fs.existsSync(defaultConfigPath)) {
    defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf-8'));
  } else {
    // First-time startup: create the config directory and write a default config file
    console.log('⚙️  配置文件不存在，正在自动生成默认配置...');
    const configDir = path.dirname(defaultConfigPath);
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(defaultConfigPath, JSON.stringify(BUILTIN_DEFAULTS, null, 2), 'utf-8');
    console.log(`✅ 已生成默认配置文件: ${defaultConfigPath}`);
    defaultConfig = { ...BUILTIN_DEFAULTS };
  }

  // Resolve data dir to absolute path
  defaultConfig.data.dir = path.resolve(defaultConfig.data.dir);

  // Load user override config if exists (from data dir)
  const userConfigPath = path.resolve(defaultConfig.data.dir, 'config.json');
  if (fs.existsSync(userConfigPath)) {
    const userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf-8'));
    config = deepMerge(defaultConfig, userConfig) as AppConfig;
  } else {
    config = defaultConfig as AppConfig;
  }

  // Environment variable overrides
  if (process.env.PORT) config.server.port = parseInt(process.env.PORT, 10);
  if (process.env.DATA_DIR) config.data.dir = path.resolve(process.env.DATA_DIR);
  if (process.env.JWT_SECRET) config.jwt.secret = process.env.JWT_SECRET;

  return config;
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
