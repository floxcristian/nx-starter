# Herramienta de Generación de OpenAPI

Este directorio contiene una herramienta para generar especificaciones OpenAPI v2 (Swagger) para Google Cloud API Gateway. Realiza un análisis estático de un monorepo de Nx para descubrir APIs de NestJS, analizar sus controladores y DTOs, y generar una especificación OpenAPI unificada.

## ✨ Características Principales

- ✅ **Análisis Estático del AST**: Utiliza el compilador de TypeScript (`ts.Program` y `TypeChecker`) para analizar el código fuente sin necesidad de ejecutar las aplicaciones.
- ✅ **Descubrimiento Basado en Grafo de Nx**: Ejecuta `nx graph` para obtener una vista completa del workspace, descubriendo proyectos y sus dependencias de forma eficiente.
- ✅ **Descubrimiento por Tags**: Identifica las APIs a incluir buscando el tag `scope:gcp-gateway` en los `project.json`.
- ✅ **Generación de Schemas a partir de DTOs**: Analiza los DTOs (Data Transfer Objects) utilizados en los decoradores `@Body()` y `@ApiResponse()` para generar automáticamente los schemas correspondientes.
- ✅ **Conversión a Swagger 2.0**: Convierte la especificación final a Swagger 2.0, el formato requerido por Google Cloud API Gateway.
- ✅ **Mejoras para Google Cloud**: Añade automáticamente las extensiones `x-google-*` necesarias para la configuración del backend y la seguridad.

## 🏗️ Arquitectura Interna

El generador sigue un flujo de ejecución modular:

```
tools/openapi/src/
├── index.ts                      # Orquestador principal del proceso.
├── types/                        # Interfaces y tipos de TypeScript centralizados.
├── validators/
│   └── config-validator.ts       # Valida las variables de entorno y construye la configuración.
├── services/
│   ├── nx-workspace-discovery.ts # Lógica para descubrir proyectos usando el grafo de Nx.
│   ├── controller-analyzer.ts    # Analizador estático que usa el TypeChecker de TS para analizar controladores y DTOs.
│   ├── openapi-generator.ts      # Ensambla las especificaciones individuales en un único documento.
│   └── google-cloud-enhancer.ts  # Añade las extensiones específicas de Google Cloud.
└── utils/                        # Utilidades para logging y manejo de archivos.
```

### Flujo de Ejecución

1.  **Validación de Configuración**: `config-validator.ts` lee y valida las variables de entorno.
2.  **Descubrimiento del Workspace**: `nx-workspace-discovery.ts` ejecuta `nx graph`, lo parsea y encuentra todos los proyectos con el tag `scope:gcp-gateway`.
3.  **Análisis de Controladores y DTOs**: Para cada proyecto, `controller-analyzer.ts` recorre el AST, extrae rutas, métodos, y usa el `TypeChecker` para analizar los DTOs en `@Body()` y `@ApiResponse()`, generando un mapa de `schemas`.
4.  **Generación y Conversión**: `openapi-generator.ts` combina todo en una especificación OpenAPI 3.0, que luego se convierte a Swagger 2.0.
5.  **Mejora para GCP**: `google-cloud-enhancer.ts` añade las extensiones `x-google-*`.
6.  **Escritura**: El `openapi.yaml` final se escribe en el disco.

## 🚀 Uso

La herramienta se ejecuta a través de los scripts de `npm` definidos en el `package.json` raíz.

### Comandos de Alto Nivel (Recomendados)

| Comando                | Descripción                    |
| ---------------------- | ------------------------------ |
| `npm run gateway:dev`  | Flujo completo para desarrollo (Genera + Despliega + Crea) |
| `npm run gateway:prod` | Flujo completo para producción (Genera + Despliega + Crea) |

### Comandos Granulares (Para Debugging)

