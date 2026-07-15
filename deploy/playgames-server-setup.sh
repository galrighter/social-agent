#!/usr/bin/env bash
# playgames-server-setup.sh — provision the poker dashboard (Next.js standalone)
# on the Hetzner box, served by nginx at powdercoat.co.il/playgames.
#
# Runs ON the box as root, invoked by the deploy workflow over SSH.
# Design (same rules as powdercoat-server-setup.sh — the box also runs OpenClaw
# in Docker and the powdercoat static site; DO NOT disrupt them):
#   - Idempotent: safe to run on every deploy.
#   - Additive only: installs Node if missing, writes ONLY /opt/playgames,
#     its systemd unit, and the nginx snippet this app owns.
#   - The powdercoat vhost includes /etc/nginx/snippets/playgames.conf; this
#     script is the single writer of that snippet's content.
set -euo pipefail

APP_DIR="/opt/playgames/app"
DATA_DIR="/opt/playgames/data"
PORT=3017

echo "==> playgames server setup starting"

# --- 1. Node.js 20+ (idempotent) ----------------------------------------------
need_node=1
if command -v node >/dev/null 2>&1; then
  major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  [ "${major:-0}" -ge 20 ] && need_node=0
fi
if [ "$need_node" = 1 ]; then
  echo "==> installing Node.js 22 (nodesource)"
  export DEBIAN_FRONTEND=noninteractive
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
echo "==> node $(node -v), npm $(npm -v)"

# --- 2. Directories -------------------------------------------------------------
mkdir -p "$APP_DIR" "$DATA_DIR"

# --- 3. systemd unit ------------------------------------------------------------
cat > /etc/systemd/system/playgames.service <<UNIT
[Unit]
Description=playgames - poker dashboard (Next.js standalone)
After=network.target

[Service]
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=HOSTNAME=127.0.0.1
Environment=NEXT_PUBLIC_BASE_PATH=/playgames
Environment=DATABASE_URL=file:${DATA_DIR}/prod.db
# פרטי ההתחברות (PLAYGAMES_USER / PLAYGAMES_PASSWORD) — קובץ אופציונלי שנכתב
# בנפרד מחוץ לריפו הציבורי. אם חסר, השער כבוי (ה־'-' מונע כשל).
EnvironmentFile=-/etc/playgames/credentials
ExecStart=/usr/bin/env node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable playgames >/dev/null 2>&1 || true

# --- 4. nginx reverse-proxy snippet ---------------------------------------------
# ^~ makes the prefix win over the powdercoat vhost's regex cache block, so
# /playgames/_next/static/* reaches the app instead of 404ing on the static root.
mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/playgames.conf <<'NGINX'
location ^~ /playgames {
    proxy_pass http://127.0.0.1:3017;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Excel uploads
    client_max_body_size 25m;
    proxy_read_timeout 120s;
}
NGINX

# Reload nginx only if the config is valid (the include line ships separately in
# the powdercoat vhost; until it lands, writing the snippet is a harmless no-op).
if nginx -t >/dev/null 2>&1; then
  systemctl reload nginx || true
  echo "==> nginx snippet written + reloaded"
else
  echo "!! nginx -t failed — snippet written but NOT reloaded (check vhost)"
fi

echo "==> playgames server setup done (app dir: ${APP_DIR}, db: ${DATA_DIR}/prod.db, port: ${PORT})"
