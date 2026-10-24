#!/bin/sh
set -e

echo "============================================================"
echo "🚀 PROPOSAL AUTOPILOT BACKEND: CONTAINER INITIALIZATION"
echo "============================================================"

# 1. Ejecutar migraciones de forma controlada
echo "📦 Aplicando migraciones de base de datos..."
if ! npx prisma migrate deploy; then
  echo ""
  echo "🚨 ERROR CRÍTICO: La migración de base de datos falló."
  echo "💡 Diagnóstico: Revisa si hay una migración fallida en _prisma_migrations."
  echo "💡 Recuperación rápida: Ejecuta 'node scripts/factory/af.mjs migrate doctor'"
  echo "⏳ Esperando 30 segundos antes de reiniciar para evitar saturar el pool de conexiones..."
  sleep 30
  exit 1
fi

echo "✅ Migraciones completadas con éxito."

# 2. Ejecutar seed seguro e idempotente
echo "🌱 Verificando catálogo y tenant base (seed)..."
if ! npx prisma db seed; then
  echo "⚠️ Advertencia: El seed retornó un aviso, continuando con el arranque..."
fi

# 3. Iniciar la aplicación NestJS
echo "🌟 Iniciando servidor NestJS en puerto ${PORT:-7000}..."
exec node dist/main.js
