/**
 * @fileoverview Generador de especificaciones OpenAPI para Google Cloud API Gateway
 *
 * Este generador extrae configuración REAL de Swagger desde aplicaciones NestJS,
 * combina múltiples servicios en una especificación unificada y la optimiza
 * para funcionar con Google Cloud API Gateway.
 *
 * CARACTERÍSTICAS PRINCIPALES:
 * - ✅ Auto-discovery de servicios vía variables de entorno
 * - ✅ Extracción real de OpenAPI desde código NestJS
 * - ✅ Conversión automática OpenAPI 3.0 → Swagger 2.0
 * - ✅ Configuración optimizada para Google Cloud
 * - ✅ Validación robusta con Joi
 * - ✅ Logging estructurado y mensajes útiles
 *
 * ESTRUCTURA DEL CÓDIGO:
 * 1. 📋 TIPOS Y INTERFACES - Definiciones TypeScript centralizadas
 * 2. 🔍 VALIDACIÓN - Esquemas Joi para entorno y configuración
 * 3. 🚀 DESCUBRIMIENTO - Auto-discovery de servicios API
 * 4. 📦 CARGA DE MÓDULOS - Importación dinámica de módulos NestJS
 * 5. ⚙️  GENERACIÓN OPENAPI - Extracción desde código real
 * 6. ☁️  GOOGLE CLOUD - Optimizaciones específicas
 * 7. 💾 UTILIDADES - Funciones auxiliares
 * 8. 🎯 ORQUESTADOR PRINCIPAL - Función main que coordina todo
 *
 * @author Equipo de Desarrollo
 * @version 2.0.0 (Refactorizado y documentado)
 * @since 2025-09-17
 */

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { OpenAPIV3 } from 'openapi-types';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import * as Joi from 'joi';
const Converter = require('api-spec-converter');

// ================================================================================================
// 📋 SECCIÓN 1: TIPOS Y INTERFACES
// ================================================================================================
/**
 * Representa un módulo de servicio NestJS que puede ser instanciado
 * para la generación de documentación OpenAPI.
 */
interface ServiceModule {
  /** Constructor del módulo */
  new (...args: unknown[]): unknown;
  /** Nombre del módulo para identificación */
  name: string;
}

/**
 * Error que puede ocurrir durante la conversión de OpenAPI 3.0 a Swagger 2.0
 */
interface ConversionError {
  /** Mensaje descriptivo del error */
  message?: string;
}

/**
 * Resultado de la conversión de especificación OpenAPI
 */
interface ConversionResult {
  /** Especificación resultante en formato Swagger 2.0 */
  spec: SwaggerV2Document;
  /** Lista de errores o advertencias durante la conversión */
  errors?: ConversionError[];
}

/**
 * Documento OpenAPI en formato Swagger 2.0 compatible con Google Cloud API Gateway
 */
interface SwaggerV2Document {
  /** Versión de la especificación Swagger */
  swagger: string;
  /** Información básica de la API */
  info: {
    /** Título de la API */
    title: string;
    /** Descripción opcional de la API */
    description?: string;
    /** Versión de la API */
    version: string;
    /** Propiedades adicionales para Google Cloud */
    [key: string]: unknown;
  };
  /** Paths y operaciones de la API */
  paths?: Record<string, Record<string, unknown>>;
  /** Definiciones de modelos de datos */
  definitions?: Record<string, unknown>;
  /** Definiciones de esquemas de seguridad */
  securityDefinitions?: Record<string, SecurityDefinition>;
  /** Configuración de seguridad global */
  security?: Array<Record<string, string[]>>;
  /** Propiedades adicionales */
  [key: string]: unknown;
}

/**
 * Definición de un esquema de seguridad para autenticación
 */
