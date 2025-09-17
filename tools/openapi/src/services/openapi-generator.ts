/**
 * @fileoverview Servicio generador de especificaciones OpenAPI
 *
 * Se encarga de generar documentos OpenAPI reales desde el código NestJS,
 * combinar múltiples servicios y convertir el formato final.
 */

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { OpenAPIV3 } from 'openapi-types';
import {
  ServiceModule,
  ServiceConfig,
  SwaggerV2Document,
  ConversionResult,
  ConversionError,
} from '../types/index';

// Importar el conversor de especificaciones
const Converter = require('api-spec-converter');

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
 * const doc = await buildSwaggerDocument(UsersModule.AppModule, 'Users API');
 * console.log(`Generado documento con ${Object.keys(doc.paths).length} paths`);
 * ```
 *
 * @throws {Error} Si falla la creación de la aplicación o generación del documento
 */
export async function buildSwaggerDocument(
  appModule: ServiceModule,
  title: string
): Promise<OpenAPIObject> {
  console.log(`   🏗️  Creando aplicación NestJS para ${title}...`);

  // Crear aplicación temporal sin logs para extracción limpia
  const app = await NestFactory.create(appModule, {
    logger: false,
    abortOnError: false,
  });

  try {
    console.log(`   📋 Configurando Swagger para ${title}...`);

    // Configurar Swagger con metadata básica
    const config = new DocumentBuilder()
      .setTitle(title)
      .setDescription(`API del servicio ${title}`)
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', bearerFormat: 'JWT' })
      .build();

    console.log(`   📊 Generando documento OpenAPI para ${title}...`);
    const document = SwaggerModule.createDocument(app, config);

    return document;
  } finally {
    console.log(`   🔧 Cerrando aplicación ${title}...`);
    await app.close();
  }
}

/**
 * Genera documentos OpenAPI para todos los servicios configurados
 *
 * @param services - Array de configuraciones de servicios con módulos cargados
 * @returns Promise que resuelve a array de documentos generados
 *
 * @example
 * ```typescript
 * const services = await loadAllModules(serviceConfigs);
 * const documents = await generateAllSwaggerDocuments(services);
 * console.log(`Generados ${documents.length} documentos`);
 * ```
 *
 * @throws {Error} Si falla la generación de cualquier documento
 */
export async function generateAllSwaggerDocuments(
  services: ServiceConfig[]
): Promise<OpenAPIObject[]> {
  console.log('🚀 Generando especificaciones reales desde código...');

  const documents = await Promise.all(
    services.map(async (service) => {
      console.log(`🔧 Procesando ${service.title}...`);

      try {
        if (!service.module) {
          throw new Error(`Módulo no cargado para ${service.title}`);
        }

        const doc = await buildSwaggerDocument(service.module, service.title);
        console.log(`   ✅ ${service.title} completado`);
        return doc;
      } catch (error) {
        console.error(`   ❌ Error generando ${service.title}:`, error);
        throw error;
      }
    })
  );

  return documents;
}

/**
 * Combina múltiples documentos OpenAPI 3.0 en un solo documento
 *
 * Fusiona paths, schemas y security schemes de todos los documentos
 * manteniendo la compatibilidad y evitando conflictos.
 *
 * @param documents - Array de documentos OpenAPI a combinar
 * @param title - Título para el documento combinado
 * @param description - Descripción para el documento combinado
 * @param version - Versión para el documento combinado
 * @returns Documento OpenAPI 3.0 combinado
 *
 * @example
 * ```typescript
 * const combined = combineOpenAPIDocuments(
 *   [usersDoc, ordersDoc],
 *   'Gateway API',
 *   'API Gateway unificada',
 *   '1.0.0'
 * );
 * console.log(`Combinado: ${Object.keys(combined.paths).length} paths`);
 * ```
 */
export function combineOpenAPIDocuments(
  documents: OpenAPIObject[],
  title: string,
  description: string,
  version: string
): OpenAPIV3.Document {
  console.log('🔗 Combinando especificaciones OpenAPI 3.0...');

  // Crear documento base
  const combinedDocument: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
      title,
      description,
      version,
    },
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
    },
  };

  // Combinar contenido de todos los documentos
  documents.forEach((doc) => {
    // Combinar paths
    if (doc.paths && combinedDocument.paths) {
      Object.assign(combinedDocument.paths, doc.paths);
    }

    // Combinar schemas
    if (doc.components?.schemas && combinedDocument.components?.schemas) {
      Object.assign(
        combinedDocument.components.schemas,
        doc.components.schemas
      );
    }

    // Combinar security schemes
    if (
      doc.components?.securitySchemes &&
      combinedDocument.components?.securitySchemes
    ) {
      Object.assign(
        combinedDocument.components.securitySchemes,
        doc.components.securitySchemes
      );
    }
  });

  return combinedDocument;
}

/**
 * Convierte un documento OpenAPI 3.0 a Swagger 2.0
 *
 * Utiliza api-spec-converter para transformar el formato, necesario
 * para compatibilidad con Google Cloud API Gateway.
 *
 * @param openApiDocument - Documento OpenAPI 3.0 a convertir
 * @returns Promise que resuelve al documento Swagger 2.0
 *
 * @example
 * ```typescript
 * const openapi3 = { openapi: '3.0.0', ... };
 * const swagger2 = await convertToSwagger2(openapi3);
 * console.log(`Convertido a Swagger ${swagger2.swagger}`);
 * ```
 *
 * @throws {Error} Si falla la conversión
 */
export async function convertToSwagger2(
  openApiDocument: OpenAPIV3.Document
): Promise<SwaggerV2Document> {
  console.log(
    '⚙️ Convirtiendo OpenAPI 3.0 → Swagger 2.0 (para Google Cloud)...'
  );

  try {
    const converter = Converter.convert({
      from: 'openapi_3',
      to: 'swagger_2',
      source: openApiDocument,
    });

    const result = (await converter) as ConversionResult;

    // Reportar advertencias si las hay
    if (result.errors && result.errors.length > 0) {
      console.warn('⚠️ Advertencias durante la conversión:');
      result.errors.forEach((error: ConversionError) => {
        console.warn(`   - ${error.message || error}`);
      });
    }

    console.log('✅ Conversión completada exitosamente');
    return result.spec;
  } catch (error) {
    console.error(
      '❌ Error durante la conversión OpenAPI 3.0 → Swagger 2.0:',
      error
    );
    throw error;
  }
}

/**
 * Limpia security definitions incompatibles con Google Cloud API Gateway
 *
 * Google Cloud solo acepta ciertos formatos específicos de autenticación.
 * Esta función remueve esquemas incompatibles y mantiene solo los válidos.
 *
 * @param swaggerDocument - Documento Swagger 2.0 a limpiar
 * @returns Documento con security definitions limpias
 *
 * @example
 * ```typescript
 * const cleaned = cleanSecurityDefinitions(swaggerDoc);
 * // Remueve bearer tokens incompatibles, mantiene API keys válidas
 * ```
 */
export function cleanSecurityDefinitions(
  swaggerDocument: SwaggerV2Document
): SwaggerV2Document {
  console.log('🧹 Limpiando security definitions para Google Cloud...');

  const securityDefinitions = swaggerDocument.securityDefinitions;
  if (!securityDefinitions) {
    return swaggerDocument;
  }

  Object.keys(securityDefinitions).forEach((key) => {
    const secDef = securityDefinitions[key];

    if (secDef.type === 'apiKey') {
      // Verificar que el API key tenga formato válido para Google Cloud
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
      // Remover otros tipos no soportados por Google Cloud
      console.log(
        `   ⚠️ Removiendo security definition no soportado: ${key} (type: ${secDef.type})`
      );
      delete securityDefinitions[key];
    }
  });

  return swaggerDocument;
}