| Comando                        | Descripción                               |
| ------------------------------ | ----------------------------------------- |
| `npm run openapi:generate:dev` | Solo genera el archivo `openapi.yaml`     |
| `npm run gateway:deploy:dev`   | Solo despliega la config en GCP           |
| `npm run gateway:create:dev`   | Solo crea/actualiza el gateway con la última config |

## ⚙️ Configuración

Utiliza archivos `.env.{environment}` en la raíz del workspace.

### Variables de Entorno Requeridas

- **URLs de servicios**: Debes tener una variable por cada API que quieras exponer, siguiendo el patrón `{NOMBRE_API}_BACKEND_URL`.
  ```bash
  # .env.dev
  USERS_BACKEND_URL=https://api-users-dev.example.com
  ORDERS_DETAIL_BACKEND_URL=https://api-orders-detail-dev.example.com
  ```
- **`GCP_PROJECT_ID`**: ID del proyecto de Google Cloud.
- **`GATEWAY_API_NAME`**: Nombre base para el API en Google Cloud (ej: `mi-empresa-api`).
- **`GATEWAY_TITLE`**: Título para la especificación OpenAPI.
- **`ENVIRONMENT`**: Entorno actual (`dev` o `prod`).

### Variables Opcionales

- `OPENAPI_OUTPUT_FILE`: Nombre del archivo de salida (default: `openapi-gateway.yaml`).
- `BACKEND_PROTOCOL`: Protocolo hacia el backend (default: `https`).

## 🛠️ Cómo Funciona el Análisis

### Auto-Discovery

Para que un servicio sea descubierto automáticamente, debe cumplir dos condiciones:

1.  **Tener el Tag correcto**: El `project.json` de la app debe incluir `"tags": ["scope:gcp-gateway"]`.
2.  **Tener una URL definida**: Debe existir una variable de entorno `{NOMBRE_API}_BACKEND_URL` en el archivo `.env` correspondiente.

### Análisis de DTOs (La Clave del Sistema)

El `controller-analyzer.ts` es el núcleo de la generación de schemas.

- **`generateSchemaForType`**: Esta función recursiva recibe un tipo (`ts.Type`) del `TypeChecker` de TypeScript.
- **Inspección de Propiedades**: Itera sobre las propiedades de una clase DTO.
- **Manejo de Tipos**: Determina si cada propiedad es `string`, `number`, un array, u otro DTO anidado.
- **Generación de `$ref`**: El resultado es un conjunto de `definitions` y referencias (`$ref`) a ellas, lo que mantiene la especificación limpia y reutilizable.

Para que esto funcione, es **fundamental** que especifiques el tipo de tus DTOs en los decoradores:

```typescript
@Post()
@ApiResponse({ 
  status: 201, 
  type: CreateItemDto // <-- ¡CRÍTICO para el schema de respuesta!
})
async create(@Body() dto: CreateItemDto) { // <-- CRÍTICO para el schema de petición
  // ...
}
```

## 🐛 Troubleshooting

#### **Mi API no aparece en el `openapi.yaml` generado.**

1.  **Verifica el Tag**: ¿Has añadido `"tags": ["scope:gcp-gateway"]` al `project.json` de tu API?
2.  **Verifica la URL**: ¿Has definido la variable `*_BACKEND_URL` correspondiente en tu archivo `.env`?

#### **El `body` de mi petición o la respuesta aparece como un objeto vacío `{}`.**

1.  **Verifica el `@Body()`**: ¿Tu método del controlador tiene un parámetro decorado con `@Body()` y su tipo es una clase DTO (ej. `@Body() dto: MiDto`)?
2.  **Verifica el `@ApiResponse()`**: ¿Has añadido la propiedad `type: MiDtoDeRespuesta` al decorador `@ApiResponse`?
3.  **Verifica la importación**: ¿El DTO está correctamente importado en el archivo del controlador?

#### **Error: "No se encontraron servicios API configurados"**

- **Solución**: Revisa que las variables `*_BACKEND_URL` estén definidas en el archivo `.env` correcto y que los nombres coincidan con los proyectos `api-*`.
