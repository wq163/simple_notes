# Simple Notes 📝

简洁优雅的个人记事应用，支持 Markdown 富文本编辑、分类标签管理、多用户隔离、深色模式等功能。

## 主要技术栈

| 层面 | 技术 |
|---|---|
| **前端框架** | Vue 3 + TypeScript |
| **构建工具** | Vite |
| **状态管理** | Pinia |
| **路由** | Vue Router |
| **富文本编辑器** | Milkdown（基于 ProseMirror） |
| **后端框架** | Express（Node.js） |
| **数据库** | SQLite3（better-sqlite3，WAL 模式） |
| **认证** | JWT（jsonwebtoken + bcryptjs） |
| **HTTP 客户端** | Axios |
| **文件上传** | Multer |
| **数据导出** | Archiver（ZIP） |

## 功能特性

- ✅ **Markdown 富文本编辑** — Milkdown WYSIWYG 编辑器，支持加粗、标题、列表、Checkbox、图片上传等
- ✅ **分类管理** — 单分类体系，系统预设默认分类（不可删除），有笔记时不可删除分类
- ✅ **标签管理** — 多标签，可自由组合
- ✅ **全文搜索** — 搜索笔记标题和内容
- ✅ **回收站** — 删除笔记进入回收站，可恢复或永久删除
- ✅ **笔记置顶** — 重要笔记可置顶显示
- ✅ **深色模式** — 支持浅色/深色主题切换
- ✅ **响应式布局** — 同一套代码适配手机端和 PC 端
- ✅ **多用户隔离** — 每个用户数据完全隔离
- ✅ **管理员功能** — 管理员创建/管理用户账号
- ✅ **数据导出** — 将所有笔记和附件导出为 ZIP
- ✅ **图片上传** — 支持上传多图，大小限制可配置
- ✅ **个人设置** — 主题、字体大小、默认编辑器模式

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 8

### 安装

```bash
# 克隆项目
git clone <repo-url>
cd simple_notes

# 安装依赖
npm install
```

### 开发模式

```bash
# 启动后端（端口 3000）
npm run dev:server

# 启动前端（端口 5173，API 请求代理到 3000）
npm run dev:client

# 或同时启动前后端
npm run dev
```

### 生产模式

```bash
# 构建前端和后端
npm run build

# 启动服务（同一进程服务 API 与静态页面）
npm start
```

启动后访问 `http://localhost:3000` 即可使用。

### Docker 部署（推荐）

本项目已提供 Docker 配置，支持多阶段极致构建（分离源码与生产环境）。只需简单两步即可在任何服务器上部署就绪，并且您的数据将被自动挂载出来，避免随容器销毁而丢失。

```bash
# 1. 编译并打包出无体积冗余的精简生产镜像
docker build -t notes .

# 2. 运行容器（一定要将本地数据目录挂载到 /app/data）
docker run -d \
  --name notes \
  -p 3000:3000 \
  -v /你的任意绝对路径/notes_data:/app/data \
  -v /你的任意绝对路径/notes_config:/app/config \ 
  --restart unless-stopped \
  notes
```

启动后访问 `http://你的服务器IP:3000` 即可使用。

### 默认管理员账号

| 用户名 | 密码 |
|---|---|
| `jenwang` | `jenwang` |

> ⚠️ 首次登录后请立即修改密码（账号管理 → 修改密码）

## 配置

配置文件位于 `config/default.json`，支持以下配置项：

```json
{
  "server": {
    "port": 3000,          // 服务端口
    "host": "0.0.0.0"      // 监听地址
  },
  "data": {
    "dir": "./data"        // 数据存储目录
  },
  "jwt": {
    "secret": "...",       // JWT 密钥（生产环境请修改）
    "expiresIn": "24h",    // Token 有效期
    "rememberMeExpiresIn": "30d"  // 记住我有效期
  },
  "upload": {
    "maxFileSize": 20971520  // 图片大小限制（字节），默认 20MB
  }
}
```

也可通过环境变量覆盖：

| 环境变量 | 说明 |
|---|---|
| `PORT` | 服务端口 |
| `DATA_DIR` | 数据存储目录 |
| `JWT_SECRET` | JWT 密钥 |

## 数据存储

所有数据存储在配置的数据目录下（默认 `./data`）：

```
data/
├── app.db              # SQLite 数据库
└── users/
    └── <username>/
        ├── notes/       # Markdown 笔记文件
        └── attachments/ # 图片附件
```

- **数据库**：存储用户账号、分类、标签、笔记元数据、用户设置
- **笔记内容**：以 `.md` 文件存储，文件名为 UUID
- **附件**：以原始扩展名存储，文件名为 UUID

## 项目结构

```
simple_notes/
├── src/
│   ├── client/              # Vue 3 前端
│   │   ├── api/             # Axios API 封装
│   │   ├── components/      # 通用组件（Milkdown 编辑器等）
│   │   ├── router/          # Vue Router 路由
│   │   ├── stores/          # Pinia 状态管理
│   │   ├── styles/          # CSS 设计系统
│   │   └── views/           # 页面视图
│   └── server/              # Express 后端
│       ├── middleware/       # JWT 认证中间件
│       ├── routes/          # API 路由
│       └── utils/           # 配置加载、数据库初始化
├── config/                  # 配置文件
├── package.json
├── vite.config.ts
└── README.md
```

## API 接口

| 模块 | 端点 | 说明 |
|---|---|---|
| 认证 | `POST /api/auth/login` | 登录 |
| 用户 | `GET/PUT /api/users/me` | 个人信息 |
| | `PUT /api/users/me/password` | 修改密码 |
| 管理 | `GET/POST/DELETE /api/admin/users` | 用户管理 |
| 笔记 | `GET/POST /api/notes` | 笔记列表 / 创建 |
| | `GET/PUT/DELETE /api/notes/:id` | 笔记详情 / 更新 / 删除 |
| | `PUT /api/notes/:id/pin` | 置顶 |
| | `PUT /api/notes/:id/restore` | 从回收站恢复 |
| 分类 | `GET/POST/PUT/DELETE /api/categories` | 分类 CRUD |
| 标签 | `GET/POST/PUT/DELETE /api/tags` | 标签 CRUD |
| 附件 | `POST/GET /api/attachments` | 图片上传/获取 |
| 设置 | `GET/PUT /api/settings` | 用户设置 |
| 导出 | `GET /api/export` | 导出为 ZIP |

## License

ISC
