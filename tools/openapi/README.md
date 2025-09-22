# OpenAPI Tools

Genera especificaciones OpenAPI para Google Cloud API Gateway con auto-discovery de servicios NestJS y análisis estático de controladores.

## Arquitectura

```
tools/openapi/src/
├── index.ts                      # Orquestador principal
├── types/index.ts               # Interfaces TypeScript centralizadas
├── validators/
│   └── config-validator.ts      # Validación y configuración del gateway
├── services/
│   ├── controller-analyzer.ts   # Análisis estático de controladores TypeScript
│   ├── nx-workspace-discovery.ts # Auto-discovery basado en workspace Nx
│   ├── openapi-generator.ts     # Generación de especificaciones OpenAPI
│   └── google-cloud-enhancer.ts # Optimización para Google Cloud
└── utils/
    ├── file-utils.ts            # Escritura de archivos
    ├── console-logger.ts        # Logging estructurado
    └── url-utils.ts             # Validación y manejo de URLs
```

**Funcionalidades:**

- **Análisis estático de controladores**: Extrae rutas de archivos TypeScript sin cargar módulos dinámicamente
- **Auto-discovery basado en Nx**: Utiliza la configuración del workspace para descubrir servicios automáticamente
- **Filtrado inteligente**: Ignora automáticamente aplicaciones de test end-to-end (que terminan en `-e2e`)
- **Detección automática de librerías**: Encuentra controladores en librerías
- **Conversión automática**: OpenAPI 3.0 → Swagger 2.0 para compatibilidad con Google Cloud
- **Configuración específica para Google Cloud API Gateway**

**Flujo de ejecución:**
Validación → Descubrimiento Nx → Análisis Estático → Generación → Combinación → Optimización → Escritura

## Uso con Nx

### Comandos Nx disponibles:

```bash
# Generar especificación OpenAPI para desarrollo
nx run openapi-tools:generate:dev

# Generar especificación OpenAPI para producción
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

### Uso directo con pnpm scripts:

```bash
# Generar especificación OpenAPI
pnpm openapi:generate:dev        # Para desarrollo
pnpm openapi:generate:prod       # Para producción

# Desplegar configuración a Google Cloud
pnpm gateway:deploy:dev          # Desarrollo
pnpm gateway:deploy:prod         # Producción

# Crear gateway completo (incluye generación y deploy)
pnpm gateway:create:dev          # Desarrollo
pnpm gateway:create:prod         # Producción

# Flujo completo (generar + desplegar + crear gateway)
pnpm gateway:dev                 # Desarrollo
pnpm gateway:prod                # Producción
```

## Troubleshooting

### No se encuentran controladores

**Problema**: El sistema reporta "0 controladores encontrados" para una librería.

**Soluciones:**

1. Verificar que los archivos terminen en `.controller.ts`
2. Verificar que exista el directorio `src/lib/controllers/`
3. Verificar que los controladores tengan el decorador `@Controller()`

### Rutas no aparecen en el OpenAPI generado

**Problema**: Los controladores se detectan pero las rutas no aparecen.

**Soluciones:**

1. Verificar que los métodos tengan decoradores HTTP (`@Get`, `@Post`, etc.)
2. Verificar que la sintaxis de TypeScript sea correcta
3. Revisar los logs del generador para errores de parsing

### Variables de entorno no se detectan

**Problema**: El servicio no se incluye en la generación.

**Soluciones:**

1. Verificar que la variable siga el patrón `{NOMBRE}_BACKEND_URL`
2. Verificar que exista una aplicación `apps/api-{nombre}/`
3. Verificar que la variable esté definida en el archivo `.env.{environment}`

### Ejemplo de debug

```bash
# Ejecutar con logs detallados
DEBUG=* npm run openapi:generate:dev

# Verificar variables de entorno
echo $USERS_BACKEND_URL
echo $ORDERS_BACKEND_URL

