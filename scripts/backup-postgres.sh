#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BACKUP_DIR}"

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "${ROOT_DIR}/.env" ]; then
    export "$(grep -E '^DATABASE_URL=' "${ROOT_DIR}/.env" | cut -d= -f1)"="$(grep -E '^DATABASE_URL=' "${ROOT_DIR}/.env" | cut -d= -f2-)"
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_DIR}/foodfest-${TIMESTAMP}.sql.gz"
echo "Backup written to ${BACKUP_DIR}/foodfest-${TIMESTAMP}.sql.gz"
