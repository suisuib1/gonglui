# 高德地图路线打卡

这是一个高德地图路线打卡网页。用户输入地点后，可以生成地图点位和简单路线；每个地点可以保存备注和图片，路线也可以保存到后端并从服务器加载回来。

## 技术栈

- 前端：Vue 3 + Vite + 高德 JS API 2.0
- 后端：Node.js + Express
- 数据库：Prisma + PostgreSQL
- 图片：multer + 本地 uploads

## 环境变量

### 前端

复制 `.env.example` 为 `.env.local`：

```env
VITE_AMAP_KEY=你的高德JSAPI_KEY
VITE_AMAP_SECURITY_CODE=你的高德安全密钥
```

### 后端

复制 `server/.env.example` 为 `server/.env`：

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55432/gonglui?schema=public"
PORT=3001
UPLOAD_DIR="uploads"
```

注意：

- 不要提交 `.env.local`
- 不要提交 `server/.env`
- 不要提交真实高德 Key

## 数据库启动方式

### 方式 A：已有 PostgreSQL

提前创建数据库：

```text
gonglui
```

然后执行：

```bash
cd server
npx prisma migrate dev
```

### 方式 B：本地隔离 PostgreSQL

当前开发环境曾使用 `.codex-postgres/` 作为隔离开发库：

- `.codex-postgres/` 已被 git 忽略
- 它只是本地开发数据目录，不应提交
- 端口为 `55432`
- 需要本机 PostgreSQL 16 二进制支持
- 换机器后可以直接使用系统 PostgreSQL 或 Docker PostgreSQL

如果要复用这种方式，需要自行用 PostgreSQL 16 的 `initdb` / `pg_ctl` 初始化并启动本地数据目录，然后让 `server/.env` 的 `DATABASE_URL` 指向 `127.0.0.1:55432`。

## 安装和启动

### 前端

```bash
npm install
npm run dev
```

### 后端

```bash
cd server
npm install
npx prisma migrate dev
npm run dev
```

## 验证命令

### 前端

```bash
npm run build
```

### 后端

```bash
cd server
npx prisma validate
npx prisma generate
npm test
```

## 已实现功能

- 地点输入解析
- 高德地图 Marker
- 简单折线
- 地点详情
- 备注
- 本地图片预览
- localStorage 草稿
- 路线保存到服务器
- 路线列表
- 图片上传
- 图片删除

## 未实现功能

- 真实驾车/步行路线规划
- 多地点分段规划
- 分享页
- 登录权限
- 对象存储
- 删除路线时清理 uploads 文件
