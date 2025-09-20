#!/bin/bash

# ==============================================================================
# Script para gestionar API Gateways en Google Cloud
# ==============================================================================
set -e

# --- Configuración ---
GCP_PROJECT_ID=$(gcloud config get-value project)
GCP_REGION="us-central1"  # API Gateway disponible aquí
API_NAME="$GATEWAY_API_NAME"

# --- Validar argumentos ---
if [ $# -ne 1 ]; then
    echo "❌ Error: Debes especificar el entorno"
    echo ""
    echo "Uso: $0 <entorno>"
    echo ""
    echo "Entornos disponibles:"
    echo "  dev   - Entorno de desarrollo"
    echo "  prod  - Entorno de producción"
    echo ""
    echo "Ejemplos:"
    echo "  $0 dev"
    echo "  $0 prod"
    exit 1
fi

ENVIRONMENT=$1
GATEWAY_NAME="${API_NAME}-${ENVIRONMENT}"

# --- Validar entorno ---
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
    echo "❌ Error: Entorno '$ENVIRONMENT' no válido"
    echo "Usa 'dev' o 'prod'"
    exit 1
fi

# --- Validar variable requerida ---
if [[ -z "$GATEWAY_API_NAME" ]]; then
    echo "❌ Error: Variable GATEWAY_API_NAME no está configurada"
    echo ""
    echo "💡 Configúrala con:"
    echo "   export GATEWAY_API_NAME=mi-api-gateway"
    exit 1
fi

echo "🚪 Gestionando Gateway para entorno: $ENVIRONMENT"
echo "   📁 Proyecto: ${GCP_PROJECT_ID}"
echo "   🌍 Región: ${GCP_REGION}"
echo "   🔗 API: ${API_NAME}"
echo "   🚪 Gateway: ${GATEWAY_NAME}"
echo "------------------------------------------------------------------"

# ==============================================================================
# 1. OBTENER LA CONFIGURACIÓN MÁS RECIENTE
# ==============================================================================
echo "🔍 Buscando configuración más reciente..."

# Obtener la configuración más reciente para este entorno
LATEST_CONFIG=$(gcloud api-gateway api-configs list \
    --api=${API_NAME} \
    --format="value(name)" \
    --project="${GCP_PROJECT_ID}" | grep "config-${ENVIRONMENT}-" | tail -1)

if [ -z "$LATEST_CONFIG" ]; then
    echo "❌ Error: No se encontró ninguna configuración para el entorno '$ENVIRONMENT'"
    echo ""
    echo "💡 Primero debes desplegar una configuración:"
    echo "   npm run openapi:generate:${ENVIRONMENT}"
    echo "   npm run gateway:deploy:${ENVIRONMENT}"
    exit 1
fi

echo "✅ Configuración encontrada: $LATEST_CONFIG"

# ==============================================================================
# 2. CREAR O ACTUALIZAR EL GATEWAY
# ==============================================================================
echo "🚪 Verificando gateway..."

if gcloud api-gateway gateways describe ${GATEWAY_NAME} \
    --location=${GCP_REGION} \
    --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    
    # Gateway existe - actualizarlo
    echo "   -> Actualizando gateway existente..."
    gcloud api-gateway gateways update ${GATEWAY_NAME} \
        --api=${API_NAME} \
        --api-config=${LATEST_CONFIG} \
        --location=${GCP_REGION} \
        --project="${GCP_PROJECT_ID}"
    
    echo "✅ Gateway actualizado"
else
    # Gateway no existe - crearlo
    echo "   -> Creando nuevo gateway..."
    gcloud api-gateway gateways create ${GATEWAY_NAME} \
        --api=${API_NAME} \
        --api-config=${LATEST_CONFIG} \
        --location=${GCP_REGION} \
        --project="${GCP_PROJECT_ID}"
    
    echo "✅ Gateway creado"
fi

# ==============================================================================
# 3. OBTENER INFORMACIÓN DEL GATEWAY
# ==============================================================================
echo "📋 Obteniendo información del gateway..."

GATEWAY_URL=$(gcloud api-gateway gateways describe ${GATEWAY_NAME} \
    --location=${GCP_REGION} \
    --project="${GCP_PROJECT_ID}" \
    --format="value(defaultHostname)")

if [ -z "$GATEWAY_URL" ]; then
    echo "⚠️ Advertencia: No se pudo obtener la URL del gateway"
    GATEWAY_URL="[URL no disponible - revisa la consola de Google Cloud]"
fi

echo ""
echo "🎉 ¡GATEWAY CONFIGURADO EXITOSAMENTE! 🎉"
echo ""
echo "📡 Información del Gateway:"
echo "   🏷️  Nombre: ${GATEWAY_NAME}"
echo "   🔗 API: ${API_NAME}"
echo "   ⚙️  Config: ${LATEST_CONFIG}"
echo "   🌍 Región: ${GCP_REGION}"
echo "   🔗 URL: https://${GATEWAY_URL}"
echo ""
echo "🧪 Prueba tus endpoints:"
echo "   curl -H \"x-api-key: TU_API_KEY\" https://${GATEWAY_URL}/users"
echo "   curl -H \"x-api-key: TU_API_KEY\" https://${GATEWAY_URL}/orders"
echo ""
echo "💡 Notas importantes:"
echo "   • Todos los endpoints requieren API key"
echo "   • Usa header 'x-api-key' o query param 'key'"
echo "   • Configura las API keys en Google Cloud Console"
echo ""
echo "🔧 Comandos útiles:"
echo "   • Ver gateways: gcloud api-gateway gateways list --location=${GCP_REGION}"
echo "   • Ver configs: gcloud api-gateway api-configs list --api=${API_NAME}"
echo "   • Actualizar: $0 ${ENVIRONMENT}"
echo ""