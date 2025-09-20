#!/bin/bash

# Script wrapper para generar especificación OpenAPI
# Uso: ./generate-openapi.sh [environment] [options]

set -e

# Directorio del script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Función para mostrar ayuda
show_help() {
    echo "Generador de Especificación OpenAPI para Google Cloud API Gateway"
    echo ""
    echo "Uso: $0 [environment] [options]"
    echo ""
    echo "Entornos:"
    echo "  dev         Generar para desarrollo (default)"
    echo "  prod        Generar para producción"
    echo ""
    echo "Opciones:"
    echo "  --help      Mostrar esta ayuda"
    echo "  --validate  Validar especificación después de generar"
    echo "  --deploy    Desplegar a Google Cloud después de validar"
    echo ""
    echo "Variables de entorno requeridas:"
    echo "  USERS_BACKEND_URL    URL del servicio de usuarios"
    echo "  ORDERS_BACKEND_URL   URL del servicio de órdenes"
    echo "  GATEWAY_API_NAME     Nombre de la API en Google Cloud API Gateway"
    echo ""
    echo "Ejemplos:"
    echo "  $0 dev                           # Generar para desarrollo"
    echo "  $0 prod --validate               # Generar para producción y validar"
    echo "  $0 prod --validate --deploy      # Generar, validar y desplegar"
}

# Valores por defecto
ENVIRONMENT="dev"
VALIDATE=false
DEPLOY=false

# Parsear argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        dev|development)
            ENVIRONMENT="dev"
            shift
            ;;
        prod|production)
            ENVIRONMENT="prod"
            shift
            ;;
        --validate)
            VALIDATE=true
            shift
            ;;
        --deploy)
            DEPLOY=true
            VALIDATE=true  # Deploy implica validate
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo "Opción desconocida: $1"
            show_help
            exit 1
            ;;
    esac
done

# Cargar variables de entorno si existe el archivo
ENV_FILE="$WORKSPACE_ROOT/.env.$ENVIRONMENT"
if [[ -f "$ENV_FILE" ]]; then
    echo "📁 Cargando variables de entorno desde $ENV_FILE"
    set -a  # Export all variables
    source "$ENV_FILE"
    set +a
else
    echo "⚠️  Archivo de entorno no encontrado: $ENV_FILE"
    echo "   Puedes copiar desde .env.$ENVIRONMENT.example"
fi

# Verificar dependencias
echo "🔍 Verificando dependencias..."

# Verificar ts-node
if ! command -v ts-node &> /dev/null; then
    echo "❌ ts-node no está instalado. Instálalo con: npm install -g ts-node"
    exit 1
fi

# Verificar variables de entorno requeridas
MISSING_VARS=()
if [[ -z "$USERS_BACKEND_URL" ]]; then
    MISSING_VARS+=("USERS_BACKEND_URL")
fi
if [[ -z "$ORDERS_BACKEND_URL" ]]; then
    MISSING_VARS+=("ORDERS_BACKEND_URL")
fi
if [[ -z "$GATEWAY_API_NAME" ]]; then
    MISSING_VARS+=("GATEWAY_API_NAME")
fi

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    echo "❌ Faltan las siguientes variables de entorno:"
    printf '   - %s\n' "${MISSING_VARS[@]}"
    exit 1
fi

# Cambiar al directorio del workspace
cd "$WORKSPACE_ROOT"

# Compilar librerías de dominio necesarias
echo "🔧 Compilando librerías de dominio..."
nx build users-domain orders-domain

# Generar especificación
echo "🚀 Ejecutando el generador..."

node_modules/.bin/ts-node --project tools/openapi/tsconfig.json tools/openapi/src/index.ts

# Validar si se solicitó
if [[ "$VALIDATE" == true ]]; then
    echo "✅ Validando especificación..."
    
    OUTPUT_FILE="$OPENAPI_OUTPUT_FILE"
    
    # Verificar swagger-codegen
    if command -v swagger-codegen &> /dev/null; then
        swagger-codegen validate -i "$OUTPUT_FILE"
        echo "✅ Especificación válida"
    else
        echo "⚠️  swagger-codegen no está disponible, saltando validación"
        echo "   Instálalo desde: https://swagger.io/tools/swagger-codegen/"
    fi
fi

# Desplegar si se solicitó
if [[ "$DEPLOY" == true ]]; then
    echo "🚀 Desplegando a Google Cloud..."
    
    # Verificar gcloud CLI
    if ! command -v gcloud &> /dev/null; then
        echo "❌ gcloud CLI no está instalado"
        echo "   Instálalo desde: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    # Verificar autenticación
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        echo "❌ No hay cuentas autenticadas en gcloud"
        echo "   Ejecuta: gcloud auth login"
        exit 1
    fi
    
    OUTPUT_FILE="$OPENAPI_OUTPUT_FILE"
    CONFIG_ID="config-$(date +%s)"
    API_ID="$GATEWAY_API_NAME"
    
    echo "   API ID: $API_ID"
    echo "   Config ID: $CONFIG_ID"
    echo "   Archivo: $OUTPUT_FILE"
    
    gcloud api-gateway api-configs create "$CONFIG_ID" \
        --api="$API_ID" \
        --openapi-spec="$OUTPUT_FILE"
    
    echo "✅ Despliegue completado"
fi

echo ""
echo "🎉 ¡Proceso completado exitosamente!"