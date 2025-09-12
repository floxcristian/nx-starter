#!/bin/bash

# ==============================================================================
# 1. CONFIGURACIÓN INICIAL
# ==============================================================================
set -e # Termina el script si un comando falla (mantenemos esto como red de seguridad)

# --- Variables de Entrada (¡ACTUALIZA ESTOS VALORES!) ---
GCP_PROJECT_ID=$(gcloud config get-value project)
GITHUB_REPO="floxcristian/nx-starter"        # Formato: usuario/repositorio
GITHUB_OWNER="floxcristian"                  # El dueño del repositorio (usuario u organización)

# --- Nombres de Recursos (puedes personalizarlos) ---
GCP_REGION="southamerica-west1"
GAR_REPOSITORY="nx-starter"
GCLOUD_SERVICE_ACCOUNT="nx-starter-gha-deployer"

# --- Nombres para Workload Identity Federation (no tocar a menos que sepas lo que haces) ---
GCLOUD_IDENTITY_POOL="github-pool"
GCLOUD_IDENTITY_PROVIDER="github-provider"

# --- Variables Calculadas (no tocar) ---
GCLOUD_SERVICE_ACCOUNT_EMAIL="${GCLOUD_SERVICE_ACCOUNT}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

echo "🚀 Iniciando configuración de CI/CD para:"
echo "   📁 Proyecto: ${GCP_PROJECT_ID}"
echo "   🐙 Repositorio: ${GITHUB_REPO}"
echo "------------------------------------------------------------------"

# ==============================================================================
# 2. OBTENER NÚMERO DE PROYECTO (CRÍTICO PARA IAM)
# ==============================================================================
echo "🔍 Obteniendo el número del proyecto..."
GCP_PROJECT_NUMBER=$(gcloud projects describe ${GCP_PROJECT_ID} --format="value(projectNumber)")
if [ -z "${GCP_PROJECT_NUMBER}" ]; then
    echo "❌ Error obteniendo el número de proyecto. Verifica que el proyecto '${GCP_PROJECT_ID}' existe y tienes permisos."
    exit 1
fi
echo "✅ Número de proyecto obtenido: ${GCP_PROJECT_NUMBER}"
echo "------------------------------------------------------------------"

# ==============================================================================
# 3. HABILITAR APIS NECESARIAS
# ==============================================================================
echo "📡 Habilitando APIs necesarias..."
gcloud services enable \
  iam.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  iamcredentials.googleapis.com \
  --project="${GCP_PROJECT_ID}"
echo "✅ APIs habilitadas"
echo "------------------------------------------------------------------"

# ==============================================================================
# 4. CREAR REPOSITORIO DE ARTIFACT REGISTRY
# ==============================================================================
echo "📦 Verificando repositorio en Artifact Registry..."
if ! gcloud artifacts repositories describe ${GAR_REPOSITORY} --location=${GCP_REGION} --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "   -> Creando repositorio '${GAR_REPOSITORY}'..."
  gcloud artifacts repositories create ${GAR_REPOSITORY} \
    --project="${GCP_PROJECT_ID}" \
    --repository-format=docker \
    --location=${GCP_REGION} \
    --description="Repositorio para imágenes de ${GITHUB_REPO}"
else
  echo "   -> El repositorio '${GAR_REPOSITORY}' ya existe."
fi
echo "✅ Repositorio listo"
echo "------------------------------------------------------------------"

# ==============================================================================
# 5. CREAR CUENTA DE SERVICIO (SERVICE ACCOUNT)
# ==============================================================================
echo "👤 Verificando cuenta de servicio..."
if ! gcloud iam service-accounts describe ${GCLOUD_SERVICE_ACCOUNT_EMAIL} --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "   -> Creando cuenta de servicio '${GCLOUD_SERVICE_ACCOUNT}'..."
  gcloud iam service-accounts create ${GCLOUD_SERVICE_ACCOUNT} \
    --project="${GCP_PROJECT_ID}" \
    --display-name="Deployer para ${GITHUB_REPO}"
else
  echo "   -> La cuenta de servicio '${GCLOUD_SERVICE_ACCOUNT}' ya existe."
