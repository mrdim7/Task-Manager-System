# TaskFlow — On-Premises Ubuntu Deployment Guide

This guide walks through installing and running TaskFlow on a fresh Ubuntu 22.04 or 24.04 server.
The result is a production setup with nginx as the front door, the API running as a
managed systemd service, and the web UI served as static files.

---

## Architecture Overview

```
Browser → nginx (:80 / :443)
             ├── /api/*   → proxy  → Node.js API server (:8080)
             └── /*       → static files (Vite build output)
```

- **API server** — Express 5, Node.js, JWT auth; runs as a systemd service
- **Web app** — pre-built static files; nginx serves them directly (no Node.js at runtime)
- **Database** — PostgreSQL; schema managed by Drizzle ORM

---

## 1. Prerequisites

### 1.1 Install Node.js 24 (via NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # must be v24.x
```

### 1.2 Install pnpm

```bash
npm install -g pnpm
pnpm --version   # must be v9 or later
```

### 1.3 Install PostgreSQL

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

### 1.4 Install nginx

```bash
sudo apt-get install -y nginx
sudo systemctl enable --now nginx
```

### 1.5 (Optional) Install git

```bash
sudo apt-get install -y git
```

---

## 2. Create the Database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER taskflow WITH PASSWORD 'change_this_password';
CREATE DATABASE taskflow OWNER taskflow;
SQL
```

Note the connection URL — you will need it in the next step:

```
postgresql://taskflow:change_this_password@localhost:5432/taskflow
```

---

## 3. Deploy the Application

### 3.1 Create a dedicated system user

```bash
sudo useradd --system --shell /bin/bash --create-home taskflow
```

### 3.2 Copy the project onto the server

**Option A — clone from a git remote:**
```bash
sudo -u taskflow git clone https://your-git-host/your-org/taskflow.git /home/taskflow/app
```

**Option B — upload from your workstation (run this locally):**
```bash
# Exclude local dev artefacts
rsync -av --exclude node_modules --exclude '*/dist' --exclude '.git' \
  /path/to/taskflow/ your-server:/tmp/taskflow/
ssh your-server "mv /tmp/taskflow /home/taskflow/app && chown -R taskflow:taskflow /home/taskflow/app"
```

---

## 4. Environment Variables

Create the environment file that systemd will load:

```bash
sudo mkdir -p /etc/taskflow
sudo tee /etc/taskflow/env > /dev/null <<EOF
NODE_ENV=production
PORT=8080

# PostgreSQL connection string (edit to match step 2)
DATABASE_URL=postgresql://taskflow:change_this_password@localhost:5432/taskflow

# JWT signing secret — generate a strong random value:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
SESSION_SECRET=replace_with_64_char_random_hex
EOF

sudo chmod 600 /etc/taskflow/env
sudo chown root:root /etc/taskflow/env
```

Generate a proper `SESSION_SECRET` (run once and paste the output into the file above):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 5. Install Dependencies and Build

Switch to the application directory as the `taskflow` user:

```bash
sudo -u taskflow bash
cd /home/taskflow/app
```

Export the DATABASE_URL so the build can reach the database:

```bash
export $(sudo cat /etc/taskflow/env | grep -v '^#' | xargs)
```

### 5.1 Install all workspace dependencies

```bash
pnpm install --frozen-lockfile
```

### 5.2 Push the database schema

This creates all tables on first run. Re-run after any future schema update.

```bash
pnpm --filter @workspace/db run push
```

### 5.3 Build the API server

```bash
NODE_ENV=production pnpm --filter @workspace/api-server run build
```

Output: `artifacts/api-server/dist/index.mjs`

### 5.4 Build the web app

```bash
BASE_PATH=/ pnpm --filter @workspace/web run build
```

Output: `artifacts/web/dist/public/` (static HTML/JS/CSS, served by nginx)

Exit the taskflow shell when done:

```bash
exit
```

