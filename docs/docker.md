# Frontend Docker

GeoDom frontend now has a production-style multi-stage image:

- Node builds the Vite bundle;
- Nginx serves the static SPA;
- `/healthz` is available for container health checks;
- `/assets` receives immutable caching;
- React Router uses `index.html` fallback;
- local temporary housing media is mounted at runtime instead of baked into the image.

## Local build

Create `.env` from `.env.example` and set at least the Yandex JavaScript API key.

```bash
docker compose build
docker compose up -d
```

Frontend: http://localhost:3000

Change the host port with `GEODOM_FRONTEND_PORT`.

## Local housing media

Run `npm run media:manifest` before the Docker build when using the temporary local-media bridge. The actual files under `public/media` are bind-mounted read-only by Compose, so hundreds of apartment photos do not become layers inside every frontend image rebuild.

## Backend integration later

This compose file intentionally contains only the frontend today. When the Go service is added, prefer same-origin reverse proxying through Nginx rather than baking a container hostname into browser JavaScript. At that point add a `backend` service and proxy a stable prefix such as `/backend/` to the Go container.
