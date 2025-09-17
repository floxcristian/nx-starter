/**
 * @fileoverview Validador de configuración
 *
 * Contiene esquemas y funciones de validación para la configuración
 * del generador de OpenAPI, incluyendo argumentos CLI y configuración final.
 */

import * as Joi from 'joi';
import { Config, ParsedCliArgs, CONSTANTS } from '../types/index';

/**
 * Esquema de validación para la configuración principal del generador
 */
export const configSchema = Joi.object({
  outputFile: Joi.string().min(1).default(CONSTANTS.DEFAULTS.OUTPUT_FILE),

  gatewayTitle: Joi.string().min(1).default(CONSTANTS.DEFAULTS.GATEWAY_TITLE),

  gatewayDescription: Joi.string()
    .min(1)
    .default(CONSTANTS.DEFAULTS.GATEWAY_DESCRIPTION),

  gatewayVersion: Joi.string()
    .pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/)
    .default(CONSTANTS.DEFAULTS.GATEWAY_VERSION),

  protocol: Joi.string()
    .valid('http', 'https')
    .default(CONSTANTS.DEFAULTS.PROTOCOL),

  projectId: Joi.string().min(1).required(),
});

/**
 * Parsea los argumentos de línea de comandos en un objeto estructurado
 *
 * @param argv - Array de argumentos de línea de comandos
 * @returns Objeto con los argumentos parseados
 *
 * @example
 * ```typescript
 * const args = parseCliArguments(['--output', 'api.yaml', '--title', 'Mi API']);
 * console.log(args);
 * // { output: 'api.yaml', title: 'Mi API' }
 * ```
 */
export function parseCliArguments(argv: string[]): ParsedCliArgs {
  return argv.slice(2).reduce((acc, arg, index, arr) => {
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = arr[index + 1];
      const value = nextArg && !nextArg.startsWith('--') ? nextArg : true;
      acc[key] = value;
    }
    return acc;
  }, {} as ParsedCliArgs);
}

/**
 * Construye la configuración final combinando argumentos CLI, variables de entorno y defaults
 *
 * @param cliArgs - Argumentos parseados de línea de comandos
 * @returns Configuración validada y completa
 *
 * @example
 * ```typescript
 * const args = parseCliArguments(process.argv);
 * const config = buildConfig(args);
 * console.log(`Generando ${config.gatewayTitle} v${config.gatewayVersion}`);
 * ```
 *
 * @throws {Error} Si la configuración no es válida
 */
export function buildConfig(cliArgs: ParsedCliArgs): Config {
  // Combinar fuentes de configuración con precedencia:
  // 1. Argumentos CLI (prioridad más alta)
  // 2. Variables de entorno
  // 3. Valores por defecto (manejados por Joi)
  const rawConfig = {
    outputFile: cliArgs['output'] || process.env['OPENAPI_OUTPUT_FILE'],
    gatewayTitle: cliArgs['title'] || process.env['GATEWAY_TITLE'],
    gatewayDescription:
      cliArgs['description'] || process.env['GATEWAY_DESCRIPTION'],
    gatewayVersion: cliArgs['version'] || process.env['GATEWAY_VERSION'],
    protocol: cliArgs['protocol'] || process.env['BACKEND_PROTOCOL'],
    projectId: cliArgs['project-id'] || process.env['GOOGLE_CLOUD_PROJECT'],
  };

  // Validar configuración usando Joi
  const { error, value } = configSchema.validate(rawConfig);

  if (error) {
    console.error('❌ Error en configuración:');
    error.details.forEach((detail: Joi.ValidationErrorItem) => {
      console.error(`   - ${detail.message}`);
    });
    console.error('\n💡 Verifica tus variables de entorno o argumentos CLI');
    throw new Error('Configuración inválida');
  }

  return value as Config;
}

/**
 * Valida que una versión siga el formato de semantic versioning
 *
 * @param version - Versión a validar
 * @returns true si la versión es válida
 *
 * @example
 * ```typescript
 * console.log(isValidSemver('1.0.0'));        // true
 * console.log(isValidSemver('1.0.0-beta.1')); // true
 * console.log(isValidSemver('invalid'));      // false
 * ```
 */
export function isValidSemver(version: string): boolean {
  const semverPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/;
  return semverPattern.test(version);
}

/**
 * Muestra la ayuda del comando con todos los parámetros disponibles
 *
 * @example
 * ```typescript
 * showHelp();
 * // Imprime la ayuda completa del comando
 * ```
 */
export function showHelp(): void {
  console.log(`
🔧 Generador de Especificación OpenAPI para Google Cloud API Gateway

Genera especificaciones OpenAPI REALES extrayendo la configuración de Swagger de tus APIs NestJS.

USAGE:
  node generate-openapi.js [OPTIONS]

OPTIONS:
  --output <file>         Archivo de salida (default: ${CONSTANTS.DEFAULTS.OUTPUT_FILE})
  --title <title>         Título del gateway (default: ${CONSTANTS.DEFAULTS.GATEWAY_TITLE})
  --description <desc>    Descripción del gateway
  --version <version>     Versión del gateway (default: ${CONSTANTS.DEFAULTS.GATEWAY_VERSION})
  --protocol <protocol>   Protocolo de backend (default: ${CONSTANTS.DEFAULTS.PROTOCOL})
  --project-id <id>       Google Cloud Project ID (para Firebase Auth)
  --help                  Mostrar esta ayuda

VARIABLES DE ENTORNO REQUERIDAS:
  GOOGLE_CLOUD_PROJECT    ID del proyecto de Google Cloud
  *_BACKEND_URL          URLs de servicios (ej: USERS_BACKEND_URL, ORDERS_BACKEND_URL)

CARACTERÍSTICAS:
  ✅ Extrae configuración REAL de Swagger de tus APIs NestJS
  ✅ Auto-discovery de servicios vía variables de entorno
  ✅ Conversión automática OpenAPI 3.0 → Swagger 2.0
  ✅ Configuración optimizada para Google Cloud API Gateway
`);
}
