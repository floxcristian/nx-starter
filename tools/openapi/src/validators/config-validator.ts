/**
 * @fileoverview Validador de configuración del generador OpenAPI
 */

import * as Joi from 'joi';
import { Config } from '../types/index';

/**
 * Esquema de validación para la configuración principal del generador
 */
const configSchema = Joi.object({
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

  rateLimitPerMinute: Joi.number().min(1).max(1000000).default(10000),
});

/**
 * Construye la configuración final desde variables de entorno
 *
 * @returns Configuración validada y completa
 *
 * @example
 * ```typescript
 * const config = buildConfig();
 * console.log(`Generando ${config.gatewayTitle} v${config.gatewayVersion}`);
 * ```
 *
 * @throws {Error} Si la configuración no es válida
 */
export function buildConfig(): Config {
  console.log('🔍 Validando variables de entorno...');

  // Configuración solo desde variables de entorno
  const rawConfig = {
    outputFile: process.env['OPENAPI_OUTPUT_FILE'],
    gatewayApiName: process.env['GATEWAY_API_NAME'],
    gatewayTitle: process.env['GATEWAY_TITLE'],
    gatewayDescription: process.env['GATEWAY_DESCRIPTION'],
    gatewayVersion: process.env['GATEWAY_VERSION'],
    protocol: process.env['BACKEND_PROTOCOL'],
    projectId: process.env['GCLOUD_PROJECT_ID'],
    environment: process.env['ENVIRONMENT'],
    rateLimitPerMinute: parseInt(
      process.env['RATE_LIMIT_PER_MINUTE'] || '10000'
    ),
  };

  // Validar configuración usando Joi
  const { error, value } = configSchema.validate(rawConfig);

  if (error) {
    console.error('❌ Error de configuración:');
    error.details.forEach((detail: Joi.ValidationErrorItem) => {
      console.error(`   - ${detail.message}`);
    });
    console.error(
      '\n💡 Copia y configura: .env.{environment}.example → .env.{environment}'
    );
    process.exit(1);
  }

  return value as Config;
}
