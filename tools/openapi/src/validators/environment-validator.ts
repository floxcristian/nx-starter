/**
 * @fileoverview Validador de variables de entorno
 *
 * Contiene esquemas y funciones de validación para las variables de entorno
 * requeridas por el generador de OpenAPI. Utiliza Joi para validación robusta.
 */

import * as Joi from 'joi';

/**
 * Esquema de validación para URLs de servicios individuales
 */
export const serviceUrlSchema = Joi.string()
  .uri({ scheme: ['http', 'https'] })
  .required();

/**
 * Valida que las variables de entorno necesarias estén presentes
 *
 * @throws {Error} Si faltan variables requeridas
 */
export function validateEnvironment(): void {
  console.log('🔍 Validando variables de entorno...');

  const requiredVars = [
    'GOOGLE_CLOUD_PROJECT',
    'OPENAPI_OUTPUT_FILE',
    'GATEWAY_TITLE',
    'GATEWAY_DESCRIPTION',
    'GATEWAY_VERSION',
    'BACKEND_PROTOCOL',
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Faltan variables de entorno requeridas:');
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 Variables requeridas:');
    console.error('   export GOOGLE_CLOUD_PROJECT=tu-proyecto-id');
    console.error('   export OPENAPI_OUTPUT_FILE=openapi-gateway.yaml');
    console.error('   export GATEWAY_TITLE="Mi API Gateway"');
    console.error('   export GATEWAY_DESCRIPTION="Descripción del gateway"');
    console.error('   export GATEWAY_VERSION=1.0.0');
    console.error('   export BACKEND_PROTOCOL=https');
    process.exit(1);
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
