/**
 * @fileoverview Utilidades para validación y manejo de URLs
 *
 * Contiene funciones reutilizables para validar URLs de servicios
 * y generar ejemplos de ayuda para el usuario.
 */

import * as Joi from 'joi';

/**
 * Esquema de validación para URLs de servicios individuales
 */
export const serviceUrlSchema = Joi.string()
  .uri({ scheme: ['http', 'https'] })
  .required();

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
