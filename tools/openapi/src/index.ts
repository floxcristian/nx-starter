/**
 * @fileoverview Punto de entrada principal del generador OpenAPI modular
 *
 * Este archivo orquesta todo el proceso de generación utilizando
 * la arquitectura modular organizada.
 */

import { buildConfig } from './validators/config-validator';
import {
  discoverServices,
  validateServiceUrls,
} from './services/service-discovery';
import { loadAllModules } from './services/module-loader';
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
 * Función principal que ejecuta todo el proceso de generación de OpenAPI
 */
async function main(): Promise<void> {
  try {
    // 1. Obtener configuración (incluye validación completa)
    console.log('🔧 Iniciando generador OpenAPI...');
    const config = buildConfig();

    // 2. Descubrir servicios disponibles
    const services = discoverServices();

    // 3. Validar URLs de servicios
    const serviceUrls = validateServiceUrls(services) as Record<string, string>;

    // Mostrar configuración
    logConfiguration(config);

    console.log('📡 URLs de servicios:');
    Object.entries(serviceUrls).forEach(([key, url]) => {
      console.log(`   - ${key}: ${url}`);
    });

    // 5. Cargar módulos de aplicación
    await loadAllModules(services);

    // 6. Generar documentos OpenAPI individuales
    const documents = await generateAllSwaggerDocuments(services);

    // 7. Combinar documentos en uno solo
    const combinedDocument = combineOpenAPIDocuments(
      documents,
      config.gatewayTitle,
      config.gatewayDescription,
      config.gatewayVersion
    );

    // 8. Convertir a Swagger 2.0 primero
    const swaggerDocument = await convertToSwagger2(combinedDocument);

    // 9. Mejorar especificación para Google Cloud
    const enhancedSpec = enhanceSpecificationForGoogleCloud(
      swaggerDocument,
      serviceUrls,
      config,
      services
    );

    // 10. Escribir archivo final
    await writeSwaggerDocument(enhancedSpec, config.outputFile);

    // Mostrar estadísticas finales
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

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}