---

## 6. Seed Initial Data (First-Time Setup Only)

If your database is brand new, seed it with the default admin account and sample reference data:

```bash
sudo -u taskflow bash -c "
  export \$(sudo cat /etc/taskflow/env | grep -v '^#' | xargs)
  cd /home/taskflow/app
  pnpm --filter @workspace/scripts run seed
"
```

Default credentials created by the seed:

| Email | Password | Role |
|---|---|---|
| admin@taskflow.com | admin123 | Admin |
| bob@taskflow.com | user123 | User |
| carol@taskflow.com | user123 | User |

**Change all passwords immediately after first login** via the Users admin portal.

---

## 7. systemd Service for the API Server

```bash
sudo tee /etc/systemd/system/taskflow-api.service > /dev/null <<'UNIT'
[Unit]
Description=TaskFlow API Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=taskflow
WorkingDirectory=/home/taskflow/app
EnvironmentFile=/etc/taskflow/env
ExecStart=node --enable-source-maps artifacts/api-server/dist/index.mjs
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=taskflow-api

# Harden the process
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/home/taskflow/app
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now taskflow-api
sudo systemctl status taskflow-api
```

Verify the API is healthy:

```bash
curl -s http://localhost:8080/api/healthz
# Expected: {"status":"ok"}
```

---

## 8. nginx Configuration

```bash
sudo tee /etc/nginx/sites-available/taskflow > /dev/null <<'NGINX'
server {
    listen 80;
    server_name your-server-hostname-or-ip;   # <-- edit this

    # Gzip for static assets
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    # API — proxy to Node.js
    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Web app — static files
    root /home/taskflow/app/artifacts/web/dist/public;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache hashed assets aggressively; don't cache index.html
    location ~* \.(js|css|woff2?|png|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
NGINX

sudo ln -s /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/taskflow
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 9. HTTPS with Let's Encrypt (Recommended)

Requires a public domain name pointing at this server.

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com
sudo systemctl reload nginx
```

Certbot automatically edits the nginx config to add SSL and sets up auto-renewal.

### Self-signed certificate (internal/air-gapped networks)

```bash
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
  -keyout /etc/ssl/private/taskflow.key \
  -out /etc/ssl/certs/taskflow.crt \
  -subj "/CN=taskflow"
```

Then add to the nginx `server {}` block:

```nginx
listen 443 ssl;
ssl_certificate     /etc/ssl/certs/taskflow.crt;
ssl_certificate_key /etc/ssl/private/taskflow.key;
```

---

## 10. Firewall (ufw)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # opens 80 and 443
sudo ufw enable
sudo ufw status
```

Do **not** open port 8080 publicly — the API should only be reachable via nginx.

---

## 11. Operations Reference

### View live API logs

```bash
sudo journalctl -u taskflow-api -f
```

### Restart the API server

```bash
sudo systemctl restart taskflow-api
```

### Deploy an update

```bash
sudo -u taskflow bash
cd /home/taskflow/app

# Pull latest code
git pull

# Install any new dependencies
pnpm install --frozen-lockfile

# Apply any schema changes
export $(sudo cat /etc/taskflow/env | grep -v '^#' | xargs)
pnpm --filter @workspace/db run push

# Rebuild
NODE_ENV=production pnpm --filter @workspace/api-server run build
BASE_PATH=/ pnpm --filter @workspace/web run build

exit

