/**
 * @fileoverview Validador de configuración
 *
 * Contiene esquemas y funciones de validación para la configuración
 * del generador de OpenAPI, incluyendo argumentos CLI y configuración final.
 */

import * as Joi from 'joi';
import { Config, ParsedCliArgs } from '../types/index';

/**
 * Esquema de validación para la configuración principal del generador
 */
export const configSchema = Joi.object({
  outputFile: Joi.string().min(1).required(),

  gatewayApiName: Joi.string()
    .pattern(/^[a-z][a-z0-9-]*[a-z0-9]$/)
    .min(1)
    .max(63)
    .required(),

  gatewayTitle: Joi.string().min(1).required(),

  gatewayDescription: Joi.string().min(1).required(),

  gatewayVersion: Joi.string()
    .pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/)
    .required(),

  protocol: Joi.string().valid('http', 'https').required(),

  projectId: Joi.string().min(1).required(),

  environment: Joi.string().valid('dev', 'prod').required(),
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
  // Todas las variables son requeridas - no hay defaults
  const rawConfig = {
    outputFile: cliArgs['output'] || process.env['OPENAPI_OUTPUT_FILE'],
    gatewayApiName: cliArgs['api-name'] || process.env['GATEWAY_API_NAME'],
    gatewayTitle: cliArgs['title'] || process.env['GATEWAY_TITLE'],
    gatewayDescription:
      cliArgs['description'] || process.env['GATEWAY_DESCRIPTION'],
    gatewayVersion: cliArgs['version'] || process.env['GATEWAY_VERSION'],
    protocol: cliArgs['protocol'] || process.env['BACKEND_PROTOCOL'],
    projectId: cliArgs['project-id'] || process.env['GOOGLE_CLOUD_PROJECT'],
    environment: cliArgs['environment'] || process.env['ENVIRONMENT'],
  };

  // Validar configuración usando Joi
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