fi
echo "✅ Cuenta de servicio lista"
echo "------------------------------------------------------------------"

# ==============================================================================
# 6. ASIGNAR ROLES A LA CUENTA DE SERVICIO
# ==============================================================================
echo "🔐 Asignando roles necesarios a la cuenta de servicio..."
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" --member="serviceAccount:${GCLOUD_SERVICE_ACCOUNT_EMAIL}" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" --member="serviceAccount:${GCLOUD_SERVICE_ACCOUNT_EMAIL}" --role="roles/run.admin"
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" --member="serviceAccount:${GCLOUD_SERVICE_ACCOUNT_EMAIL}" --role="roles/iam.serviceAccountUser"
echo "✅ Roles asignados"
echo "------------------------------------------------------------------"

# ==============================================================================
# 7. CREAR Y CONFIGURAR WORKLOAD IDENTITY FEDERATION
# ==============================================================================
echo "🔗 Configurando Workload Identity Federation..."

# Crear el Pool
if ! gcloud iam workload-identity-pools describe ${GCLOUD_IDENTITY_POOL} --location="global" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "   -> Creando pool '${GCLOUD_IDENTITY_POOL}'..."
  gcloud iam workload-identity-pools create ${GCLOUD_IDENTITY_POOL} \
    --project="${GCP_PROJECT_ID}" \
    --location="global" \
    --display-name="GitHub Actions Auth Pool"
else
  echo "   -> El pool '${GCLOUD_IDENTITY_POOL}' ya existe."
fi

# Crear el Proveedor OIDC con la condición de seguridad
if ! gcloud iam workload-identity-pools providers describe ${GCLOUD_IDENTITY_PROVIDER} --workload-identity-pool=${GCLOUD_IDENTITY_POOL} --location="global" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "   -> Creando proveedor '${GCLOUD_IDENTITY_PROVIDER}'..."
  gcloud iam workload-identity-pools providers create-oidc "${GCLOUD_IDENTITY_PROVIDER}" \
    --project="${GCP_PROJECT_ID}" \
    --workload-identity-pool="${GCLOUD_IDENTITY_POOL}" \
    --location="global" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository_owner == '${GITHUB_OWNER}'"
else
    echo "   -> El proveedor '${GCLOUD_IDENTITY_PROVIDER}' ya existe."
fi

# Vincular la SA con el proveedor de WIF
MEMBER="principalSet://iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCLOUD_IDENTITY_POOL}/attribute.repository/${GITHUB_REPO}"
gcloud iam service-accounts add-iam-policy-binding ${GCLOUD_SERVICE_ACCOUNT_EMAIL} \
  --project="${GCP_PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="${MEMBER}"
echo "✅ Workload Identity Federation configurado"
echo "------------------------------------------------------------------"

# ==============================================================================
# 8. OBTENER VALORES FINALES Y MOSTRAR
# ==============================================================================
echo "📋 Obteniendo valores finales para GitHub..."
PROVIDER_FULL_NAME=$(gcloud iam workload-identity-pools providers describe "${GCLOUD_IDENTITY_PROVIDER}" \
  --project="${GCP_PROJECT_ID}" \
  --workload-identity-pool="${GCLOUD_IDENTITY_POOL}" \
  --location="global" \
  --format="value(name)")

echo ""
echo "🎉 ¡CONFIGURACIÓN COMPLETADA! 🎉"
echo ""
echo "Añade estos valores a tu repositorio de GitHub en 'Settings > Secrets and variables > Actions'"
echo ""
echo "--- Pestaña 'Variables' (Datos no sensibles) ---"
echo "GCP_PROJECT_ID: ${GCP_PROJECT_ID}"
echo "GCP_REGION: ${GCP_REGION}"
echo "GAR_REPOSITORY: ${GAR_REPOSITORY}"
echo ""
echo "--- Pestaña 'Secrets' (Datos sensibles) ---"
echo "GCP_SERVICE_ACCOUNT: ${GCLOUD_SERVICE_ACCOUNT_EMAIL}"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER: ${PROVIDER_FULL_NAME}"
echo ""
echo "✅ ¡Setup completo!"