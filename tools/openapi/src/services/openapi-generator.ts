/**
 * @fileoverview Servicio generador de especificaciones OpenAPI
 *
 * Se encarga de generar documentos OpenAPI, combinar múltiples servicios y convertir el formato final.
 */

import { OpenAPIV3 } from 'openapi-types';
import { SwaggerV2Document } from '../types/index';
import * as Converter from 'api-spec-converter';
import {
  NxBasedOpenApiGenerator,
  OpenApiSpec,
} from './nx-workspace-discovery';

// Interfaces locales para el resultado de la conversión
interface ConversionError {
  message?: string;
}

interface ConversionResult {
  spec: SwaggerV2Document;
  errors?: ConversionError[];
}

/**
 * Genera documentos OpenAPI para todos los servicios usando el sistema Nx.
 *
 * @param nxGenerator Instancia del generador basado en Nx.
 * @returns Promise que resuelve a un array de documentos OpenAPI generados.
 */
export async function generateAllSwaggerDocuments(
  nxGenerator: NxBasedOpenApiGenerator
): Promise<OpenApiSpec[]> {
  console.log(
    '🚀 Generando especificaciones desde análisis de controladores...'
  );

  const individualSpecs = await nxGenerator.generateIndividualSpecs();
  const documents = Object.values(individualSpecs);

  console.log(`✅ Generados ${documents.length} documentos con rutas reales`);
  return documents;
}

/**
 * Combina múltiples documentos OpenAPI 3.0 en un solo documento.
 *
 * @param documents Array de documentos OpenAPI a combinar.
 * @param title Título para el documento combinado.
 * @param description Descripción para el documento combinado.
 * @param version Versión para el documento combinado.
 * @returns Documento OpenAPI 3.0 combinado.
 */
export function combineOpenAPIDocuments(
  documents: OpenApiSpec[],
  title: string,
  description: string,
  version: string
): OpenAPIV3.Document {
  console.log('🔗 Combinando especificaciones OpenAPI 3.0...');

  const combinedPaths: OpenAPIV3.PathsObject = {};
  const combinedSchemas: Record<
    string,
    OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  > = {};
  const combinedSecuritySchemes: Record<
    string,
    OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject
  > = {};

  for (const doc of documents) {
    if (doc.paths) {
      Object.assign(combinedPaths, doc.paths);
    }
    if (doc.components?.schemas) {
      Object.assign(combinedSchemas, doc.components.schemas);
    }
    if (doc.components?.securitySchemes) {
      Object.assign(combinedSecuritySchemes, doc.components.securitySchemes);
    }
  }

  const combinedDocument: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
      title,
      description,
      version,
    },
    paths: combinedPaths,
    components: {
      schemas: combinedSchemas,
      securitySchemes: combinedSecuritySchemes,
    },
  };

  return combinedDocument;
}

/**
 * Convierte un documento OpenAPI 3.0 a Swagger 2.0.
 *
 * @param openApiDocument Documento OpenAPI 3.0 a convertir.
 * @returns Promise que resuelve al documento Swagger 2.0.
 */
export async function convertToSwagger2(
  openApiDocument: OpenAPIV3.Document
): Promise<SwaggerV2Document> {
  console.log(
    '⚙️ Convirtiendo OpenAPI 3.0 → Swagger 2.0 (para Google Cloud)...'
  );

  try {
    const result: ConversionResult = await Converter.convert({
      from: 'openapi_3',
      to: 'swagger_2',
      source: openApiDocument,
    });

    if (result.errors?.length) {
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