interface SecurityDefinition {
  /** Tipo de autenticación (apiKey, oauth2, etc.) */
  type: string;
  /** Nombre del parámetro (para apiKey) */
  name?: string;
  /** Ubicación del parámetro (query, header, etc.) */
  in?: string;
  /** URL de autorización (para oauth2) */
  authorizationUrl?: string;
  /** Flujo de autorización (para oauth2) */
  flow?: string;
  /** Propiedades adicionales específicas de Google Cloud */
  [key: string]: unknown;
}

/**
 * Configuración de un servicio API individual
 */
interface ServiceConfig {
  /** Nombre identificador del servicio */
  name: string;
  /** Módulo NestJS del servicio (cargado dinámicamente) */
  module: ServiceModule | null;
  /** Variable de entorno que contiene la URL del servicio */
  urlEnvVar: string;
  /** Prefijo de path para las rutas del servicio */
  pathPrefix: string;
  /** Título legible del servicio */
  title: string;
}

/**
 * Configuración principal del generador OpenAPI
 */
interface Config {
  /** Nombre del archivo de salida */
  outputFile: string;
  /** Título del gateway API */
  gatewayTitle: string;
  /** Descripción del gateway API */
  gatewayDescription: string;
  /** Versión del gateway (formato semver) */
  gatewayVersion: string;
  /** Protocolo de comunicación con los backends */
  protocol: string;
  /** ID del proyecto de Google Cloud */
  projectId: string;
}

// ================================================================================================
// 🚀 SECCIÓN 3: DESCUBRIMIENTO AUTOMÁTICO DE SERVICIOS
// ================================================================================================

/**
 * Descubre automáticamente los servicios API disponibles en el workspace
 *
 * Busca variables de entorno que terminen en '_BACKEND_URL' y verifica
 * que existan las aplicaciones correspondientes en el filesystem.
 *
 * @returns Array de configuraciones de servicios descubiertos
 *
 * @example
 * ```typescript
 * // Con USERS_BACKEND_URL=https://api.example.com/users
 * // y apps/api-users/ existente
 * const services = discoverServices();
 * console.log(services[0].name); // 'users'
 * ```
 *
 * @throws {Error} Si no se encuentran servicios configurados
 */
