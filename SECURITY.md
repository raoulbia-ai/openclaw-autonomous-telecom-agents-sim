# Security Hardening — Pre-Public Checklist

Steps taken to secure the NKA web UI before opening to public access.

---

## 1. Authentication — Free Registration System

**Before:** Single shared passphrase (`APP_PASSPHRASE` env var). Anyone with the passphrase had full access.

**After:** Per-user accounts with email + password.

- SQLite database at `webui/data/users.db`
- Passwords hashed with bcryptjs (10 rounds)
- Session-based auth (24h cookie, `httpOnly`, `sameSite: lax`)
- Endpoints: `/api/register`, `/api/login`, `/api/logout`, `/api/me`
- All API routes gated behind `requireAuth` middleware
- Open paths: `/login`, `/api/login`, `/api/register` only
- `data/` directory gitignored

Files: `webui/db.js` (new), `webui/auth.html` (new), `webui/server.js` (modified)

## 2. Security Headers — Helmet

Added `helmet` middleware with explicit Content Security Policy:

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src` | `'self'` | Block all external resources by default |
| `script-src` | `'self' 'unsafe-inline'` | Inline scripts needed for auth.html |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind/React inline styles |
| `img-src` | `'self' data: blob: https://*.openfreemap.org` | Map tiles |
| `connect-src` | `'self' https://*.openfreemap.org` | Map tile fetches |
| `worker-src` | `'self' blob:` | MapLibre GL web workers |
| `form-action` | `'self'` | Prevent form submission to external sites |
| `frame-ancestors` | `'self'` | Prevent clickjacking |
| `object-src` | `'none'` | Block plugins |

Note: `useDefaults: false` to avoid `upgrade-insecure-requests` (site runs on HTTP).

## 3. CORS

Added `cors` middleware restricting `Origin` to the public access URL.

```js
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://46.62.146.152:9000';
```

Configurable via env var for when domain/HTTPS is set up.

## 4. Path Traversal Audit

All file-serving routes audited — **no vulnerabilities found**.

- All file paths use hardcoded constants (`ARTIFACTS_DIR`, `ATLAS_DIR`, `AGENTS_DIR`)
- The one user-controlled route (`/api/atlas/history/:id`) already sanitises with `path.basename()`
- `readArtifact()` only called with hardcoded string literals
- `express.static()` serves from a fixed directory
- `inject-fault` uses `cellId` as data, not in file paths

## 5. Request Limits

- `express.json({ limit: '100kb' })` — prevents large payload attacks
- `express.urlencoded({ limit: '100kb' })` — same for form data

## 6. Reverse Proxy (Caddy)

Caddyfile prepared at `webui/Caddyfile`. Adds:

- Additional security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `-Server`)
- Request body size limit (10MB)
- SSE flush support (`flush_interval -1`)
- Access logging to `/tmp/nka-caddy-access.log`

**Status:** Not currently active. Requires either:
- A domain + port 443 access for auto-HTTPS (DuckDNS subdomain `openclaw-nka` registered, firewall blocks inbound on 443/8000)
- Or `sudo setcap` to allow Caddy to bind low ports

Express serves directly on `:9000` for now.

## 7. DuckDNS Domain

Registered `openclaw-nka.duckdns.org` pointing to `176.61.57.175`. Ready for HTTPS when firewall allows port 443.

---

## Remaining Items

| Item | Status | Blocker |
|------|--------|---------|
| HTTPS (TLS) | Blocked | Firewall won't pass port 443/8000 to Caddy |
| Secure cookies | Waiting | Needs HTTPS first |
| Rate limiting | Not done | Consider if abuse is observed |
| Email verification | Not done | Not needed for demo |
| Account deletion | Not done | Can be done via SQLite directly |
