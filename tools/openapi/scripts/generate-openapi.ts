/* eslint-disable @typescript-eslint/no-explicit-any */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { OpenAPIV3 } from 'openapi-types';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
const Converter = require('api-spec-converter');

// --- INTERFACES Y CONFIGURACIÓN ---
interface ServiceConfig {
  name: string;
  module: any;
  urlEnvVar: string;
  pathPrefix: string;
  title: string;
}

interface Config {
  outputFile: string;
  gatewayTitle: string;
  gatewayDescription: string;
  gatewayVersion: string;
  protocol: string;
  projectId?: string;
  clientId?: string;
}

// --- AUTO-DISCOVERY DE SERVICIOS ---
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
  }, {} as Record<string, any>);

  return {
    outputFile:
      args['output'] ||
      process.env['OPENAPI_OUTPUT_FILE'] ||
      'openapi-gateway.yaml',
    gatewayTitle:
      args['title'] || process.env['GATEWAY_TITLE'] || 'Monorepo API Gateway',
    gatewayDescription:
      args['description'] ||
      process.env['GATEWAY_DESCRIPTION'] ||
      'Gateway principal que unifica todos los microservicios.',
    gatewayVersion:
      args['version'] || process.env['GATEWAY_VERSION'] || '1.0.0',
    protocol: args['protocol'] || process.env['BACKEND_PROTOCOL'] || 'https',
    projectId: args['project-id'] || process.env['GOOGLE_CLOUD_PROJECT'],
    clientId: args['client-id'] || process.env['GOOGLE_CLIENT_ID'],
  };
}

// --- CARGA DINÁMICA DE MÓDULOS ---
async function loadAppModule(serviceName: string): Promise<any> {
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

// --- MOTOR DE GENERACIÓN REAL ---
const buildSwagger = async (
  appModule: any,
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

// --- VALIDACIÓN DE VARIABLES DE ENTORNO ---
function validateEnvironmentVariables(): Record<string, string> {
  const envVars: Record<string, string> = {};
  const missingVars: string[] = [];

  for (const service of SERVICES) {
    const value = process.env[service.urlEnvVar];
    if (!value) {
      missingVars.push(service.urlEnvVar);
    } else {
      envVars[service.urlEnvVar] = value;
    }
  }

  if (missingVars.length > 0) {
    console.error(
      `❌ Error: Las siguientes variables de entorno son requeridas: ${missingVars.join(
        ', '
      )}`
    );
    console.error('Ejemplo:');
    missingVars.forEach((varName) => {
      console.error(`export ${varName}=https://your-service-url.com`);
    });
    process.exit(1);
  }

  return envVars;
}

// --- CONFIGURACIÓN DE GOOGLE CLOUD ---
function enhanceSpecForGoogleCloud(
  spec: any,
  envVars: Record<string, string>,
  config: Config
): any {
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

  const securitySchemes: Record<string, any> = {
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

  if (config.clientId) {
    securitySchemes['google_id_token'] = {
      type: 'oauth2',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
      flow: 'implicit',
      'x-google-issuer': 'https://accounts.google.com',
      'x-google-jwks_uri': 'https://www.googleapis.com/oauth2/v3/certs',
      'x-google-audiences': config.clientId,
    };
  }

  if (config.projectId) {
    securitySchemes['firebase_auth'] = {
      type: 'oauth2',
      authorizationUrl: `https://securetoken.google.com/${config.projectId}`,
      flow: 'implicit',
      'x-google-issuer': `https://securetoken.google.com/${config.projectId}`,
      'x-google-jwks_uri':
        'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
      'x-google-audiences': config.projectId,
    };
  }

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

// --- FUNCIÓN PRINCIPAL ---
async function generateSpec() {
  const config = getConfig();

  console.log('🔍 Validando variables de entorno...');
  const envVars = validateEnvironmentVariables();

  console.log('📋 Configuración detectada:');
  console.log(`   - Título: ${config.gatewayTitle}`);
  console.log(`   - Versión: ${config.gatewayVersion}`);
  console.log(`   - Archivo de salida: ${config.outputFile}`);
  console.log(`   - Protocolo: ${config.protocol}`);
  if (config.projectId)
    console.log(`   - Google Cloud Project: ${config.projectId}`);
  if (config.clientId) console.log(`   - Google Client ID: ${config.clientId}`);

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

  let finalCombinedSpec: any;
  try {
    const converter = Converter.convert({
      from: 'openapi_3',
      to: 'swagger_2',
      source: combinedOpenAPI3,
    });

    const result = await converter;
    if (result.errors && result.errors.length > 0) {
      console.warn('⚠️ Advertencias durante la conversión:');
      result.errors.forEach((error: any) => {
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
  if (finalCombinedSpec.securityDefinitions) {
    Object.keys(finalCombinedSpec.securityDefinitions).forEach((key) => {
      const secDef = finalCombinedSpec.securityDefinitions[key];
      if (secDef.type === 'apiKey') {
        const isValidApiKey =
          (secDef.name === 'key' && secDef.in === 'query') ||
          (secDef.name === 'api_key' && secDef.in === 'query') ||
          (secDef.name === 'x-api-key' && secDef.in === 'header');

        if (!isValidApiKey) {
          console.log(
            `   ⚠️ Removiendo security definition incompatible: ${key} (name: ${secDef.name}, in: ${secDef.in})`
          );
          delete finalCombinedSpec.securityDefinitions[key];
        }
      } else if (secDef.type !== 'oauth2') {
        // Remover otros tipos no soportados
        console.log(
          `   ⚠️ Removiendo security definition no soportado: ${key} (type: ${secDef.type})`
        );
        delete finalCombinedSpec.securityDefinitions[key];
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

  console.log(`✅ Especificación OpenAPI generada con éxito:`);
  console.log(`   📄 Archivo: ${outputPath}`);
  console.log(`   📊 Paths: ${Object.keys(finalSpec.paths || {}).length}`);
  console.log(
    `   🧩 Definitions: ${Object.keys(finalSpec.definitions || {}).length}`
  );

  // Mostrar comandos útiles
  console.log('\n📚 Próximos pasos:');
  console.log(
    `   Desplegar: npm run gateway:deploy:${
      config.outputFile.includes('dev') ? 'dev' : 'prod'
    }`
  );
  console.log(
    `   Gateway completo: npm run gateway:${
      config.outputFile.includes('dev') ? 'dev' : 'prod'
    }`
  );
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
  --client-id <id>        Google OAuth Client ID (para Google Auth)
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
