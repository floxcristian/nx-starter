# OpenAPI Tools

Genera especificaciones OpenAPI para Google Cloud API Gateway con auto-discovery de servicios NestJS.

## Arquitectura

```
tools/openapi/src/
├── index.ts                    # Orquestador principal
├── types/index.ts             # Interfaces TypeScript centralizadas
├── validators/
│   └── config-validator.ts     # Validación y configuración del gateway
├── services/
│   ├── service-discovery.ts    # Auto-discovery de APIs
│   ├── module-loader.ts        # Carga dinámica de módulos NestJS
│   ├── openapi-generator.ts    # Generación desde código real
│   └── google-cloud-enhancer.ts # Optimización para Google Cloud
└── utils/
    ├── file-utils.ts          # Escritura de archivos
    ├── console-logger.ts      # Logging estructurado
    └── url-utils.ts           # Validación y manejo de URLs
```

**Funcionalidades:**

- Auto-discovery de microservicios basado en variables `*_BACKEND_URL`
- Extracción de especificaciones desde código NestJS real
- Conversión automática OpenAPI 3.0 → Swagger 2.0
- Configuración específica para Google Cloud API Gateway

**Flujo de ejecución:**
Validación → Descubrimiento → Carga → Generación → Combinación → Optimización → Escritura

## Uso con Nx

### Comandos Nx disponibles:

```bash
# Generar especificación OpenAPI para desarrollo
nx run openapi-tools:generate:dev

# Generar para producción
nx run openapi-tools:generate:prod

# Desplegar configuración a Google Cloud (desarrollo)
nx run openapi-tools:deploy:dev

# Desplegar configuración a Google Cloud (producción)
nx run openapi-tools:deploy:prod

# Crear gateway completo (desarrollo) - incluye deploy
nx run openapi-tools:gateway:dev

# Crear gateway completo (producción) - incluye deploy
nx run openapi-tools:gateway:prod

# Verificar código con ESLint
nx run openapi-tools:lint
```

### Uso directo con npm scripts:

```bash
# Generar especificación OpenAPI
npm run openapi:generate:dev        # Para desarrollo
npm run openapi:generate:prod       # Para producción

# Desplegar configuración a Google Cloud
npm run gateway:deploy:dev          # Desarrollo
npm run gateway:deploy:prod         # Producción

# Crear gateway completo (incluye generación y deploy)
npm run gateway:create:dev          # Desarrollo
npm run gateway:create:prod         # Producción

# Flujo completo (generar + desplegar + crear gateway)
npm run gateway:dev                 # Desarrollo
npm run gateway:prod                # Producción
```

## Configuración

### Variables de entorno requeridas:

- `USERS_BACKEND_URL`: URL del servicio de usuarios
- `ORDERS_BACKEND_URL`: URL del servicio de órdenes
- `GCLOUD_PROJECT_ID`: ID del proyecto de Google Cloud para deployment
- `GATEWAY_API_NAME`: Nombre de la API en Google Cloud API Gateway (ej: mi-api-gateway)
- `OPENAPI_OUTPUT_FILE`: Archivo de salida personalizado
- `GATEWAY_TITLE`: Título del gateway personalizado
- `GATEWAY_DESCRIPTION`: Descripción del gateway personalizada
- `GATEWAY_VERSION`: Versión del gateway personalizada
- `BACKEND_PROTOCOL`: Protocolo de backend (http/https)
- `RATE_LIMIT_PER_MINUTE`: Límite de requests por minuto (default: 10000, rango: 1-1000000)

### Archivos de configuración:

Utiliza archivos `.env.{environment}` en la raíz del workspace:

```bash
# .env.dev
ENVIRONMENT=dev
USERS_BACKEND_URL=https://api-users-dev.example.com
ORDERS_BACKEND_URL=https://api-orders-dev.example.com
GATEWAY_API_NAME=mi-api-dev
# ... resto de variables
```

## Auto-Discovery de Servicios

Para añadir un nuevo servicio:

1. **Crear app NestJS**: `nx generate @nx/nest:app api-nuevo-servicio`
2. **Añadir variable**: `NUEVO_SERVICIO_BACKEND_URL=https://...` en `.env.dev`
3. **Ejecutar**: `npm run gateway:dev`

**Detección automática:**

- Busca variables `*_BACKEND_URL`
- Mapea a `apps/api-{nombre}/src/app/app.module.ts`
- Genera paths `/nombre` automáticamente

**Requisitos:** Variable `*_BACKEND_URL`, app en `apps/api-{nombre}/`, módulo con Swagger

## Deployment a Google Cloud

### Configuración inicial (una sola vez):

```bash
npm run gcp:setup
```

### Deployment completo:

#### Para desarrollo:

```bash
npm run gateway:dev
```

#### Para producción:

```bash
npm run gateway:prod
```

### Ejemplo de configuración:

```bash
export USERS_BACKEND_URL=https://users-api.example.com
export ORDERS_BACKEND_URL=https://orders-api.example.com
export GCLOUD_PROJECT_ID=mi-proyecto-id
export GATEWAY_API_NAME=mi-empresa-api
export GATEWAY_TITLE="Mi API Gateway"
export BACKEND_PROTOCOL=https
```

### Comandos granulares (para debugging):

```bash
# Solo generar especificación
nx run openapi-tools:generate:dev     # Desarrollo
nx run openapi-tools:generate:prod    # Producción

# Solo desplegar configuración
nx run openapi-tools:deploy:dev       # Desarrollo
nx run openapi-tools:deploy:prod      # Producción

# Solo crear gateway (requiere deploy previo)
nx run openapi-tools:gateway:dev      # Desarrollo
nx run openapi-tools:gateway:prod     # Producción
```
