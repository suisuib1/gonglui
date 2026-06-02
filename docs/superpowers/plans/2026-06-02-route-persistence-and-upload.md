# Route Persistence And Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Express + Prisma backend for route persistence, place notes, and local image uploads while preserving the existing Vue localStorage draft flow.

**Architecture:** The server owns database persistence and uploaded file storage. The Vue editor keeps its current local draft data, adds API calls for server save/load, and uploads images only when a place has a server id.

**Tech Stack:** Vue 3, Vite, Node.js, Express, Prisma, PostgreSQL, multer, local uploads directory.

---

### Task 1: Server Scaffold And Prisma Schema

**Files:**
- Create: `server/package.json`
- Create: `server/.env.example`
- Create: `server/prisma/schema.prisma`
- Create: `server/uploads/.gitkeep`
- Modify: `.gitignore`

- [ ] Add backend dependencies and scripts.
- [ ] Define `Route`, `RoutePlace`, and `PlaceImage` models.
- [ ] Ignore real env files, `node_modules`, generated build output, and uploaded files while keeping `.env.example` and `.gitkeep`.

### Task 2: Backend API

**Files:**
- Create: `server/src/app.js`
- Create: `server/src/server.js`
- Create: `server/src/lib/prisma.js`
- Create: `server/src/routes/index.js`
- Create: `server/src/controllers/routesController.js`
- Create: `server/src/controllers/placesController.js`
- Create: `server/src/controllers/imagesController.js`
- Create: `server/src/middlewares/upload.js`
- Create: `server/src/services/routePayload.js`
- Create: `server/src/services/fileStorage.js`

- [ ] Normalize frontend place payloads to Prisma fields.
- [ ] Implement route create/list/detail/update/delete endpoints.
- [ ] Implement place note update endpoint.
- [ ] Implement image upload and delete endpoints with safe filenames and mime/size limits.
- [ ] Serve `/uploads` statically.

### Task 3: Frontend Integration

**Files:**
- Create: `src/services/apiClient.js`
- Create: `src/services/routeApi.js`
- Modify: `src/components/RouteEditor.vue`
- Modify: `src/components/PlaceDetailPanel.vue`
- Modify: `src/style.css`
- Modify: `vite.config.js`
- Modify: `package.json`

- [ ] Add Vite proxy for `/api` and `/uploads`.
- [ ] Add server save and saved route list loading to the left editor panel.
- [ ] Preserve local draft save/clear exactly as a separate workflow.
- [ ] Upload images to server when the active place has a server id; otherwise keep local preview and prompt the user to save first.
- [ ] Display backend `imageUrl` as well as legacy local `dataUrl`.

### Task 4: Verification And Git

**Commands:**
- `npm run build`
- `cd server; npm install`
- `cd server; npx prisma validate`
- `cd server; npm test`
- `git status --short`
- `git diff --check`
- `git add .`
- `git commit -m "新增路线保存和图片上传后端"`
- `git push`

- [ ] If PostgreSQL is available, run `npx prisma migrate dev --name init`.
- [ ] If PostgreSQL is not available, report the exact setup needed instead of blocking completion.
- [ ] Confirm no `.env`, `.env.local`, `server/.env`, `node_modules`, `dist`, or real uploaded files are staged.
