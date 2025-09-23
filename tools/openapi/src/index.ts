/**
 * @fileoverview Punto de entrada principal del generador OpenAPI modular.
 *
 * Este archivo orquesta todo el proceso de generación de la especificación
 * OpenAPI para el API Gateway, coordinando los diferentes servicios modulares.
 */

import { buildConfig } from './validators/config-validator';
import { NxBasedOpenApiGenerator } from './services/nx-workspace-discovery';
import {
  generateAllSwaggerDocuments,
  convertToSwagger2,
  combineOpenAPIDocuments,
} from './services/openapi-generator';
import { enhanceSpecificationForGoogleCloud } from './services/google-cloud-enhancer';
import { writeSwaggerDocument } from './utils/file-utils';
import {
  logConfiguration,
  logSpecificationStats,
  logNextSteps,
} from './utils/console-logger';

/**
 * Función principal que ejecuta todo el proceso de generación de OpenAPI.
 */
async function main(): Promise<void> {
  try {
    // 1. Obtener y validar la configuración desde variables de entorno.
    console.log('🔧 Iniciando generador OpenAPI...');
    const config = buildConfig();

    // 2. Descubrir servicios disponibles y sus URLs usando el grafo de Nx.
    const nxGenerator = new NxBasedOpenApiGenerator();
    const services = nxGenerator.generateServiceConfigs();

    if (services.length === 0) {
      throw new Error(
        "No se encontraron servicios API para el gateway. Revisa que los proyectos tengan el tag 'scope:gcp-gateway' y sus variables de entorno `*_BACKEND_URL` estén definidas."
      );
    }

    console.log(`📊 Servicios descubiertos: ${services.length}`);
    logConfiguration(config);

    // 3. Generar un documento OpenAPI para cada servicio individualmente.
    const documents = await generateAllSwaggerDocuments(nxGenerator);

    // 4. Combinar todos los documentos en una única especificación OpenAPI 3.0.
    const combinedDocument = combineOpenAPIDocuments(
      documents,
      config.gatewayTitle,
      config.gatewayDescription,
      config.gatewayVersion
    );

    // 5. Convertir la especificación combinada a Swagger 2.0 para Google Cloud.
    const swaggerDocument = await convertToSwagger2(combinedDocument);

    // 6. Añadir extensiones específicas de Google Cloud (`x-google-*`).
    const enhancedSpec = enhanceSpecificationForGoogleCloud(
      swaggerDocument,
      config,
      services
    );

    // 7. Escribir el archivo final en disco.
    await writeSwaggerDocument(enhancedSpec, config.outputFile);

    // 8. Mostrar resumen y próximos pasos.
    const pathCount = Object.keys(enhancedSpec.paths || {}).length;
    const definitionCount = Object.keys(enhancedSpec.definitions || {}).length;
    logSpecificationStats(config.outputFile, pathCount, definitionCount);
    logNextSteps(config.outputFile, config.environment);

    console.log('🎉 ¡Proceso completado exitosamente!');
  } catch (error) {
    console.error('❌ Error durante la generación:', error);
    process.exit(1);
  }
}

// Ejecutar la función principal si el script es llamado directamente.
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}