# Verificar estructura del proyecto
ls -la apps/api-*/
ls -la libs/*-domain/src/lib/controllers/
```

## Configuración

### Variables de entorno requeridas:

**URLs de servicios (automáticamente descubiertas):**

- `USERS_BACKEND_URL`: URL del servicio de usuarios
- `ORDERS_BACKEND_URL`: URL del servicio de órdenes
- `{SERVICE}_BACKEND_URL`: Patrón para cualquier nuevo servicio

**Configuración de Google Cloud:**

- `GCP_PROJECT_ID`: ID del proyecto de Google Cloud para deployment
- `GATEWAY_API_NAME`: Nombre de la API en Google Cloud API Gateway (ej: mi-api-gateway)

**Configuración opcional:**

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
ORDERS_DETAIL_BACKEND_URL=https://api-orders-detail-dev.example.com
GATEWAY_API_NAME=mi-api-dev
# ... resto de variables
```

## Auto-Discovery de Servicios

### Sistema Basado en Nx Workspace

El sistema utiliza la configuración del workspace Nx para descubrir automáticamente servicios y sus controladores:

**Para añadir un nuevo servicio:**

1. **Crear app NestJS**: `nx generate @nx/nest:app api-nuevo-servicio`
2. **Crear librería de dominio**: `nx generate @nx/nest:lib nuevo-servicio-domain`
3. **Añadir controladores** en `libs/nuevo-servicio-domain/src/lib/controllers/`
4. **Añadir variable de entorno**: `NUEVO_SERVICIO_BACKEND_URL=https://...` en `.env.dev`
5. **Ejecutar**: `npm run gateway:dev`

### Detección Automática

**Descubrimiento de servicios:**

- Busca aplicaciones que empiecen con `api-*` en el workspace Nx
- **Ignora automáticamente** aplicaciones de test que terminan en `-e2e`
- Busca variables de entorno `*_BACKEND_URL` correspondientes
- Mapea automáticamente URLs a servicios descubiertos

**Análisis de controladores:**

- Escanea todas las librerías que contengan `domain` o empiecen con `core-*`
- Analiza archivos `*.controller.ts`
- Extrae rutas usando análisis estático del AST de TypeScript
- Detecta decoradores `@Controller`, `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`
- Extrae información de Swagger: `@ApiTags`, `@ApiOperation`, `@ApiResponse`

### Estructura Recomendada

```
apps/
├── api-users/                    # Aplicación NestJS
│   └── src/app/app.module.ts    # Importa UsersDomainModule
└── api-orders/                   # Aplicación NestJS
    └── src/app/app.module.ts    # Importa OrdersDomainModule

libs/
├── users-domain/                 # Librería de dominio
│   └── src/lib/controllers/
│       ├── users.controller.ts   # Controlador de usuarios
│       └── auth.controller.ts    # Controlador de autenticación
└── orders-domain/                # Librería de dominio
    └── src/lib/controllers/
        └── orders.controller.ts # Controlador de órdenes
```

**Requisitos:**

- Variable `*_BACKEND_URL` para cada servicio
- Aplicación en `apps/api-{nombre}/`
- Controladores en librerías `*-domain` o `core-*`

## Análisis Estático de Controladores

### Decoradores Soportados

El analizador estático detecta y procesa los siguientes decoradores de NestJS:

**Controladores:**

- `@Controller(path)` - Define el path base del controlador
- `@ApiTags(tag)` - Define el tag para agrupación en Swagger

**Rutas HTTP:**

- `@Get(path?)`, `@Post(path?)`, `@Put(path?)`, `@Delete(path?)`, `@Patch(path?)`
- Extrae parámetros de path (`:id`, `:userId`) automáticamente

**Documentación Swagger:**

- `@ApiOperation({ summary })` - Descripción de la operación
- `@ApiResponse({ status, description })` - Respuestas esperadas

**Parámetros:**

- `@Param()` - Parámetros de path
- `@Body()` - Cuerpo de request (para POST, PUT, PATCH)
- `@Query()` - Parámetros de query

### Ejemplo de Controlador

```typescript
@ApiTags('users')
@Controller('users')
export class UsersController {
  @Post()
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ status: 201, description: 'User created' })
  async create(@Body() dto: CreateUserDto): Promise<UserEntity> {
    // Genera: POST /users
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  async findOne(@Param('id') id: string): Promise<UserEntity> {
    // Genera: GET /users/{id}
  }
}
```

### Resultado del Análisis

Para cada controlador, el sistema extrae:

- **Path base** del controlador
- **Rutas individuales** con método HTTP
- **Parámetros** de path, query y body
- **Documentación** de Swagger
- **Respuestas** esperadas con códigos de estado

## Ventajas del Sistema Actual

### ✅ Análisis Estático vs Carga Dinámica

**Beneficios:**

- **Sin dependencias de runtime**: No requiere cargar módulos NestJS dinámicamente
- **Independiente del entorno**: Funciona sin importar la configuración de la aplicación
- **Más rápido**: No necesita compilar ni ejecutar código de la aplicación
- **Más seguro**: No ejecuta código potencialmente problemático
- **Mejor mantenibilidad**: Sin dependencias de paths hardcodeados

### ✅ Integración con Nx

**Beneficios:**

- **Auto-discovery inteligente**: Utiliza la configuración existente del workspace
- **Detección automática de dependencias**: Encuentra librerías de dominio automáticamente
- **Consistencia**: Sigue las convenciones establecidas de Nx
- **Zero configuration**: Funciona sin configuración adicional si sigues las convenciones

### ✅ Arquitectura Limpia

**Beneficios:**

- **Separación de responsabilidades**: Controladores en librerías de dominio
- **Reutilización**: Las librerías pueden ser compartidas entre aplicaciones
- **Testabilidad**: Cada componente es independiente y testeable
- **Escalabilidad**: Fácil agregar nuevos servicios siguiendo el patrón

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
export GCP_PROJECT_ID=mi-proyecto-id
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