function discoverServices(): ServiceConfig[] {
  console.log('🔍 Auto-descubriendo servicios API...');

  const services: ServiceConfig[] = [];
  const envVars = process.env;

  // Buscar todas las variables que terminen en _BACKEND_URL
  const backendUrlPattern = /^(.+)_BACKEND_URL$/;

  Object.keys(envVars).forEach((envKey) => {
    const match = envKey.match(backendUrlPattern);
    if (match && envVars[envKey]) {
      const serviceName = match[1].toLowerCase();

      // Solo incluir servicios que tengan una app correspondiente
      const appPath = `apps/api-${serviceName}`;
      const appModulePath = `${appPath}/src/app/app.module.ts`;

      try {
        const fs = require('fs');
        if (fs.existsSync(appModulePath)) {
          services.push({
            name: serviceName,
            module: null,
            urlEnvVar: envKey,
            pathPrefix: `/${serviceName}`,
            title: `${
              serviceName.charAt(0).toUpperCase() + serviceName.slice(1)
            } API`,
          });
          console.log(`   ✅ ${serviceName}: ${envVars[envKey]}`);
        } else {
          console.log(`   ⚠️  ${serviceName}: App no encontrada en ${appPath}`);
        }
      } catch (error) {
        console.log(
          `   ❌ ${serviceName}: Error verificando app - ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  });

  if (services.length === 0) {
    console.error('❌ No se encontraron servicios API configurados.');
    console.error('💡 Para que el auto-discovery funcione, necesitas:');
    console.error(
      '   1. Apps que empiecen con "api-" en apps/ (ej: apps/api-users)'
    );
    console.error(
      '   2. Variables de entorno *_BACKEND_URL (ej: USERS_BACKEND_URL)'
    );
    console.error('   3. Módulo app.module.ts en src/app/ de cada API');
    process.exit(1);
  }

  return services;
}

// Obtener servicios dinámicamente
const SERVICES = discoverServices();

// ================================================================================================
// 🔍 SECCIÓN 2: VALIDACIÓN CON JOI
// ================================================================================================
/**
 * Esquema de validación para la configuración principal del generador
 *
 * Define las reglas de validación para todos los parámetros de configuración,
 * incluyendo valores por defecto y patrones requeridos.
 */
const configSchema = Joi.object({
  outputFile: Joi.string().min(1).default('openapi-gateway.yaml'),
  gatewayTitle: Joi.string().min(1).default('Monorepo API Gateway'),
  gatewayDescription: Joi.string()
    .min(1)
    .default('Gateway principal que unifica todos los microservicios.'),
  gatewayVersion: Joi.string()
    .pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/)
    .default('1.0.0'),
  protocol: Joi.string().valid('http', 'https').default('https'),
  projectId: Joi.string().min(1).required(),
});

/**
 * Esquema de validación para variables de entorno básicas del sistema
 *
 * Valida las variables de entorno requeridas y opcionales,
 * permitiendo variables adicionales no especificadas.
 */
const environmentSchema = Joi.object({
  // Variables dinámicas de servicios (se validan por separado)
  GOOGLE_CLOUD_PROJECT: Joi.string().min(1).required(),
  OPENAPI_OUTPUT_FILE: Joi.string().optional(),
  GATEWAY_TITLE: Joi.string().optional(),
  GATEWAY_DESCRIPTION: Joi.string().optional(),
  GATEWAY_VERSION: Joi.string().optional(),
  BACKEND_PROTOCOL: Joi.string().valid('http', 'https').optional(),
}).unknown(true); // Permitir otras variables de entorno

/**
 * Valida las variables de entorno básicas del sistema
 *
 * Verifica que todas las variables de entorno requeridas estén presentes
 * y tengan valores válidos según el esquema definido.
 *
 * @example
 * ```typescript
 * try {
 *   validateEnvironment();
 *   console.log('✅ Variables de entorno válidas');
 * } catch (error) {
 *   console.error('❌ Error:', error.message);
 * }
 * ```
 *
 * @throws {Error} Si las variables de entorno no son válidas
 */
function validateEnvironment(): void {
  console.log('🔍 Validando variables de entorno...');

  const { error } = environmentSchema.validate(process.env);
  if (error) {
    console.error('❌ Error en variables de entorno:');
    error.details.forEach((detail: Joi.ValidationErrorItem) => {
      console.error(`   - ${detail.message}`);
    });
    console.error('\n💡 Variables requeridas:');
    console.error('   export GOOGLE_CLOUD_PROJECT=tu-proyecto-id');
    process.exit(1);
  }
}

/**
 * Construye la configuración final combinando argumentos CLI, variables de entorno y defaults
 *
 * Procesa los argumentos de línea de comandos, los combina con variables de entorno
 * y aplica validación usando el esquema Joi definido.
 *
 * @returns Configuración validada y completa
 *
 * @example
 * ```typescript
 * const config = getConfig();
 * console.log(`Generando ${config.gatewayTitle} v${config.gatewayVersion}`);
 * ```
 *
 * @throws {Error} Si la configuración no es válida
 */
function getConfig(): Config {
  const args = process.argv.slice(2).reduce((acc, arg, index, arr) => {
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value =
        arr[index + 1] && !arr[index + 1].startsWith('--')
          ? arr[index + 1]
          : true;
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string | boolean>);

  const rawConfig = {
    outputFile: args['output'] || process.env['OPENAPI_OUTPUT_FILE'],
    gatewayTitle: args['title'] || process.env['GATEWAY_TITLE'],
    gatewayDescription:
      args['description'] || process.env['GATEWAY_DESCRIPTION'],
    gatewayVersion: args['version'] || process.env['GATEWAY_VERSION'],
    protocol: args['protocol'] || process.env['BACKEND_PROTOCOL'],
    projectId: args['project-id'] || process.env['GOOGLE_CLOUD_PROJECT'],
  };

  const { error, value } = configSchema.validate(rawConfig);

  if (error) {
    console.error('❌ Error en configuración:');
    error.details.forEach((detail: Joi.ValidationErrorItem) => {
      console.error(`   - ${detail.message}`);
    });
    console.error('\n💡 Verifica tus variables de entorno o argumentos CLI');
    process.exit(1);
  }

  return value as Config;
}

// ================================================================================================
// 📦 SECCIÓN 4: CARGA DINÁMICA DE MÓDULOS NESTJS
// ================================================================================================

/**
 * Carga dinámicamente el módulo de una aplicación NestJS
 *
 * Intenta cargar desde diferentes ubicaciones en orden de prioridad:
 * 1. Módulo principal de la app (apps/api-{service}/src/app/app.module)
 * 2. Módulo de dominio (libs/{service}-domain/src/lib/{service}-domain.module)
 *
 * @param serviceName - Nombre del servicio a cargar
 * @returns Promise que resuelve al módulo cargado
 *
 * @example
 * ```typescript
 * try {
 *   const module = await loadAppModule('users');
 *   console.log(`Módulo cargado: ${module.name}`);
 * } catch (error) {
 *   console.error('Error cargando módulo:', error.message);
 * }
 * ```
 *
 * @throws {Error} Si no se puede cargar el módulo desde ninguna ubicación
 */
async function loadAppModule(serviceName: string): Promise<ServiceModule> {
  try {
    // Intentar cargar desde diferentes ubicaciones
    const possiblePaths = [
      // 1. Intentar cargar desde app module (recomendado)
      `../../../apps/api-${serviceName}/src/app/app.module`,
      // 2. Fallback: cargar desde domain module
      `../../../libs/${serviceName}-domain/src/lib/${serviceName}-domain.module`,
    ];

    for (const modulePath of possiblePaths) {
      try {
        console.log(`   📦 Intentando cargar desde: ${modulePath}`);
        const moduleImport = await import(modulePath);

        // Buscar el módulo exportado automáticamente
        const moduleClass =
          moduleImport.AppModule ||
          moduleImport[
            `${
              serviceName.charAt(0).toUpperCase() + serviceName.slice(1)
            }DomainModule`
          ] ||
          moduleImport.default ||
          Object.values(moduleImport).find(
            (exp) =>
              typeof exp === 'function' &&
              exp.name &&
              exp.name.includes('Module')
          );

        if (moduleClass) {
          console.log(`   ✅ Módulo cargado: ${moduleClass.name}`);
          return moduleClass;
        }
      } catch {
        console.log(`   ⚠️  Path no disponible: ${modulePath}`);
        continue;
      }
    }

    throw new Error(
      `No se pudo cargar módulo para el servicio: ${serviceName}`
    );
  } catch (error) {
    console.error(`❌ Error cargando módulo para ${serviceName}:`, error);
    throw error;
  }
}

// ================================================================================================
// ⚙️ SECCIÓN 5: GENERACIÓN DE ESPECIFICACIONES OPENAPI
// ================================================================================================

/**
 * Genera un documento Swagger/OpenAPI desde un módulo NestJS
 *
 * Crea una aplicación NestJS temporal, configura Swagger y extrae
 * la especificación OpenAPI generada desde el código real.
 *
 * @param appModule - Módulo NestJS a procesar
 * @param title - Título para la documentación
 * @returns Promise que resuelve al documento OpenAPI generado
 *
 * @example
 * ```typescript
 * const UsersModule = await import('./users.module');
 * const doc = await buildSwagger(UsersModule.AppModule, 'Users API');
 * console.log(`Generado documento con ${Object.keys(doc.paths).length} paths`);
 * ```
 *
 * @throws {Error} Si falla la creación de la aplicación o generación del documento
 */
const buildSwagger = async (
  appModule: ServiceModule,
  title: string
): Promise<OpenAPIObject> => {
  console.log(`   🏗️  Creando aplicación NestJS para ${title}...`);
  const app = await NestFactory.create(appModule, {
    logger: false,
    abortOnError: false,
  });

  console.log(`   📋 Configurando Swagger para ${title}...`);
  const config = new DocumentBuilder()
    .setTitle(title)
    .setDescription(`API del servicio ${title}`)
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', bearerFormat: 'JWT' })
    .build();

  console.log(`   📊 Generando documento OpenAPI para ${title}...`);
  const document = SwaggerModule.createDocument(app, config);

  console.log(`   🔧 Cerrando aplicación ${title}...`);
  await app.close();

  return document;
};

/**
 * Valida y obtiene las URLs de todos los servicios descubiertos
 *
 * Verifica que todas las URLs de servicios sean válidas y accesibles,
 * proporcionando mensajes de error útiles y ejemplos cuando fallan.
 *
 * @returns Objeto con las URLs validadas mapeadas por variable de entorno
 *
 * @example
 * ```typescript
 * const validUrls = validateServiceUrls();
 * console.log(validUrls['USERS_BACKEND_URL']); // "https://api.example.com/users"
 * ```
 *
 * @throws {Error} Si alguna URL no es válida
 */
function validateServiceUrls(): Record<string, string> {
  console.log('🔍 Validando URLs de servicios...');

  const envVars: Record<string, string> = {};
  const errors: string[] = [];

  for (const service of SERVICES) {
    const value = process.env[service.urlEnvVar];

    if (!value) {
      errors.push(`${service.urlEnvVar} es requerida`);
      continue;
    }

    // Validar que sea una URL válida
    const urlSchema = Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .required();
    const { error } = urlSchema.validate(value);

    if (error) {
      errors.push(
        `${service.urlEnvVar} debe ser una URL válida (http/https): ${value}`
      );
      continue;
    }

    envVars[service.urlEnvVar] = value;
  }

  if (errors.length > 0) {
    console.error('❌ Errores en URLs de servicios:');
    errors.forEach((error) => {
      console.error(`   - ${error}`);
    });
    console.error('\n💡 Ejemplo de URLs válidas:');
    SERVICES.forEach((service) => {
      console.error(
        `   export ${service.urlEnvVar}=https://api-${service.name}-xxx.run.app/api`
      );
    });
    process.exit(1);
  }

  return envVars;
}

// ================================================================================================
// ☁️ SECCIÓN 6: OPTIMIZACIONES PARA GOOGLE CLOUD API GATEWAY
// ================================================================================================

/**
 * Mejora una especificación Swagger 2.0 con configuraciones específicas de Google Cloud
 *
 * Añade metadatos de gestión, endpoints, esquemas de seguridad y configuración
 * de backends necesarios para el funcionamiento en Google Cloud API Gateway.
 *
 * @param spec - Especificación Swagger 2.0 base
 * @param envVars - URLs validadas de los servicios backend
 * @param config - Configuración del gateway
 * @returns Especificación mejorada para Google Cloud
 *
 * @example
 * ```typescript
 * const enhanced = enhanceSpecForGoogleCloud(baseSpec, serviceUrls, config);
 * console.log('Especificación optimizada para Google Cloud');
 * ```
 */
function enhanceSpecForGoogleCloud(
  spec: SwaggerV2Document,
  envVars: Record<string, string>,
  config: Config
): SwaggerV2Document {
  const enhancedSpec = { ...spec };

  // Configuración de gestión para Google Cloud
  Object.assign(enhancedSpec.info, {
    'x-google-management': {
      metrics: [
        {
          name: 'request_count',
          display_name: 'Request Count',
          value_type: 'INT64',
          metric_kind: 'DELTA',
        },
        {
          name: 'request_latency',
          display_name: 'Request Latency',
          value_type: 'DISTRIBUTION',
          metric_kind: 'DELTA',
        },
      ],
      quota: {
        limits: [
          {
            name: 'RequestsPerMinutePerProject',
            metric: 'request_count',
            unit: '1/min/{project}',
            values: { STANDARD: 10000 },
          },
        ],
      },
    },
    'x-google-endpoints': [
      {
        name: `${config.gatewayTitle
          .toLowerCase()
          .replace(/\s+/g, '-')}-gateway`,
        allowCors: true,
      },
    ],
  });

  // Añadir esquemas de seguridad para Swagger 2.0 (Google Cloud compatible)
  if (!enhancedSpec.securityDefinitions) {
    enhancedSpec.securityDefinitions = {};
  }

  const securitySchemes: Record<string, SecurityDefinition> = {
    // Google Cloud API Gateway solo acepta estos formatos específicos
    api_key: {
      type: 'apiKey',
      name: 'key',
      in: 'query',
    },
    // Alternativa con x-api-key header (también soportada)
    x_api_key: {
      type: 'apiKey',
      name: 'x-api-key',
      in: 'header',
    },
  };

  securitySchemes['firebase_auth'] = {
    type: 'oauth2',
    authorizationUrl: `https://securetoken.google.com/${config.projectId}`,
    flow: 'implicit',
    'x-google-issuer': `https://securetoken.google.com/${config.projectId}`,
    'x-google-jwks_uri':
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    'x-google-audiences': config.projectId,
  };

  Object.assign(enhancedSpec.securityDefinitions, securitySchemes);

  // Añadir seguridad global (todas las operaciones requieren API key por defecto)
  enhancedSpec.security = [{ api_key: [] }, { x_api_key: [] }];

  // Configurar backends para cada path
  const HTTP_METHODS = [
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'options',
    'head',
    'trace',
  ];

  if (enhancedSpec.paths) {
    Object.keys(enhancedSpec.paths).forEach((pathKey) => {
      const pathItem = enhancedSpec.paths?.[
        pathKey
      ] as OpenAPIV3.PathItemObject;

      HTTP_METHODS.forEach((method) => {
        const operation = pathItem[method as keyof OpenAPIV3.PathItemObject];
        if (
          operation &&
          typeof operation === 'object' &&
          !Array.isArray(operation)
        ) {
          const service = SERVICES.find((s) =>
            pathKey.startsWith(s.pathPrefix)
          );
          if (service) {
            Object.assign(operation, {
              'x-google-backend': {
                address: envVars[service.urlEnvVar],
                protocol: config.protocol === 'https' ? 'h2' : 'http/1.1',
                path_translation: 'APPEND_PATH_TO_ADDRESS',
              },
              // Asegurar que cada operación tenga seguridad (API key requerida)
              security: operation.security || [
                { api_key: [] },
                { x_api_key: [] },
              ],
            });
          }
        }
      });
    });
  }

  return enhancedSpec;
}

// ================================================================================================
// 💾 SECCIÓN 7: UTILIDADES DE APOYO
// ================================================================================================

/**
 * Muestra estadísticas de la especificación generada
 *
 * @param filePath - Ruta del archivo generado
 * @param pathCount - Número de paths en la especificación
 * @param definitionCount - Número de definiciones en la especificación
 */
function logSpecificationStats(
  filePath: string,
  pathCount: number,
  definitionCount: number
): void {
  console.log(`✅ Especificación OpenAPI generada con éxito:`);
  console.log(`   📄 Archivo: ${filePath}`);
  console.log(`   📊 Paths: ${pathCount}`);
  console.log(`   🧩 Definitions: ${definitionCount}`);
}

/**
 * Muestra los próximos pasos recomendados después de la generación
 *
 * @param outputFile - Nombre del archivo generado
 */
function logNextSteps(outputFile: string): void {
  const isDev = outputFile.includes('dev');
  const environment = isDev ? 'dev' : 'prod';

  console.log('\n📚 Próximos pasos:');
  console.log(`   Desplegar: npm run gateway:deploy:${environment}`);
  console.log(`   Gateway completo: npm run gateway:${environment}`);
}

// ================================================================================================
// 🎯 SECCIÓN 8: ORQUESTADOR PRINCIPAL
// ================================================================================================

/**
 * Función principal del generador de OpenAPI
 *
 * Orquesta todo el proceso de generación desde el descubrimiento de servicios
 * hasta la escritura del archivo final optimizado para Google Cloud.
 *
 * PROCESO COMPLETO:
 * 1. 🔍 Validación de entorno y configuración
 * 2. 🚀 Descubrimiento de servicios disponibles
 * 3. 📦 Carga dinámica de módulos NestJS
 * 4. ⚙️  Generación de especificaciones desde código real
 * 5. 🔗 Combinación de múltiples servicios
 * 6. 🔄 Conversión OpenAPI 3.0 → Swagger 2.0
 * 7. ☁️  Optimización para Google Cloud API Gateway
 * 8. 💾 Escritura del archivo final
 *
 * @returns Promise que resuelve cuando la generación se completa exitosamente
 *
 * @throws {Error} Si ocurre cualquier error durante el proceso
 */
async function generateSpec() {
  // Validar entorno y configuración
  validateEnvironment();
  const config = getConfig();
  const envVars = validateServiceUrls();

  console.log('📋 Configuración detectada:');
  console.log(`   - Título: ${config.gatewayTitle}`);
  console.log(`   - Versión: ${config.gatewayVersion}`);
  console.log(`   - Archivo de salida: ${config.outputFile}`);
  console.log(`   - Protocolo: ${config.protocol}`);
  console.log(`   - Google Cloud Project: ${config.projectId}`);

  console.log('📡 URLs de servicios:');
  SERVICES.forEach((service) => {
    console.log(`   - ${service.title}: ${envVars[service.urlEnvVar]}`);
  });

  // Cargar módulos dinámicamente
  console.log('📦 Cargando módulos de aplicación...');
  for (const service of SERVICES) {
    try {
      service.module = await loadAppModule(service.name);
      console.log(`   ✅ ${service.title} cargado correctamente`);
    } catch (error) {
      console.error(`   ❌ Error cargando ${service.title}:`, error);
      process.exit(1);
    }
  }

  // Generar un documento de Swagger para cada servicio A PARTIR DEL CÓDIGO REAL
  console.log('🚀 Generando especificaciones reales desde código...');
  const serviceDocuments = await Promise.all(
    SERVICES.map(async (service) => {
      console.log(`🔧 Procesando ${service.title}...`);
      try {
        if (!service.module) {
          throw new Error(`Módulo no cargado para ${service.title}`);
        }
        const doc = await buildSwagger(service.module, service.title);
        console.log(`   ✅ ${service.title} completado`);
        return doc;
      } catch (error) {
        console.error(`   ❌ Error generando ${service.title}:`, error);
        throw error;
      }
    })
  );

  // Combinar y convertir los documentos generados
  console.log('🔗 Combinando especificaciones OpenAPI 3.0...');

  // Primero combinamos todos los documentos OpenAPI 3.0
  const combinedOpenAPI3: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
      title: config.gatewayTitle,
      description: config.gatewayDescription,
      version: config.gatewayVersion,
    },
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
    },
  };

  // Combinar paths, schemas y security schemes de todos los servicios
  serviceDocuments.forEach((doc) => {
    // Combinar paths
    if (doc.paths) {
      Object.assign(combinedOpenAPI3.paths, doc.paths);
    }

    // Combinar schemas
    if (doc.components?.schemas && combinedOpenAPI3.components?.schemas) {
      Object.assign(
        combinedOpenAPI3.components.schemas,
        doc.components.schemas
      );
    }

    // Combinar security schemes
    if (
      doc.components?.securitySchemes &&
      combinedOpenAPI3.components?.securitySchemes
    ) {
      Object.assign(
        combinedOpenAPI3.components.securitySchemes,
        doc.components.securitySchemes
      );
    }
  });

  // Convertir de OpenAPI 3.0 a Swagger 2.0 usando api-spec-converter
  console.log(
    '⚙️ Convirtiendo OpenAPI 3.0 → Swagger 2.0 (para Google Cloud)...'
  );

  let finalCombinedSpec: SwaggerV2Document;
  try {
    const converter = Converter.convert({
      from: 'openapi_3',
      to: 'swagger_2',
      source: combinedOpenAPI3,
    });

    const result = (await converter) as ConversionResult;
    if (result.errors && result.errors.length > 0) {
      console.warn('⚠️ Advertencias durante la conversión:');
      result.errors.forEach((error: ConversionError) => {
        console.warn(`   - ${error.message || error}`);
      });
    }

    finalCombinedSpec = result.spec;
    console.log('✅ Conversión completada exitosamente');
  } catch (error) {
    console.error(
      '❌ Error durante la conversión OpenAPI 3.0 → Swagger 2.0:',
      error
    );
    throw error;
  }

  // Limpiar security definitions incompatibles con Google Cloud
  console.log('🧹 Limpiando security definitions para Google Cloud...');
  const securityDefinitions = finalCombinedSpec.securityDefinitions;
  if (securityDefinitions) {
    Object.keys(securityDefinitions).forEach((key) => {
      const secDef = securityDefinitions[key];
      if (secDef.type === 'apiKey') {
        const isValidApiKey =
          (secDef.name === 'key' && secDef.in === 'query') ||
          (secDef.name === 'api_key' && secDef.in === 'query') ||
          (secDef.name === 'x-api-key' && secDef.in === 'header');

        if (!isValidApiKey) {
          console.log(
            `   ⚠️ Removiendo security definition incompatible: ${key} (name: ${secDef.name}, in: ${secDef.in})`
          );
          delete securityDefinitions[key];
        }
      } else if (secDef.type !== 'oauth2') {
        // Remover otros tipos no soportados
        console.log(
          `   ⚠️ Removiendo security definition no soportado: ${key} (type: ${secDef.type})`
        );
        delete securityDefinitions[key];
      }
    });
  }

  // Inyectar la configuración de Google Cloud
  console.log('☁️ Añadiendo configuración de Google Cloud API Gateway...');
  const finalSpec = enhanceSpecForGoogleCloud(
    finalCombinedSpec,
    envVars,
    config
  );

  // Escribir archivo final
  console.log('💾 Escribiendo archivo de especificación...');
  const outputPath = path.resolve(config.outputFile);
  fs.writeFileSync(outputPath, YAML.stringify(finalSpec), 'utf8');

  // Mostrar estadísticas y próximos pasos
  logSpecificationStats(
    outputPath,
    Object.keys(finalSpec.paths || {}).length,
    Object.keys(finalSpec.definitions || {}).length
  );

  logNextSteps(config.outputFile);
}

