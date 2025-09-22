/**
 * @fileoverview Servicio generador de especificaciones OpenAPI
 *
 * Se encarga de generar documentos OpenAPI reales desde el código NestJS,
 * combinar múltiples servicios y convertir el formato final.
 */

import { OpenAPIObject } from '@nestjs/swagger';
import { OpenAPIV3 } from 'openapi-types';
import {
  SwaggerV2Document,
  ConversionResult,
  ConversionError,
} from '../types/index';

// Importar el conversor de especificaciones
const Converter = require('api-spec-converter');

/**
 * Genera documentos OpenAPI para todos los servicios usando el sistema Nx
 *
 * @param nxGenerator - Instancia del generador basado en Nx
 * @returns Promise que resuelve a array de documentos generados
 *
 * @example
 * ```typescript
 * const nxGenerator = new NxBasedOpenApiGenerator();
 * const documents = await generateAllSwaggerDocuments(nxGenerator);
 * console.log(`Generados ${documents.length} documentos`);
 * ```
 *
 * @throws {Error} Si falla la generación de cualquier documento
 */
export async function generateAllSwaggerDocuments(nxGenerator: {
  generate(): Promise<Record<string, unknown>>;
}): Promise<OpenAPIObject[]> {
  console.log(
    '🚀 Generando especificaciones desde análisis de controladores...'
  );

  // Generar specs usando el analizador estático
  const individualSpecs = await nxGenerator.generate();

  // Convertir a formato OpenAPIObject[]
  const documents: OpenAPIObject[] = Object.values(
    individualSpecs
  ) as OpenAPIObject[];

  console.log(`✅ Generados ${documents.length} documentos con rutas reales`);
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
