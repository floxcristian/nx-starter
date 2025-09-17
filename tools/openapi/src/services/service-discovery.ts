/**
 * @fileoverview Servicio de descubrimiento automático de APIs
 *
 * Se encarga de descubrir automáticamente los servicios API disponibles
 * basándose en variables de entorno y estructura de archivos del proyecto.
 */

import * as fs from 'fs';
import { ServiceConfig, ValidatedServiceUrls } from '../types/index';
import {
  validateServiceUrl,
  showUrlExamples,
} from '../validators/environment-validator';

/**
 * Descubre automáticamente los servicios API disponibles en el workspace
 *
 * Busca variables de entorno que terminen en '_BACKEND_URL' y verifica
 * que existan las aplicaciones correspondientes en el filesystem.
 *
 * @returns Array de configuraciones de servicios descubiertos
 *
 * @example
 * ```typescript
 * // Con USERS_BACKEND_URL=https://api.example.com/users
 * // y apps/api-users/ existente
 * const services = discoverServices();
 * console.log(services);
 * // [{ name: 'users', urlEnvVar: 'USERS_BACKEND_URL', ... }]
 * ```
 *
 * @throws {Error} Si no se encuentran servicios configurados
 */
export function discoverServices(): ServiceConfig[] {
  console.log('🔍 Auto-descubriendo servicios API...');

  const services: ServiceConfig[] = [];
  const envVars = process.env;

  // Patrón para identificar variables de URL de backend
  const backendUrlPattern = /^(.+)_BACKEND_URL$/;

  Object.keys(envVars).forEach((envKey) => {
    const match = envKey.match(backendUrlPattern);

    if (match && envVars[envKey]) {
      const serviceName = match[1].toLowerCase();
      const serviceUrl = envVars[envKey];

      // Verificar que existe la aplicación correspondiente
      if (isServiceAppAvailable(serviceName)) {
        services.push(createServiceConfig(serviceName, envKey));
        console.log(`   ✅ ${serviceName}: ${serviceUrl}`);
      } else {
        console.log(
          `   ⚠️  ${serviceName}: App no encontrada en apps/api-${serviceName}`
        );
      }
    }
  });

  if (services.length === 0) {
    console.error('❌ No se encontraron servicios API configurados.');
    console.error('💡 Para que el auto-discovery funcione, necesitas:');
    console.error(
      '   1. Apps que empiecen con "api-" en apps/ (ej: apps/api-users)'
    );
    console.error(
      '   2. Variables de entorno *_BACKEND_URL (ej: USERS_BACKEND_URL)'
    );
    console.error('   3. Módulo app.module.ts en src/app/ de cada API');
    throw new Error('No se encontraron servicios API');
  }

  return services;
}

/**
 * Verifica si existe una aplicación de servicio en el filesystem
 *
 * @param serviceName - Nombre del servicio a verificar
 * @returns true si la aplicación existe
 *
 * @example
 * ```typescript
 * const exists = isServiceAppAvailable('users');
 * // Verifica si existe apps/api-users/src/app/app.module.ts
 * ```
 */
function isServiceAppAvailable(serviceName: string): boolean {
  const appPath = `apps/api-${serviceName}`;
  const appModulePath = `${appPath}/src/app/app.module.ts`;

  try {
    return fs.existsSync(appModulePath);
  } catch (error) {
    console.log(
      `   ❌ ${serviceName}: Error verificando app - ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return false;
  }
}

/**
 * Crea la configuración para un servicio específico
 *
 * @param serviceName - Nombre del servicio
 * @param urlEnvVar - Variable de entorno que contiene la URL
 * @returns Configuración del servicio
 *
 * @example
 * ```typescript
 * const config = createServiceConfig('users', 'USERS_BACKEND_URL');
 * console.log(config.title); // "Users API"
 * console.log(config.pathPrefix); // "/users"
 * ```
 */
function createServiceConfig(
  serviceName: string,
  urlEnvVar: string
): ServiceConfig {
  return {
    name: serviceName,
    module: null, // Se carga dinámicamente más tarde
    urlEnvVar: urlEnvVar,
    pathPrefix: `/${serviceName}`,
    title: `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} API`,
  };
}

/**
 * Valida las URLs de todos los servicios descubiertos
 *
 * @param services - Array de configuraciones de servicios
 * @returns Objeto con las URLs validadas mapeadas por variable de entorno
 *
 * @example
 * ```typescript
 * const services = discoverServices();
 * const validUrls = validateServiceUrls(services);
 * console.log(validUrls['USERS_BACKEND_URL']); // "https://api.example.com/users"
 * ```
 *
 * @throws {Error} Si alguna URL no es válida
 */
export function validateServiceUrls(
  services: ServiceConfig[]
): ValidatedServiceUrls {
  console.log('🔍 Validando URLs de servicios...');

  const envVars: ValidatedServiceUrls = {};
  const errors: string[] = [];

  for (const service of services) {
    const value = process.env[service.urlEnvVar];

    if (!value) {
      errors.push(`${service.urlEnvVar} es requerida`);
      continue;
    }

    try {
      envVars[service.urlEnvVar] = validateServiceUrl(service.urlEnvVar, value);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) {
    console.error('❌ Errores en URLs de servicios:');
    errors.forEach((error) => {
      console.error(`   - ${error}`);
    });

    // Mostrar ejemplos útiles
    const serviceNames = services.map((s) => s.name);
    showUrlExamples(serviceNames);

    throw new Error('URLs de servicios inválidas');
  }

  return envVars;
}

/**
 * Muestra un resumen de los servicios descubiertos
 *
 * @param services - Array de configuraciones de servicios
 * @param serviceUrls - URLs validadas de los servicios
 *
 * @example
 * ```typescript
 * const services = discoverServices();
 * const urls = validateServiceUrls(services);
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
