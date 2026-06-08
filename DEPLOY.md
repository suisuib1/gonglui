# Gonglui Deployment Guide

Deploy target:

- Frontend: Cloudflare Pages
- Backend: Render or Koyeb
- Database: Supabase PostgreSQL

## 1. Supabase PostgreSQL

1. Create a Supabase project.
2. Open Project Settings -> Database -> Connection string.
3. Copy a pooled connection string for the app runtime and set it as `DATABASE_URL`.
4. Copy a direct connection string for Prisma migrations and set it as `DIRECT_URL`.
5. Replace the database password and project ref placeholders before saving them in Render/Koyeb.

Use this shape:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
```

`DATABASE_URL` is the pooled connection used by Prisma Client at runtime. `DIRECT_URL` is the direct connection used by Prisma Migrate.

## 2. Render Backend

Create a Web Service from `github.com/suisuib1/gonglui`.

- Root Directory: `server`
- Build Command: `npm install && npm run build && npm run prisma:migrate`
- Start Command: `npm run start`

Environment variables:

```env
DATABASE_URL=your Supabase pooled connection string
DIRECT_URL=your Supabase direct connection string
CORS_ORIGIN=https://your-cloudflare-pages-domain.pages.dev,https://your-custom-domain.com
AMAP_WEB_SERVICE_KEY=your AMap Web Service key
UPLOAD_DIR=uploads
NODE_ENV=production
```

Render provides `PORT`; do not hardcode it. Uploaded files are served from `/uploads`, but a plain instance filesystem can be ephemeral. Add persistent storage or move uploads to object storage before relying on images long term.

## 3. Koyeb Backend

Create an app from `github.com/suisuib1/gonglui`.

- Root Directory: `server`
- Build Command: `npm install && npm run build && npm run prisma:migrate`
- Run Command: `npm run start`

Environment variables:

```env
DATABASE_URL=your Supabase pooled connection string
DIRECT_URL=your Supabase direct connection string
CORS_ORIGIN=https://your-cloudflare-pages-domain.pages.dev,https://your-custom-domain.com
AMAP_WEB_SERVICE_KEY=your AMap Web Service key
UPLOAD_DIR=uploads
NODE_ENV=production
```

Prisma CLI is in `dependencies`, so `NPM_CONFIG_PRODUCTION=false` is not required. If you move Prisma back to `devDependencies`, set `NPM_CONFIG_PRODUCTION=false` or the deploy build may not find `prisma`.

## 4. Cloudflare Pages Frontend

Create a Pages project from `github.com/suisuib1/gonglui`.

- Root Directory: repository root
- Build Command: `npm run build`
- Output Directory: `dist`

Environment variables:

```env
VITE_API_BASE_URL=https://your-render-or-koyeb-backend-domain
VITE_AMAP_KEY=your AMap JS API key
VITE_AMAP_SECURITY_CODE=your AMap JS security code
```

`VITE_API_BASE_URL` must be the backend origin only, without a trailing `/api`.

## 5. Deploy Verification

1. Open `https://your-backend-domain/health` and check for `{ "code": 0, "message": "ok" }`.
2. Open the Cloudflare Pages frontend.
3. Create a route.
4. Add places to the route.
5. Upload an image and confirm it loads from `https://your-backend-domain/uploads/...`.
6. Run AMap route planning with driving or walking mode.

## 6. Troubleshooting

- CORS error: confirm `CORS_ORIGIN` exactly matches the frontend origin, including `https://`, and separate multiple domains with commas.
- `DATABASE_URL` error: use the Supabase pooled connection string for `DATABASE_URL`; check password escaping if it contains special characters.
- Prisma migrate failed: confirm `DIRECT_URL` is set and points to the direct Supabase database connection, then rerun `npm run prisma:migrate` from the `server` directory.
- AMap `10009` or `10021`: verify the frontend JS API key, backend Web Service key, domain restrictions, service permissions, and security code.
- Upload image 404: confirm the backend has created `UPLOAD_DIR`, `/uploads` is served by Express, and the image URL uses the backend domain.
- Frontend still requests localhost: set `VITE_API_BASE_URL` in Cloudflare Pages and redeploy. In the browser DevTools Network tab, API calls should go to the backend domain.

References:

- Cloudflare Pages Vite guide: https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/
- Render Node Express guide: https://render.com/docs/deploy-node-express-app
- Koyeb Node.js guide: https://www.koyeb.com/docs/build-and-deploy/build-from-git/nodejs
- Koyeb environment variables: https://www.koyeb.com/docs/build-and-deploy/environment-variables
- Supabase Prisma guide: https://supabase.com/docs/guides/database/prisma
- Prisma PostgreSQL connector: https://docs.prisma.io/docs/orm/core-concepts/supported-databases/postgresql
