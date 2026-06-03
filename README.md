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
AMAP_WEB_SERVICE_KEY="你的高德Web服务KEY"
```

注意：

- 不要提交 `.env.local`
- 不要提交 `server/.env`
- 不要提交真实高德 Key
- `AMAP_WEB_SERVICE_KEY` 只给后端读取，用于高德 Web 服务驾车/步行路线规划，不能放到前端环境变量里

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
- 驾车真实路线规划
- 步行真实路线规划
- 多地点路线分段
- 智能排序
- 地点详情
- 备注
- 本地图片预览
- localStorage 草稿
- 路线保存到服务器
- 路线列表
- 路线规划结果随路线保存
- 图片上传
- 图片删除

## 路线模式

- 简单连线：按相邻地点直接绘制直线，不需要高德 Web 服务 Key。
- 驾车路线：通过后端 `AMAP_WEB_SERVICE_KEY` 请求高德 Web 服务；超过 18 个地点时会自动分段，保持前后段连续。
- 步行路线：通过后端 `AMAP_WEB_SERVICE_KEY` 按相邻地点逐段规划，不使用途经点。
- 失败段：高德规划失败或返回数据不完整时，该段会回退为直线，地图仍显示完整路线。

## 路线规划快照

- 保存路线时，会把当前生成的路线规划结果一起保存到服务器，包括规划模式、路段 path、距离/耗时摘要和规划时间。
- 加载已保存路线详情时，如果服务器已有规划结果，地图会优先显示上次保存的路线规划，不需要重新点击“生成路线”。
- 修改地点文本、地点顺序或路线模式后，当前规划结果会标记为过期，需要重新生成路线后再保存最新路线。
- 当前不保证规划结果永久有效，因为道路和高德数据可能变化；用户可以重新生成路线来刷新规划结果。

## 智能排序

- 第一个地点固定为起点，不会被重排。
- 默认不回到起点，也不指定固定终点。
- 优化目标优先使用预计耗时 `duration`，不可用时使用距离 `distance`。
- 2 到 10 个点更适合使用智能排序。
- 11 到 20 个点使用 nearest neighbor + 2-opt 近似优化，不保证数学最优。
- 超过 20 个点建议拆分路线。
- 驾车/步行智能排序需要后端 `AMAP_WEB_SERVICE_KEY`。
- 简单连线智能排序使用直线距离近似。

## 未实现功能

- 分享页
- 登录权限
- 对象存储
- 删除路线时清理 uploads 文件
