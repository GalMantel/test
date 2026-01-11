# ticket-proxy

Small Express proxy that forwards `POST /tickets` to an upstream API (with an `Authorization` header), and exposes `GET /health` + `GET /diag` for monitoring.

## Environment variables

- **`PORT`**: Listening port (IIS/iisnode typically sets this automatically).
- **`APPLICATION_PREFIX`**: Optional sub-path prefix (e.g. `"/ticket-proxy"`). Can be `ticket-proxy` or `/ticket-proxy`.
- **`UPSTREAM_URL`**: Upstream API URL to call.
- **`AUTH_TOKEN`**: Required bearer token (do not hardcode in source).
- **`LOG_LEVEL`**: `DEBUG` | `INFO` | `WARN` | `ERROR` (default `INFO`).
- **`PUBLIC_BASE_URL`**: Optional, used only for nicer startup logs.

## Local run

```bash
npm install
AUTH_TOKEN="Bearer <token>" UPSTREAM_URL="http://example/api" npm start
```

Then:

- `GET http://localhost:3000/health`
- `GET http://localhost:3000/diag`
- `POST http://localhost:3000/tickets`

## IIS deployment

Use `web.config` to set environment variables (`UPSTREAM_URL`, `AUTH_TOKEN`, and optionally `APPLICATION_PREFIX`).

