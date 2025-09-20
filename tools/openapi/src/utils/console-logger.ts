/**
 * @fileoverview Utilidades para logging y mensajes de consola
 *
 * Proporciona funciones estructuradas para mostrar mensajes
 * informativos, de error y de estado durante la ejecución.
 */

import { Config, ServiceConfig, ValidatedServiceUrls } from '../types/index';

/**
 * Niveles de log disponibles
 */
export enum LogLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Iconos para diferentes tipos de mensajes
 */
const LOG_ICONS = {
  [LogLevel.INFO]: '🔍',
  [LogLevel.SUCCESS]: '✅',
  [LogLevel.WARNING]: '⚠️',
  [LogLevel.ERROR]: '❌',
} as const;

/**
 * Muestra un mensaje con el nivel y formato apropiado
 *
 * @param level - Nivel del mensaje
 * @param message - Mensaje a mostrar
 * @param details - Detalles adicionales opcionales
 *
 * @example
 * ```typescript
 * logMessage(LogLevel.SUCCESS, 'Operación completada');
 * logMessage(LogLevel.ERROR, 'Error crítico', 'Detalles del error...');
 * ```
 */
export function logMessage(
  level: LogLevel,
  message: string,
  details?: string
): void {
  const icon = LOG_ICONS[level];
  console.log(`${icon} ${message}`);

  if (details) {
    console.log(`   ${details}`);
  }
}

/**
 * Muestra la configuración detectada de forma estructurada
 *
 * @param config - Configuración del generador
 *
 * @example
 * ```typescript
 * logConfiguration(config);
 * // 📋 Configuración detectada:
 * //    - Título: Mi API Gateway
 * //    - Versión: 1.0.0
 * //    ...
 * ```
 */
export function logConfiguration(config: Config): void {
  console.log('📋 Configuración detectada:');
  console.log(`   - Título: ${config.gatewayTitle}`);
  console.log(`   - Versión: ${config.gatewayVersion}`);
  console.log(`   - Archivo de salida: ${config.outputFile}`);
  console.log(`   - Protocolo: ${config.protocol}`);
  console.log(`   - Google Cloud Project: ${config.projectId}`);
}

/**
 * Muestra un resumen de los servicios y sus URLs
 *
 * @param services - Configuraciones de servicios
 * @param serviceUrls - URLs validadas de los servicios
 *
 * @example
 * ```typescript
 * logServicesSummary(services, urls);
 * // 📡 URLs de servicios:
 * //    - Users API: https://api.example.com/users
 * //    - Orders API: https://api.example.com/orders
 * ```
 */
export function logServicesSummary(
  services: ServiceConfig[],
  serviceUrls: ValidatedServiceUrls
): void {
  console.log('📡 URLs de servicios:');
  services.forEach((service) => {
    console.log(`   - ${service.title}: ${serviceUrls[service.urlEnvVar]}`);
  });
}

/**
 * Muestra estadísticas de la especificación generada
 *
 * @param filePath - Ruta del archivo generado
 * @param pathCount - Número de paths en la especificación
 * @param definitionCount - Número de definiciones en la especificación
 *
 * @example
 * ```typescript
 * logSpecificationStats('./api-spec.yaml', 15, 8);
 * // ✅ Especificación OpenAPI generada con éxito:
 * //    📄 Archivo: ./api-spec.yaml
 * //    📊 Paths: 15
 * //    🧩 Definitions: 8
 * ```
 */
export function logSpecificationStats(
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
 * Muestra los próximos pasos después de generar la especificación
 *
 * @param outputFile - Nombre del archivo generado
 * @param environment - Entorno target ('dev' o 'prod')
 *
 * @example
 * ```typescript
 * logNextSteps('mi-empresa-api-dev.yaml', 'dev');
 * // 📚 Próximos pasos:
 * //    Desplegar: npm run gateway:deploy:dev
 * //    Gateway completo: npm run gateway:dev
 * ```
 */
export function logNextSteps(
  outputFile: string,
  environment: 'dev' | 'prod'
): void {
  console.log('\n📚 Próximos pasos:');
  console.log(`   Desplegar: npm run gateway:deploy:${environment}`);
  console.log(`   Gateway completo: npm run gateway:${environment}`);
}

/**
 * Muestra un mensaje de error con formato estándar
 *
 * @param message - Mensaje de error principal
 * @param details - Detalles adicionales del error
 *
 * @example
 * ```typescript
 * logError('Error de validación', 'La URL no es válida');
 * // ❌ Error de validación
 * //    La URL no es válida
 * ```
 */
export function logError(message: string, details?: string): void {
  logMessage(LogLevel.ERROR, message, details);
}

/**
 * Muestra un mensaje de éxito con formato estándar
 *
 * @param message - Mensaje de éxito
 * @param details - Detalles adicionales opcionales
 *
 * @example
 * ```typescript
 * logSuccess('Proceso completado', 'Todos los servicios procesados');
 * // ✅ Proceso completado
 * //    Todos los servicios procesados
 * ```
 */
export function logSuccess(message: string, details?: string): void {
  logMessage(LogLevel.SUCCESS, message, details);
}

/**
 * Muestra un mensaje informativo con formato estándar
 *
 * @param message - Mensaje informativo
 * @param details - Detalles adicionales opcionales
 *
 * @example
 * ```typescript
 * logInfo('Iniciando proceso', 'Cargando configuración...');
 * // 🔍 Iniciando proceso
 * //    Cargando configuración...
 * ```
 */
export function logInfo(message: string, details?: string): void {
  logMessage(LogLevel.INFO, message, details);
}

/**
 * Muestra un mensaje de advertencia con formato estándar
 *
 * @param message - Mensaje de advertencia
 * @param details - Detalles adicionales opcionales
 *
 * @example
 * ```typescript
 * logWarning('Configuración incompleta', 'Usando valores por defecto');
 * // ⚠️ Configuración incompleta
 * //    Usando valores por defecto
 * ```
 */
export function logWarning(message: string, details?: string): void {
  logMessage(LogLevel.WARNING, message, details);
}
