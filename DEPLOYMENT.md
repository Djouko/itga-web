# ITGA Web Deployment

This repository contains the Next.js public web app.

## Required environment variables

Create the variables in EasyPanel before building:

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.example/api
NEXT_PUBLIC_API_KEY=replace-with-backend-API_SECRET_KEY
```

`NEXT_PUBLIC_*` values are embedded at build time, so rebuild after changing them.

## EasyPanel

- Build type: Dockerfile
- Build context: repository root
- Dockerfile path: `Dockerfile`
- Internal port: `3000`
- Start command: handled by Dockerfile with `node server.js`

## Local validation

```bash
npm ci
npm run build
```