// --- FUNCIÓN PRINCIPAL CON MANEJO DE ERRORES ---
async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
🔧 Generador de Especificación OpenAPI para Google Cloud API Gateway

Genera especificaciones OpenAPI REALES extrayendo la configuración de Swagger de tus APIs NestJS.

USAGE:
  node generate-openapi.js [OPTIONS]

OPTIONS:
  --output <file>         Archivo de salida (default: openapi-gateway.yaml)
  --title <title>         Título del gateway (default: Monorepo API Gateway)
  --description <desc>    Descripción del gateway
  --version <version>     Versión del gateway (default: 1.0.0)
  --protocol <protocol>   Protocolo de backend (default: https)
  --project-id <id>       Google Cloud Project ID (para Firebase Auth)
  --help                  Mostrar esta ayuda

VARIABLES DE ENTORNO REQUERIDAS:
  USERS_BACKEND_URL       URL del servicio de usuarios
  ORDERS_BACKEND_URL      URL del servicio de órdenes

CARACTERÍSTICAS:
  ✅ Extrae configuración REAL de Swagger de tus APIs NestJS
  ✅ Auto-discovery de servicios vía variables de entorno
  ✅ Conversión automática OpenAPI 3.0 → Swagger 2.0
  ✅ Configuración optimizada para Google Cloud API Gateway
`);
    process.exit(0);
  }

  try {
    await generateSpec();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fatal durante la generación:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
