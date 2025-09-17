/**
 * @fileoverview Validador de variables de entorno
 *
 * Contiene esquemas y funciones de validación para las variables de entorno
 * requeridas por el generador de OpenAPI. Utiliza Joi para validación robusta.
 */

import * as Joi from 'joi';

/**
 * Esquema de validación para variables de entorno básicas del sistema
 */
export const environmentSchema = Joi.object({
  // Variable requerida para identificación del proyecto en Google Cloud
  GOOGLE_CLOUD_PROJECT: Joi.string().min(1).required(),

  // Variables opcionales de configuración
  OPENAPI_OUTPUT_FILE: Joi.string().optional(),
  GATEWAY_TITLE: Joi.string().optional(),
  GATEWAY_DESCRIPTION: Joi.string().optional(),
  GATEWAY_VERSION: Joi.string().optional(),
  BACKEND_PROTOCOL: Joi.string().valid('http', 'https').optional(),
}).unknown(true); // Permitir otras variables de entorno

/**
 * Esquema de validación para URLs de servicios individuales
 */
export const serviceUrlSchema = Joi.string()
  .uri({ scheme: ['http', 'https'] })
  .required();

/**
 * Valida las variables de entorno básicas del sistema
 *
 * @example
 * ```typescript
 * try {
 *   validateEnvironment();
 *   console.log('✅ Variables de entorno válidas');
 * } catch (error) {
 *   console.error('❌ Error:', error.message);
 * }
 * ```
 *
 * @throws {Error} Si las variables de entorno no son válidas
 */
export function validateEnvironment(): void {
  console.log('🔍 Validando variables de entorno...');

  const { error } = environmentSchema.validate(process.env);

  if (error) {
    console.error('❌ Error en variables de entorno:');
    error.details.forEach((detail: Joi.ValidationErrorItem) => {
      console.error(`   - ${detail.message}`);
    });

    console.error('\n💡 Variables requeridas:');
    console.error('   export GOOGLE_CLOUD_PROJECT=tu-proyecto-id');

    throw new Error('Variables de entorno inválidas');
  }
}

/**
 * Valida una URL individual de servicio
 *
 * @param envVar - Nombre de la variable de entorno
 * @param url - URL a validar
 * @returns La URL validada
 *
 * @example
 * ```typescript
 * const validUrl = validateServiceUrl('USERS_BACKEND_URL', 'https://api.example.com');
 * console.log(`URL válida: ${validUrl}`);
 * ```
 *
 * @throws {Error} Si la URL no es válida
 */
export function validateServiceUrl(envVar: string, url: string): string {
  const { error } = serviceUrlSchema.validate(url);

  if (error) {
    throw new Error(`${envVar} debe ser una URL válida (http/https): ${url}`);
  }

  return url;
}

/**
 * Muestra ejemplos de URLs válidas para ayudar al usuario
 *
 * @param serviceNames - Lista de nombres de servicios para generar ejemplos
 *
 * @example
 * ```typescript
 * showUrlExamples(['users', 'orders']);
 * // Imprime:
 * // 💡 Ejemplo de URLs válidas:
 * //    export USERS_BACKEND_URL=https://api-users-xxx.run.app/api
 * //    export ORDERS_BACKEND_URL=https://api-orders-xxx.run.app/api
 * ```
 */
export function showUrlExamples(serviceNames: string[]): void {
  console.error('\n💡 Ejemplo de URLs válidas:');
  serviceNames.forEach((serviceName) => {
    const envVar = `${serviceName.toUpperCase()}_BACKEND_URL`;
    console.error(
      `   export ${envVar}=https://api-${serviceName}-xxx.run.app/api`
    );
  });
}
