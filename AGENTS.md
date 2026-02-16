# AGENTS.md

This file provides context and guidelines for AI coding agents working on this repository.

## Project Overview

This is a **Ticket Statistics Dashboard** application for querying and visualizing monthly ticket/chat statistics (bot, WhatsApp, phone) by insurance company and date range. The application consists of two main components:

1. **Frontend** — A single-page HTML dashboard (`index.html`) using Fluent UI Web Components, Chart.js, and Flatpickr.
2. **Backend** — An Express.js proxy server (`server.js`) that forwards requests to an upstream internal API with authentication.

The UI is in **Hebrew** and uses **RTL (right-to-left)** layout.

## Architecture

```
Browser (index.html)
   │
   │  POST /tickets  { insCompanyId, fromDate, toDate }
   ▼
Express Proxy (server.js)
   │
   │  POST + Authorization header
   ▼
Upstream API (GetMonthlyTicketStats)
```

- The frontend sends POST requests to the proxy's `/tickets` endpoint.
- When "all companies" is selected, the frontend iterates over each company and sums the results client-side.
- The proxy attaches the `AUTH_TOKEN` from environment variables and forwards the request to the upstream API.

## Tech Stack

- **Runtime**: Node.js >= 18 (ES modules)
- **Backend framework**: Express 4.x
- **HTTP client**: node-fetch 3.x
- **Frontend libraries** (loaded via CDN):
  - Fluent UI Web Components (`@fluentui/web-components`)
  - Chart.js (bar charts)
  - Flatpickr (date range picker, Hebrew locale)
- **Deployment target**: IIS with iisnode (see `web.config`)
- **Package manager**: npm

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Dashboard frontend — Fluent UI layout, date pickers, chart rendering |
| `server.js` | Express proxy — CORS, logging, auth injection, upstream forwarding |
| `package.json` | Node.js dependencies and scripts |
| `web.config` | IIS/iisnode deployment configuration |
| `.gitignore` | Excludes `node_modules/`, `.env`, logs |

## Development

### Running Locally

```bash
npm install
npm run dev    # starts server with --watch on port 3000
```

Then open `http://localhost:3000/`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `3000`) |
| `AUTH_TOKEN` | Yes | Bearer token for upstream API authentication |
| `UPSTREAM_URL` | No | Upstream API URL (has a default) |
| `APPLICATION_PREFIX` | No | URL prefix for IIS sub-application routing |
| `NODE_ENV` | No | `development` or `production` |
| `LOG_LEVEL` | No | `DEBUG`, `INFO`, `WARN`, or `ERROR` (default: `INFO`) |
| `PUBLIC_BASE_URL` | No | Public-facing base URL for log output |

**Important**: Never commit tokens or secrets. Use environment variables or IIS `web.config` for sensitive configuration.

## Coding Conventions

- **Language**: The UI text is in Hebrew. Keep all user-facing strings in Hebrew.
- **Module system**: The backend uses ES modules (`"type": "module"` in `package.json`). Use `import`/`export`, not `require`.
- **Styling**: The frontend uses CSS custom properties (Fluent 2 design tokens defined in `:root`). Prefer using existing CSS variables over hardcoded colors.
- **Logging**: The backend uses a structured logger with categories (`API_REQUEST`, `API_RESPONSE`, `UPSTREAM_CALL`, `ERROR`, `PERFORMANCE`, `SERVER`). Use the `logger` object for all server-side logging.
- **Security**: Mask sensitive data (tokens) in logs using the `maskToken()` helper. Never log full tokens.
- **CORS**: The proxy allows all origins (`*`). This is intentional for the current deployment.

## Deployment Notes

- The application is designed to run behind IIS using iisnode.
- The `APPLICATION_PREFIX` environment variable supports deployment as an IIS sub-application (e.g., `/TicketStats`).
- The `web.config` file handles IIS URL rewriting to route requests to `server.js`.
- Health check endpoint: `GET /health`
- Diagnostics endpoint: `GET /diag`
