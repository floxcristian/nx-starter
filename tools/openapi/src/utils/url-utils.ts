/**
 * @fileoverview Utilidades para manejo de URLs
 *
 * Proporciona funciones de utilidad para validar, normalizar
 * y trabajar con URLs de servicios backend.
 */

/**
 * Normaliza una URL removiendo barras finales innecesarias
 *
 * @param url - URL a normalizar
 * @returns URL normalizada
 *
 * @example
 * ```typescript
 * const normalized = normalizeUrl('https://api.example.com/v1/');
 * console.log(normalized); // 'https://api.example.com/v1'
 * ```
 */
export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Verifica si una URL tiene un protocolo válido (http/https)
 *
 * @param url - URL a verificar
 * @returns true si el protocolo es válido
 *
 * @example
 * ```typescript
 * console.log(hasValidProtocol('https://api.example.com')); // true
 * console.log(hasValidProtocol('ftp://files.example.com')); // false
 * ```
 */
export function hasValidProtocol(url: string): boolean {
  return /^https?:\/\//.test(url);
}

/**
 * Extrae el hostname de una URL
 *
 * @param url - URL de la cual extraer el hostname
 * @returns Hostname extraído o null si la URL es inválida
 *
 * @example
 * ```typescript
 * const host = extractHostname('https://api.example.com:8080/path');
 * console.log(host); // 'api.example.com'
 * ```
 */
export function extractHostname(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Combina una URL base con un path adicional
 *
 * @param baseUrl - URL base
 * @param path - Path a añadir
 * @returns URL combinada
 *
 * @example
 * ```typescript
 * const combined = combineUrlPath('https://api.example.com', '/users');
 * console.log(combined); // 'https://api.example.com/users'
 * ```
 */
export function combineUrlPath(baseUrl: string, path: string): string {
  const normalizedBase = normalizeUrl(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Verifica si una URL es accesible (formato válido y protocolo correcto)
 *
 * @param url - URL a verificar
 * @returns true si la URL parece válida
 *
 * @example
 * ```typescript
 * console.log(isValidUrl('https://api.example.com')); // true
 * console.log(isValidUrl('not-a-url')); // false
 * ```
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

/**
 * Genera ejemplos de URLs para un servicio específico
 *
 * @param serviceName - Nombre del servicio
 * @returns Array de URLs de ejemplo
 *
 * @example
 * ```typescript
 * const examples = generateUrlExamples('users');
 * console.log(examples);
 * // [
 * //   'https://api-users-123.run.app/api',
 * //   'https://users-api.example.com/v1',
 * //   'http://localhost:3001/api'
 * // ]
 * ```
 */
export function generateUrlExamples(serviceName: string): string[] {
  return [
    `https://api-${serviceName}-123.run.app/api`,
    `https://${serviceName}-api.example.com/v1`,
    `http://localhost:3001/api`,
  ];
}

/**
 * Valida que una URL sea apropiada para un entorno de producción
 *
 * @param url - URL a validar
 * @returns true si es apropiada para producción
 *
 * @example
 * ```typescript
 * console.log(isProductionUrl('https://api.example.com')); // true
 * console.log(isProductionUrl('http://localhost:3000')); // false
 * ```
 */
export function isProductionUrl(url: string): boolean {
  if (!isValidUrl(url)) {
    return false;
  }

  const hostname = extractHostname(url);
  if (!hostname) {
    return false;
  }

  // Verificar que no sea localhost ni IPs locales
  const localPatterns = [
    /^localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  ];

  return !localPatterns.some((pattern) => pattern.test(hostname));
}