# Restart the service to pick up the new API build
sudo systemctl restart taskflow-api
# nginx serves the new static files immediately — no reload needed
```

### Backup the database

```bash
sudo -u postgres pg_dump taskflow | gzip > /backups/taskflow_$(date +%F).sql.gz
```

### Restore the database

```bash
gunzip -c /backups/taskflow_2025-01-01.sql.gz | sudo -u postgres psql taskflow
```

---

## 12. Troubleshooting

| Symptom | Check |
|---|---|
| API returns 401 after login | Verify `SESSION_SECRET` in `/etc/taskflow/env` matches what was used to sign existing tokens; restart the service after changing it |
| nginx 502 Bad Gateway | `sudo systemctl status taskflow-api` — service may have crashed; check `journalctl -u taskflow-api` |
| Database connection error | Confirm `DATABASE_URL` is correct; check PostgreSQL is running: `sudo systemctl status postgresql` |
| Port 8080 refused | Normal — the API is only accessible through nginx on port 80/443 |
| Static files not updating | Browser may cache `index.html`; force-refresh with Ctrl+Shift+R; or verify the Vite build completed and nginx root path is correct |
| Schema drift after update | Re-run `pnpm --filter @workspace/db run push` with `DATABASE_URL` exported |

---

## 13. Docker Deployment (Alternative to systemd)

Use Docker when you want self-contained, image-based deployments rather than managing Node.js and nginx directly on the host.

### 13.1 Prerequisites

```bash
# Install Docker Engine
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # re-login after this

# Install Docker Compose v2
sudo apt-get install -y docker-compose-plugin
docker compose version
```

### 13.2 Transfer the project to the server

```bash
rsync -av --exclude node_modules --exclude '*/dist' --exclude '.git' \
  /path/to/taskflow/ your-server:/opt/taskflow/
```

### 13.3 Create the environment file

The Docker setup reads from `.env.docker` in the project root. A template is included — copy and edit it:

```bash
cd /opt/taskflow
cp .env.docker .env.docker.local
nano .env.docker.local
```

At minimum set these three values:

```
DATABASE_URL=postgresql://taskflow_user:password@your-existing-pg-host:5432/taskflow
SESSION_SECRET=<64-char random hex — see below>
```

Generate `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then update `docker-compose.yml` to point at your local file:

```yaml
env_file: .env.docker.local
```

### 13.4 Prepare the database on your existing PostgreSQL server

Connect to your PostgreSQL server and create a dedicated database and user for TaskFlow (do this once):

```sql
CREATE USER taskflow_user WITH PASSWORD 'strong_password_here';
CREATE DATABASE taskflow OWNER taskflow_user;
-- If the database already exists, just grant access:
-- GRANT ALL PRIVILEGES ON DATABASE taskflow TO taskflow_user;
```

### 13.5 Push the database schema

Before starting the containers, apply the TaskFlow schema to the database. Run this from the project directory on the server (requires Node.js and pnpm to be installed, or run it temporarily in a builder container):

```bash
DATABASE_URL=postgresql://taskflow_user:password@your-pg-host:5432/taskflow \
  pnpm --filter @workspace/db run push
```

Or use Docker to run it without installing Node.js on the host:

```bash
docker build --target builder -t taskflow-builder .
docker run --rm \
  -e DATABASE_URL=postgresql://taskflow_user:password@your-pg-host:5432/taskflow \
  taskflow-builder \
  pnpm --filter @workspace/db run push-force
```

### 13.6 Build and start

```bash
cd /opt/taskflow
docker compose build
docker compose up -d
docker compose ps        # confirm both services are up
docker compose logs -f   # watch live logs
```

TaskFlow is now reachable on port 80 of the host.

### 13.7 HTTPS in Docker

The recommended approach is to put a reverse proxy in front of the `web` container. Options:

**Nginx Proxy Manager (GUI)** — easiest:
```bash
# Add to docker-compose.yml under services:
#   proxy:
#     image: jc21/nginx-proxy-manager:latest
#     ports: ["80:80", "443:443", "81:81"]
#     volumes: [./proxy-data:/data, ./letsencrypt:/etc/letsencrypt]
```

**Traefik** — popular in production environments; add labels to the `web` service and configure a Let's Encrypt resolver.

