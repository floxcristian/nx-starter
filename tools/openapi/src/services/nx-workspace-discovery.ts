/**
 * @fileoverview Generador avanzado de OpenAPI unificado
 *
 * Descubre automáticamente APIs y librerías usando el workspace de Nx,
 * genera specs individuales y los combina en un único archivo Swagger 2.0
 * optimizado para Google Cloud API Gateway.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { ServiceConfig } from '../types/index';
import { ControllerAnalyzer, type ControllerInfo } from './controller-analyzer';

interface ApiProject {
  name: string;
  path: string;
  type: 'application' | 'library';
  serviceUrl?: string;
  basePath?: string;
  dependencies: string[];
}

interface InternalServiceConfig {
  url: string;
  basePath: string;
  name: string;
  envVar: string;
}

interface NxProjectConfig {
  name: string;
  root: string;
  projectType: 'application' | 'library';
  implicitDependencies?: string[];
}

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers?: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
  };
  tags: Array<{ name: string }>;
  dependencies?: string[];
}

export class NxBasedOpenApiGenerator {
  private workspaceRoot: string;
  private projects: Map<string, NxProjectConfig> = new Map();
  private serviceConfigs: Map<string, InternalServiceConfig> = new Map();
  private apiProjects: ApiProject[] = [];

  constructor() {
    this.workspaceRoot = process.cwd();
    this.loadNxWorkspace();
    this.loadServiceConfigurations();
  }

  /**
   * Cargar la configuración del workspace de Nx
   */
  private loadNxWorkspace(): void {
    console.log('📋 Cargando configuración del workspace Nx...');

    // Intentar cargar nx.json
    const nxJsonPath = join(this.workspaceRoot, 'nx.json');
    if (existsSync(nxJsonPath)) {
      console.log(`   ✅ nx.json encontrado`);
    }

    // Usar nx para obtener la configuración de proyectos
    try {
      const projectsOutput = execSync('npx nx show projects --json', {
        encoding: 'utf8',
        cwd: this.workspaceRoot,
      });

      const projectNames = JSON.parse(projectsOutput);

      for (const projectName of projectNames) {
        try {
          const projectConfigOutput = execSync(
            `npx nx show project ${projectName} --json`,
            {
              encoding: 'utf8',
              cwd: this.workspaceRoot,
            }
          );

          const projectConfig = JSON.parse(projectConfigOutput);
          this.projects.set(projectName, projectConfig);
          console.log(
            `   ✅ ${projectName}: ${projectConfig.projectType || 'unknown'}`
          );
        } catch {
          console.warn(
            `   ⚠️  No se pudo cargar configuración de ${projectName}`
          );
        }
      }
    } catch (error) {
      console.error('❌ Error cargando proyectos de Nx:', error);
      throw new Error('No se pudo cargar la configuración del workspace');
    }
  }

  /**
   * Cargar configuraciones de servicios desde variables de entorno
   */
  private loadServiceConfigurations(): void {
    console.log('🔍 Buscando configuraciones de servicios...');

    const envVars = process.env;
    const backendUrlPattern = /^(.+)_BACKEND_URL$/;

    for (const [key, value] of Object.entries(envVars)) {
      const match = key.match(backendUrlPattern);

      if (match && value) {
        const envPrefix = match[1]; // ej: "USERS", "ORDERS_DETAIL"
        const serviceName = envPrefix.toLowerCase().replace(/_/g, '-'); // "users", "orders-detail"

        // Buscar el proyecto correspondiente (puede ser api-users, api-orders-detail, etc)
        const matchingProject = this.findMatchingApiProject(serviceName);

        if (matchingProject) {
          const basePath = `/${serviceName.replace(/^api-/, '')}`;

          this.serviceConfigs.set(matchingProject, {
            url: value,
            basePath,
            name: serviceName,
            envVar: key,
          });

          console.log(`   ✅ ${matchingProject}: ${value} (${key})`);
        } else {
          console.warn(
            `   ⚠️  Variable ${key} encontrada pero no hay proyecto API correspondiente`
          );
        }
      }
    }
  }

  /**
   * Buscar proyecto API que coincida con el nombre del servicio
   */
  private findMatchingApiProject(serviceName: string): string | null {
    // Buscar coincidencia exacta primero (excluyendo -e2e)
    const exactMatch = `api-${serviceName}`;
    if (this.projects.has(exactMatch) && !exactMatch.endsWith('-e2e')) {
      return exactMatch;
    }

    // Buscar coincidencias parciales (ej: orders-detail podría coincidir con api-orders-detail)
    for (const [projectName, config] of Array.from(this.projects.entries())) {
      if (
        projectName.startsWith('api-') &&
        !projectName.endsWith('-e2e') &&
        config.projectType === 'application' &&
        (projectName.includes(serviceName) ||
          serviceName.includes(projectName.replace('api-', '')))
      ) {
        return projectName;
      }
    }

    return null;
  }

  /**
   * Descubrir proyectos API y sus dependencias
   */
  private discoverApiProjects(): void {
    console.log('🔍 Descubriendo proyectos API y dependencias...');

    for (const [projectName, projectConfig] of Array.from(
      this.projects.entries()
    )) {
      // Solo procesar aplicaciones que empiecen con 'api-' pero NO terminen con '-e2e'
      if (
        projectName.startsWith('api-') &&
        !projectName.endsWith('-e2e') &&
        projectConfig.projectType === 'application'
      ) {
        const serviceConfig = this.serviceConfigs.get(projectName);
        const dependencies = this.getProjectDependencies(projectName);

        this.apiProjects.push({
          name: projectName,
          path: projectConfig.root || `apps/${projectName}`,
          type: 'application',
          serviceUrl: serviceConfig?.url,
          basePath:
            serviceConfig?.basePath || `/${projectName.replace('api-', '')}`,
          dependencies,
        });

        console.log(`   ✅ ${projectName}`);
        console.log(`      🔗 URL: ${serviceConfig?.url || 'no configurada'}`);
        console.log(
          `      📦 Dependencias: ${dependencies.join(', ') || 'ninguna'}`
        );
      }
    }
  }

  /**
   * Obtener dependencias de un proyecto usando Nx (versión simplificada)
   */
  private getProjectDependencies(projectName: string): string[] {
    try {
      // Usar command de Nx para obtener dependencias directamente
      const depsOutput = execSync(`npx nx show project ${projectName} --json`, {
        encoding: 'utf8',
        cwd: this.workspaceRoot,
      });

      // Parsear la salida que incluye tanto project details como dependencies
      const lines = depsOutput.split('\n');

      // Buscar línea que contenga "Project Dependencies:"
      const depsLineIndex = lines.findIndex((line) =>
        line.includes('Project Dependencies:')
      );

      if (depsLineIndex >= 0 && depsLineIndex < lines.length - 1) {
        const depsLine = lines[depsLineIndex];
        const depsMatch = depsLine.match(/Project Dependencies:\s*(.+)/);

        if (depsMatch && depsMatch[1] && depsMatch[1].trim() !== '') {
          const dependencies = depsMatch[1].split(',').map((dep) => dep.trim());
          return dependencies.filter((dep) => dep && !dep.startsWith('npm:'));
        }
      }

      return [];
    } catch (error) {
      console.warn(
        `   ⚠️  No se pudieron obtener dependencias de ${projectName}:`,
        error
      );
      return [];
    }
  }

  /**
   * Generar specs individuales para cada API
   */
  private async generateIndividualSpecs(): Promise<
    Record<string, OpenApiSpec>
  > {
    console.log('📊 Generando especificaciones individuales...');

    const specs: Record<string, OpenApiSpec> = {};

    for (const project of this.apiProjects) {
      try {
        console.log(`   🔧 Procesando ${project.name}...`);

        // Intentar cargar el módulo principal
        const spec = await this.extractSwaggerFromProject(project);

        if (spec) {
          specs[project.name] = spec;
          console.log(`   ✅ ${project.name} completado`);
        } else {
          console.warn(`   ⚠️  No se pudo generar spec para ${project.name}`);
        }
      } catch (error) {
        console.error(`   ❌ Error procesando ${project.name}:`, error);
      }
    }

    return specs;
  }

  /**
   * Extraer configuración Swagger de un proyecto usando análisis estático
   */
  private async extractSwaggerFromProject(
    project: ApiProject
  ): Promise<OpenApiSpec> {
    console.log(`   🔍 Analizando controladores para ${project.name}...`);

    // Analizar controladores en todas las librerías de dominio disponibles
    const allControllers: ControllerInfo[] = [];

    // Buscar en todas las librerías
    for (const [libName, libProject] of Array.from(this.projects.entries())) {
      if (libProject.projectType === 'library') {
        const libPath = join(this.workspaceRoot, libProject.root);
        const controllers =
          ControllerAnalyzer.analyzeProjectControllers(libPath);
        if (controllers.length > 0) {
          allControllers.push(...controllers);
          console.log(
            `     📦 ${libName}: ${controllers.length} controladores encontrados`
          );
        }
      }
    }

    // También analizar el proyecto principal por si acaso
    const projectPath = join(this.workspaceRoot, project.path);
    const projectControllers =
      ControllerAnalyzer.analyzeProjectControllers(projectPath);
    allControllers.push(...projectControllers);

    // Crear spec OpenAPI con rutas reales
    const spec: OpenApiSpec = {
      openapi: '3.0.0',
      info: {
        title: `${project.name} API`,
        version: '1.0.0',
        description: `Auto-generated API documentation for ${project.name}`,
      },
      paths: this.buildPathsFromControllers(
        allControllers,
        project.basePath || ''
      ),
      components: {
        schemas: {},
      },
      tags: this.extractTagsFromControllers(allControllers, project.name),
      dependencies: project.dependencies,
      servers: project.serviceUrl
        ? [
            {
              url: project.serviceUrl,
              description: `${project.name} service`,
            },
          ]
        : undefined,
    };

    console.log(
      `   ✅ ${project.name}: ${Object.keys(spec.paths).length} rutas generadas`
    );
    return spec;
  }

  /**
   * Construir paths de OpenAPI desde información de controladores
   */
  private buildPathsFromControllers(
    controllers: ControllerInfo[],
    serviceBasePath: string
  ): Record<string, unknown> {
    const paths: Record<string, unknown> = {};

    // Añadir ruta de health check
    const healthPath = `${serviceBasePath}/health`;
    paths[healthPath] = {
      get: {
        summary: 'Health check',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        tags: ['health'],
      },
    };

    // Procesar rutas de controladores
    for (const controller of controllers) {
      for (const route of controller.routes) {
        // Convertir parámetros de path de Express (:id) a OpenAPI ({id})
        const openApiPath = route.path.replace(/:(\w+)/g, '{$1}');
        const fullPath = openApiPath.startsWith('/')
          ? openApiPath
          : `/${openApiPath}`;

        if (!paths[fullPath]) {
          paths[fullPath] = {};
        }

        // Construir definición de operación
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const operation: Record<string, any> = {
          summary:
            route.summary || `${route.method.toUpperCase()} ${route.path}`,
          operationId:
            route.operationId ||
            `${route.method}${route.path.replace(/[/{}:]/g, '_')}`,
          tags: route.tags || ['default'],
          responses: {},
        };

        // Añadir parámetros
        if (route.parameters && route.parameters.length > 0) {
          operation['parameters'] = route.parameters.map((param) => ({
            name: param.name,
            in: param.in,
            required: param.required || false,
            schema: {
              type: param.type || 'string',
            },
            description: param.description,
          }));
        }

        // Añadir request body para métodos que lo requieren
        if (['post', 'put', 'patch'].includes(route.method)) {
          const bodyParam = route.parameters?.find((p) => p.in === 'body');
          if (bodyParam) {
            operation['requestBody'] = {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                  },
                },
              },
            };
          }
        }

        // Añadir respuestas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responses: Record<string, any> = {};
        if (route.responses && route.responses.length > 0) {
          for (const response of route.responses) {
            responses[response.statusCode] = {
              description: response.description,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                  },
                },
              },
            };
          }
        } else {
          // Respuesta por defecto
          responses['200'] = {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
              },
            },
          };
        }
        operation['responses'] = responses;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (paths[fullPath] as Record<string, any>)[route.method] = operation;
      }
    }

    return paths;
  }

  /**
   * Extraer tags desde controladores
   */
  private extractTagsFromControllers(
    controllers: ControllerInfo[],
    projectName: string
  ): Array<{ name: string }> {
    const tags = new Set<string>();

    // Añadir tag de health
    tags.add('health');

    // Extraer tags de controladores
    for (const controller of controllers) {
      if (controller.tags) {
        controller.tags.forEach((tag) => tags.add(tag));
      }

      // También añadir tags de rutas individuales
      for (const route of controller.routes) {
        if (route.tags) {
          route.tags.forEach((tag) => tags.add(tag));
        }
      }
    }

    // Si no hay tags, usar el nombre del proyecto
    if (tags.size === 1) {
      // Solo 'health'
      tags.add(projectName.replace('api-', ''));
    }

    return Array.from(tags).map((name) => ({ name }));
  }

  /**
   * Generar configuraciones de servicios compatibles con el sistema existente
   */
  generateServiceConfigs(): ServiceConfig[] {
    this.discoverApiProjects();

    const services: ServiceConfig[] = [];

    for (const project of this.apiProjects) {
      if (project.serviceUrl) {
        // Solo incluir servicios con URL configurada
        services.push({
          name: project.name.replace('api-', ''),
          urlEnvVar: this.findEnvVarForProject(project.name),
          pathPrefix:
            project.basePath || `/${project.name.replace('api-', '')}`,
          title: this.generateTitle(project.name),
        });
      }
    }

    return services;
  }

  /**
   * Encontrar variable de entorno para un proyecto
   */
  private findEnvVarForProject(projectName: string): string {
    for (const [envVar, config] of Array.from(this.serviceConfigs.entries())) {
      if (envVar === projectName) {
        return config.envVar;
      }
    }

    // Fallback: generar nombre esperado
    const cleanName = projectName
      .replace('api-', '')
      .replace(/-/g, '_')
      .toUpperCase();
    return `${cleanName}_BACKEND_URL`;
  }

  /**
   * Generar título legible para un servicio
   */
  private generateTitle(projectName: string): string {
    return (
      projectName
        .replace('api-', '')
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') + ' API'
    );
  }

  /**
   * Método principal (mantenido para compatibilidad)
   */
  async generate(): Promise<Record<string, OpenApiSpec>> {
    console.log(
      '🚀 Iniciando generación de OpenAPI unificado (basado en Nx)...'
    );
    console.log(`🌍 Workspace: ${this.workspaceRoot}`);

    // 1. Descubrir proyectos API automáticamente
    this.discoverApiProjects();
    console.log(`📊 Encontrados ${this.apiProjects.length} proyectos API`);
    console.log(
      `🔗 Configurados ${this.serviceConfigs.size} servicios con URLs`
    );

    if (this.apiProjects.length === 0) {
      throw new Error('No se encontraron proyectos API para procesar');
    }

    // 2. Generar specs individuales
    const individualSpecs = await this.generateIndividualSpecs();

    console.log(
      `✅ Generación completada con ${
        Object.keys(individualSpecs).length
      } specs`
    );

    return individualSpecs;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  new NxBasedOpenApiGenerator().generate().catch(console.error);
}
