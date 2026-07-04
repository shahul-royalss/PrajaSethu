#!/usr/bin/env bash
# Praja Setu — fetch Prisma engine binaries via curl.
#
# WHY THIS EXISTS: In a normal environment `npm install` / `prisma generate`
# downloads the engines automatically. In this sandbox, outbound HTTPS is forced
# through a TLS-terminating proxy that resets Prisma's Node/undici downloader,
# while curl (which honours the proxy + CA bundle) works fine. This script does
# the download with curl and drops the engines into Prisma's cache so the normal
# `prisma generate` / `db push` commands find them and skip the broken download.
#
# Safe to run anywhere: if the engines already exist it is a no-op.
set -euo pipefail

HASH="$(node -e "console.log(require('@prisma/engines-version').enginesVersion)")"
# Detect platform target (Debian/Ubuntu with OpenSSL 3.x in this image).
PLAT="debian-openssl-3.0.x"
BASE="https://binaries.prisma.sh/all_commits/${HASH}/${PLAT}"
CACHE="${HOME}/.cache/prisma/master/${HASH}/${PLAT}"
mkdir -p "${CACHE}"

fetch() {
  local name="$1" out="$2"
  if [ -f "${CACHE}/${out}" ]; then
    echo "✓ ${out} already present"
    return
  fi
  echo "↓ ${name}"
  curl -fsSL --max-time 180 -o "${CACHE}/${name}.gz" "${BASE}/${name}.gz"
  gunzip -f "${CACHE}/${name}.gz"
  [ "${out}" = "schema-engine" ] && chmod +x "${CACHE}/${out}" || true
  echo "✓ ${out}"
}

fetch "libquery_engine.so.node" "libquery_engine.so.node"
fetch "schema-engine" "schema-engine"
# The generated client + runtime resolve the engine by its platform-suffixed name.
cp -f "${CACHE}/libquery_engine.so.node" "${CACHE}/libquery_engine-${PLAT}.so.node"
echo "Prisma engines ready in ${CACHE}"
