#!/bin/sh
# Gera /runtime-config.js a partir das variáveis do container: a mesma imagem serve em qualquer hospedagem.
set -eu

export VITE_API_URL="${VITE_API_URL:-}"
export VITE_REALTIME_URL="${VITE_REALTIME_URL:-}"

if [ -z "$VITE_API_URL" ]; then
  echo "[ag3-runtime-config] ERRO: VITE_API_URL não definido: o app subiria sem API." >&2
  exit 1
fi
echo "[ag3-runtime-config] api=$VITE_API_URL realtime=${VITE_REALTIME_URL:-<derivado da api>}"

envsubst '${VITE_API_URL} ${VITE_REALTIME_URL}' \
  < /opt/ag3/runtime-config.template.js > /usr/share/nginx/html/runtime-config.js
