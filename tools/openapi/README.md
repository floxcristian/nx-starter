# 🌐 OpenAPI Tools con Auto-Discovery

Este directorio contiene herramientas inteligentes para generar y gestionar especificaciones OpenAPI para Google Cloud API Gateway.

## 🚀 Scripts Disponibles

### generate-openapi.ts

Script principal con **auto-discovery** que:

- ✨ **Detecta automáticamente** todos los microservicios del monorepo
- 🏗️ **Extrae configuración real** de Swagger desde código NestJS
- 🔄 **Convierte automáticamente** OpenAPI 3.0 → Swagger 2.0
- ☁️ **Optimiza para Google Cloud** API Gateway

## Uso con Nx

### Comandos disponibles:

```bash
# Generar especificación OpenAPI para DESARROLLO (por defecto)
nx run openapi-tools:generate

# Generar para desarrollo (explícito)
nx run openapi-tools:generate:development

# Generar para producción
nx run openapi-tools:generate:production

# Validar especificación generada
nx run openapi-tools:validate

# Desplegar a Google Cloud
nx run openapi-tools:deploy
```

**⚠️ Importante:** El comando `nx run openapi-tools:generate` sin configuración específica genera para **desarrollo** por defecto. Para producción, usa siempre `nx run openapi-tools:generate:production`.

## 🎓 ¿Por qué usar Nx en lugar de Scripts de NPM?

### 📋 Contexto: ¿Qué es project.json?

El archivo `project.json` es la **configuración de proyecto** en Nx que define:

- **Targets/Tareas**: Comandos ejecutables (`generate`, `validate`, `deploy`)
- **Executors**: Cómo ejecutar cada tarea
- **Dependencias**: Qué tareas deben ejecutarse antes que otras
- **Configuraciones**: Variantes de la misma tarea (dev/prod)
- **Outputs**: Qué archivos genera cada tarea (para caché)

### 🚀 Ventajas de Comandos Nx vs Scripts de NPM/PNPM

#### 1. **📈 Gestión Automática de Dependencias**

**Con Nx:**

```bash
nx run openapi-tools:deploy
# ✅ Automáticamente ejecuta: generate → validate → deploy
```

**Con pnpm (manual):**

```bash
pnpm run openapi:generate
pnpm run openapi:validate
pnpm run gateway:deploy
# ❌ Tienes que recordar ejecutar los 3 comandos en orden correcto
```

#### 2. **💾 Sistema de Caché Inteligente**

```bash
# Primera ejecución
nx run openapi-tools:generate  # ⏱️ Toma 5 segundos

# Segunda ejecución (sin cambios en código)
nx run openapi-tools:generate  # ⚡ Usa caché - toma 0.1 segundos
```

Con scripts normales, **siempre se ejecuta todo** aunque no haya cambios.

#### 3. **🎯 Configuraciones por Entorno**

**Una sola tarea con múltiples configuraciones:**

```bash
nx run openapi-tools:generate:development  # Para desarrollo
nx run openapi-tools:generate:production   # Para producción
```

**vs Scripts separados:**

```json
{
  "openapi:generate:dev": "bash script.sh dev",
  "openapi:generate:prod": "bash script.sh prod"
}
```

#### 4. **📊 Análisis y Visualización**

```bash
# Ver el gráfico de dependencias del proyecto
nx graph

# Ejecutar solo lo que cambió desde la última vez
nx affected --target=build --base=origin/main
```

#### 5. **🏷️ Organización con Tags**

```json
"tags": ["scope:tools", "type:util"]
```

Permite ejecutar comandos por categorías:

```bash
# Solo herramientas
nx run-many --target=lint --projects=tag:scope:tools
```

### 📊 Comparación Rápida

| Característica                | **Nx Commands**              | **Scripts NPM**         |
| ----------------------------- | ---------------------------- | ----------------------- |
| **Dependencias automáticas**  | ✅ `dependsOn: ["generate"]` | ❌ Manual               |
| **Caché inteligente**         | ✅ Automático                | ❌ No                   |
| **Configuraciones**           | ✅ `generate:production`     | ❌ Scripts separados    |
| **Solo ejecuta lo necesario** | ✅ Affected detection        | ❌ Ejecuta todo siempre |
| **Visualización**             | ✅ `nx graph`                | ❌ No                   |
| **Simplicidad inicial**       | ❌ Más setup                 | ✅ Más directo          |

### 💡 **¿Cuándo usar cada uno?**

#### **Usa Nx cuando:** (Nuestro caso ✅)

- 🏗️ Monorepo con múltiples proyectos
- 🔗 Las tareas tienen dependencias entre sí
- ⚡ Quieres optimización y caché
- 👥 Trabajas en equipo

#### **Usa scripts NPM cuando:**

- 📦 Proyecto simple o standalone
- 🚀 Quieres máxima simplicidad
- 📱 Prototipado rápido

### 🎯 **En nuestro proyecto:**

Nx es ideal porque tenemos un **monorepo** donde:

- `validate` **depende** de `generate`
- `deploy` **depende** de `validate`
- El caché evita regenerar OpenAPI innecesariamente
- Solo se ejecuta lo que realmente cambió

### Uso directo con npm scripts:

```bash
# Generar especificación
npm run openapi:generate

# Validar especificación
npm run openapi:validate

# Desplegar a Google Cloud
npm run gateway:deploy
```

## Configuración

### Variables de entorno requeridas:

- `USERS_BACKEND_URL`: URL del servicio de usuarios
- `ORDERS_BACKEND_URL`: URL del servicio de órdenes

### Variables de entorno requeridas:

- `GOOGLE_CLOUD_PROJECT`: ID del proyecto de Google Cloud (REQUERIDO para deployment y Firebase Auth)

### Variables de entorno opcionales:

- `OPENAPI_OUTPUT_FILE`: Archivo de salida personalizado
- `GATEWAY_TITLE`: Título del gateway personalizado
- `GATEWAY_DESCRIPTION`: Descripción del gateway personalizada
- `GATEWAY_VERSION`: Versión del gateway personalizada
- `BACKEND_PROTOCOL`: Protocolo de backend (default: https)

### Argumentos CLI disponibles:

- `--output <file>`: Archivo de salida
- `--title <title>`: Título del gateway
- `--description <desc>`: Descripción del gateway
- `--version <version>`: Versión del gateway
- `--protocol <protocol>`: Protocolo de backend
- `--project-id <id>`: ID del proyecto de Google Cloud
- `--help`: Mostrar ayuda

## Características

### Configuración para Google Cloud API Gateway

- ✅ Configuración de métricas y quotas
- ✅ Esquemas de seguridad (API Key, Google OAuth, Firebase Auth)
- ✅ Configuración de backends por servicio
- ✅ Configuración de CORS
- ✅ Path translation automática

### Validación y seguridad

- ✅ Validación de variables de entorno
- ✅ Manejo robusto de errores
- ✅ Type safety completo
- ✅ Logging detallado

### Flexibilidad y Automatización

- ✅ **Auto-discovery de servicios** - No necesitas editar código para añadir APIs
- ✅ **Carga dinámica de módulos** - Importa módulos NestJS en runtime
- ✅ **Extracción real de Swagger** - Usa configuración real de tus APIs (no mock)
- ✅ **Conversión automática** - OpenAPI 3.0 → Swagger 2.0 con api-spec-converter
- ✅ Configuración via CLI y variables de entorno
- ✅ Integración con Nx workspace
- ✅ Soporte para múltiples entornos

## ✨ Añadir nuevos servicios (Auto-Discovery)

El sistema usa **auto-discovery**, por lo que **NO necesitas editar código** para añadir nuevos servicios. Simplemente:

### 1. **Crear la app NestJS**

```bash
nx generate @nx/nest:app api-nuevo-servicio
```

### 2. **Añadir variable de entorno**

```bash
# En .env.dev o .env.prod
NUEVO_SERVICIO_BACKEND_URL=https://api-nuevo-servicio-xxx.run.app/api
```

### 3. **¡Eso es todo!** 🎉

```bash
npm run gateway:dev
# ✅ El nuevo servicio se detecta automáticamente
```

### 🔍 **Cómo funciona el Auto-Discovery:**

El sistema busca automáticamente:

1. **Variables de entorno** que terminen en `_BACKEND_URL`
2. **Apps correspondientes** en `apps/api-{nombre}/`
3. **Módulos** en `apps/api-{nombre}/src/app/app.module.ts`

### 📋 **Ejemplo de detección automática:**

```
Variable: PAYMENTS_BACKEND_URL=https://...
         ↓ (detecta "PAYMENTS")
App:     apps/api-payments/src/app/app.module.ts
         ↓ (genera automáticamente)
Path:    /payments
Title:   Payments API
```

### ⚠️ **Requisitos para que funcione:**

- ✅ Variable termine en `_BACKEND_URL`
- ✅ App existe en `apps/api-{nombre}/`
- ✅ Módulo existe en `src/app/app.module.ts`
- ✅ App tiene configuración de Swagger

## 🚀 Deployment a Google Cloud

### Configuración inicial (una sola vez):

```bash
npm run gcp:setup
```

### Deployment completo:

#### Para desarrollo:

```bash
npm run gateway:dev
# ✅ Genera + Despliega + Crea gateway automáticamente
```

#### Para producción:

```bash
npm run gateway:prod
# ✅ Flujo completo para producción
```

### Variables requeridas:

```bash
# APIs de tus servicios (detección automática)
export USERS_BACKEND_URL=https://users-api.example.com
export ORDERS_BACKEND_URL=https://orders-api.example.com

# Google Cloud (REQUERIDAS)
# Variables REQUERIDAS para Google Cloud
export GOOGLE_CLOUD_PROJECT=mi-proyecto-id
```

### Comandos granulares (para debugging):

```bash
# Solo generar spec
nx run openapi-tools:generate:production

# Solo validar
nx run openapi-tools:validate

# Solo desplegar
nx run openapi-tools:deploy
```
