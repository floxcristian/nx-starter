/**
 * @fileoverview Servicio de carga dinámica de módulos NestJS
 *
 * Se encarga de cargar dinámicamente los módulos de las aplicaciones NestJS
 * para la extracción de configuración Swagger/OpenAPI.
 */

import { ServiceModule, ServiceConfig } from '../types/index';

/**
 * Posibles ubicaciones donde buscar módulos de aplicación
 */
const MODULE_PATHS = {
  /** Path del módulo principal de la aplicación */
  APP_MODULE: (serviceName: string) =>
    `/root/projects/study/nx-starter/apps/api-${serviceName}/src/app/app.module`,

  /** Path del módulo de dominio como fallback */
  DOMAIN_MODULE: (serviceName: string) =>
    `/root/projects/study/nx-starter/libs/${serviceName}-domain/src/lib/${serviceName}-domain.module`,
} as const;

/**
 * Carga dinámicamente el módulo de una aplicación NestJS
 *
 * Intenta cargar desde diferentes ubicaciones en orden de prioridad:
 * 1. Módulo principal de la app (apps/api-{service}/src/app/app.module)
 * 2. Módulo de dominio (libs/{service}-domain/src/lib/{service}-domain.module)
 *
 * @param serviceName - Nombre del servicio a cargar
 * @returns Promise que resuelve al módulo cargado
 *
 * @example
 * ```typescript
 * try {
 *   const module = await loadAppModule('users');
 *   console.log(`Módulo cargado: ${module.name}`);
 * } catch (error) {
 *   console.error('Error cargando módulo:', error.message);
 * }
 * ```
 *
 * @throws {Error} Si no se puede cargar el módulo desde ninguna ubicación
 */
export async function loadAppModule(
  serviceName: string
): Promise<ServiceModule> {
  const possiblePaths = [
    MODULE_PATHS.APP_MODULE(serviceName),
    MODULE_PATHS.DOMAIN_MODULE(serviceName),
  ];

  for (const modulePath of possiblePaths) {
    try {
      console.log(`   📦 Intentando cargar desde: ${modulePath}`);

      const moduleImport = await import(modulePath);
      const moduleClass = findModuleClass(moduleImport, serviceName);

      if (moduleClass) {
        console.log(`   ✅ Módulo cargado: ${moduleClass.name}`);
        return moduleClass;
      }
    } catch {
      console.log(`   ⚠️  Path no disponible: ${modulePath}`);
      continue;
    }
  }

  throw new Error(`No se pudo cargar módulo para el servicio: ${serviceName}`);
}

/**
 * Busca y extrae la clase del módulo desde el objeto importado
 *
 * @param moduleImport - Objeto resultado del import dinámico
 * @param serviceName - Nombre del servicio para generar nombres esperados
 * @returns Clase del módulo encontrada o null
 *
 * @example
 * ```typescript
 * const imported = await import('./some-module');
 * const ModuleClass = findModuleClass(imported, 'users');
 * // Busca: AppModule, UsersDomainModule, default, o cualquier *Module
 * ```
 */
function findModuleClass(
  moduleImport: Record<string, unknown>,
  serviceName: string
): ServiceModule | null {
  // Lista de nombres posibles para el módulo, en orden de prioridad
  const possibleNames = [
    'AppModule',
    `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}DomainModule`,
    'default',
  ];

  // Buscar por nombres específicos primero
  for (const name of possibleNames) {
    const moduleClass = moduleImport[name];
    if (isValidModuleClass(moduleClass)) {
      return moduleClass as ServiceModule;
    }
  }

  // Buscar cualquier export que termine en 'Module'
  const moduleClass = Object.values(moduleImport).find(
    (exp) =>
      isValidModuleClass(exp) &&
      typeof exp === 'function' &&
      exp.name &&
      exp.name.includes('Module')
  );

  return moduleClass ? (moduleClass as ServiceModule) : null;
}

/**
 * Verifica si un valor exportado es una clase de módulo válida
 *
 * @param value - Valor a verificar
 * @returns true si es una clase de módulo válida
 */
function isValidModuleClass(value: unknown): boolean {
  return (
    typeof value === 'function' &&
    'name' in value &&
    typeof value.name === 'string' &&
    value.name.length > 0
  );
}

/**
 * Carga todos los módulos para una lista de servicios
 *
 * @param services - Array de configuraciones de servicios
 * @returns Promise que resuelve cuando todos los módulos están cargados
 *
 * @example
 * ```typescript
 * const services = [
 *   { name: 'users', title: 'Users API', ... },
 *   { name: 'orders', title: 'Orders API', ... }
 * ];
 *
 * await loadAllModules(services);
 * console.log('Todos los módulos cargados');
 * ```
 *
 * @throws {Error} Si falla la carga de cualquier módulo
 */
export async function loadAllModules(services: ServiceConfig[]): Promise<void> {
  console.log('📦 Cargando módulos de aplicación...');

  for (const service of services) {
    try {
      service.module = await loadAppModule(service.name);
      console.log(`   ✅ ${service.title} cargado correctamente`);
    } catch (error) {
      console.error(`   ❌ Error cargando ${service.title}:`, error);
      throw error;
    }
  }
}