**Host nginx** — keep nginx on the host, have it proxy to the container's port 80:
```nginx
server {
    listen 443 ssl;
    server_name your.domain.com;
    ssl_certificate     /etc/ssl/certs/taskflow.crt;
    ssl_certificate_key /etc/ssl/private/taskflow.key;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### 13.8 Update a running deployment

```bash
cd /opt/taskflow
git pull                         # or rsync from your workstation

# Apply any schema changes first
docker run --rm \
  -e DATABASE_URL=$(grep DATABASE_URL .env.docker.local | cut -d= -f2-) \
  $(docker compose build -q api) \
  node dist/index.mjs             # schema push via builder — see 13.5

docker compose build              # rebuild images
docker compose up -d              # rolling restart (web first, then api)
```

---

## 14. LDAP / Active Directory Authentication

TaskFlow supports two authentication modes simultaneously:

| Mode | How it works |
|---|---|
| **Local** | Password stored (bcrypt-hashed) in the TaskFlow database |
| **LDAP** | TaskFlow binds to your AD/LDAP server to verify the user's corporate password; no password stored locally |

Both modes can be active at the same time. Each user account has an `authProvider` field (`local` or `ldap`) set at creation.

### 14.1 Enable LDAP

Add the following environment variables to `/etc/taskflow/env` (systemd) or `.env.docker.local` (Docker):

```bash
# Required
LDAP_URL=ldap://your-dc.company.com:389

# For LDAPS (TLS — recommended for production):
# LDAP_URL=ldaps://your-dc.company.com:636

# Base DN — the root of your directory tree
LDAP_BASE_DN=DC=company,DC=com

# Service account used to search the directory (read-only is sufficient)
LDAP_BIND_DN=CN=svc-taskflow,OU=ServiceAccounts,DC=company,DC=com
LDAP_BIND_PASSWORD=service_account_password

# Filter to locate a user by the email they type at the login screen
# {{email}} is replaced with the LDAP-escaped email address
LDAP_USER_FILTER=(&(objectClass=person)(mail={{email}}))

# Attribute mapping (defaults shown — adjust to match your schema)
LDAP_ATTR_EMAIL=mail
LDAP_ATTR_FIRSTNAME=givenName
LDAP_ATTR_SURNAME=sn
```

Restart the API service after changing these values.

### 14.2 Common Active Directory filter patterns

| Scenario | Filter |
|---|---|
| Match by `mail` attribute (most common) | `(&(objectClass=person)(mail={{email}}))` |
| Match by User Principal Name | `(&(objectClass=user)(userPrincipalName={{email}}))` |
| Restrict to a specific OU | `(&(objectClass=person)(mail={{email}})(memberOf=CN=TaskFlow-Users,OU=Groups,DC=company,DC=com))` |

### 14.3 Creating LDAP users in the admin portal

In the **Users** admin page, click **New User** and set **Auth Provider** to **LDAP / Active Directory**. No password is required — TaskFlow will never store one.

Alternatively, users can simply log in for the first time using their corporate credentials and TaskFlow will **auto-provision** their account automatically (with `isAdmin: false` by default).

### 14.4 Behaviour differences for LDAP accounts

- The **Reset Password** button is hidden for LDAP users (password is managed in AD)
- The **Change Password** form in Settings is blocked for LDAP users
- On each LDAP login, TaskFlow refreshes the user's first name and surname from the directory
- Disabling a user in TaskFlow (`isActive: false`) will prevent login even if the AD account is still active

### 14.5 Troubleshooting LDAP

| Symptom | Check |
|---|---|
| LDAP users get "Invalid email or password" | Verify `LDAP_URL` is reachable from the server; check `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD`; confirm the filter matches a real user |
| "LDAP authentication is not configured" | `LDAP_URL` env var is missing; restart the API after adding it |
| Name not updating after AD change | Name syncs on every successful login; if it's not updating, the LDAP attributes may be mapped to wrong field names |
| LDAPS certificate errors | The server uses `rejectUnauthorized: false` for self-signed certs; for CA-signed certs this works automatically |
