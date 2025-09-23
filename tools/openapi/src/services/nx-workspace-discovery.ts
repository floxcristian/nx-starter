/**
 * @fileoverview Generador de OpenAPI basado en el workspace de Nx.
 *
 * Descubre automáticamente APIs y librerías usando el grafo de proyectos de Nx,
 * para luego delegar el análisis de controladores y la generación de specs.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { ServiceConfig } from '../types/index';
import {
  ControllerAnalyzer,
  type ControllerInfo,
  type SchemaObject,
} from './controller-analyzer';
import type { OpenAPIV3 } from 'openapi-types';

// --- Type Definitions for Swagger 2.0 --- //

/** Representa un parámetro en una operación de Swagger 2.0. */
interface SwaggerParameter {
  name: string;
  in: 'path' | 'query' | 'body' | 'header' | 'formData';
  required?: boolean;
  description?: string;
  schema?: SchemaObject | OpenAPIV3.ReferenceObject;
  [key: string]: unknown; // For other properties like 'type', 'format', etc.
}

/** Representa una respuesta en una operación de Swagger 2.0. */
interface SwaggerResponse {
  description: string;
  schema?: SchemaObject | OpenAPIV3.ReferenceObject;
}

/** Representa una operación (un método en una ruta) en Swagger 2.0. */
interface SwaggerOperation {
  summary?: string;
  operationId?: string;
  tags?: string[];
  parameters?: SwaggerParameter[];
  responses: Record<string, SwaggerResponse>;
  [key: string]: unknown; // For extensions like x-google-backend
}

// --- Nx-specific Interfaces --- //

/**
 * Define la estructura del grafo de proyectos generado por `nx graph`.
 */
interface NxProjectGraph {
  nodes: Record<
    string,
    {
      name: string;
      type: 'app' | 'lib' | 'e2e';
      data: {
        root: string;
        projectType: 'application' | 'library';
        tags?: string[];
      };
    }
  >;
  dependencies: Record<
    string,
    Array<{
      source: string;
      target: string;
      type: 'static' | 'dynamic' | 'implicit';
    }>
  >;
}

/** Representa un proyecto de API descubierto en el workspace. */
interface ApiProject {
  name: string;
  path: string;
  type: 'application' | 'library';
  serviceUrl?: string;
  basePath?: string;
  dependencies: string[];
}

/** Configuración interna de un servicio, mapeando URL y nombre. */
interface InternalServiceConfig {
  url: string;
  basePath: string;
  name: string;
  envVar: string;
}

/** Representa la configuración de un proyecto Nx. */
interface NxProjectConfig {
  name: string;
  root: string;
  projectType: 'application' | 'library';
  implicitDependencies?: string[];
  tags?: string[];
}

/** Representa una especificación OpenAPI para un único servicio. */
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
  paths: OpenAPIV3.PathsObject;
  components: {
    schemas: Record<string, SchemaObject | OpenAPIV3.ReferenceObject>;
    securitySchemes?: Record<
      string,
      OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject
    >;
  };
  tags: Array<{ name: string }>;
  dependencies?: string[];
}

/**
 * Clase principal para descubrir APIs y generar especificaciones OpenAPI
 * a partir de un workspace de Nx.
 */
export class NxBasedOpenApiGenerator {
  private workspaceRoot: string;
  private projects: Map<string, NxProjectConfig> = new Map();
  private projectGraph: NxProjectGraph | null = null;
  private serviceConfigs: Map<string, InternalServiceConfig> = new Map();
  private apiProjects: ApiProject[] = [];

  constructor() {
    this.workspaceRoot = process.cwd();
    this.loadNxWorkspace();
    this.loadServiceConfigurations();
  }

  /**
   * Carga la configuración del workspace de Nx de forma eficiente generando y leyendo el grafo de proyectos.
   */
  private loadNxWorkspace(): void {
    console.log('📋 Cargando configuración del workspace Nx...');
    const graphOutputFile = join(this.workspaceRoot, 'dist', 'project-graph.json');

    try {
      console.log('   ⏳ Generando grafo de proyectos de Nx...');
      execSync(`npx nx graph --file=${graphOutputFile}`, {
        encoding: 'utf8',
        cwd: this.workspaceRoot,
        stdio: 'pipe',
      });
      console.log(`   ✅ Grafo de proyectos guardado en ${graphOutputFile}`);

      const graphOutput = readFileSync(graphOutputFile, 'utf8');
      let graphData = JSON.parse(graphOutput);

      if (graphData.graph) {
        graphData = graphData.graph;
      }

      if (!graphData.nodes || !graphData.dependencies) {
        throw new Error(
          'El formato del grafo de proyectos no es válido o está vacío.'
        );
      }
      this.projectGraph = graphData;

      if (this.projectGraph && this.projectGraph.nodes) {
        for (const projectName in this.projectGraph.nodes) {
          const projectNode = this.projectGraph.nodes[projectName];
          const projectData = projectNode.data;

          this.projects.set(projectName, {
            name: projectNode.name,
            root: projectData.root,
            projectType: projectData.projectType,
            tags: projectData.tags || [],
          });
          console.log(
            `   ✅ ${projectNode.name}: ${projectData.projectType || 'unknown'}`
          );
        }
      }
    } catch (error) {
      console.error('❌ Error cargando el grafo de proyectos de Nx:', error);
      throw new Error(
        'No se pudo cargar la configuración del workspace de Nx.'
      );
    }
  }

  /**
   * Carga las configuraciones de servicios (URLs) a partir de las variables de entorno.
   */
  private loadServiceConfigurations(): void {
    console.log('🔍 Buscando configuraciones de servicios...');

    const envVars = process.env;
    const backendUrlPattern = /^(.+)_BACKEND_URL$/;

    for (const [key, value] of Object.entries(envVars)) {
      const match = key.match(backendUrlPattern);

      if (match && value) {
        const envPrefix = match[1];
        const serviceName = envPrefix.toLowerCase().replace(/_/g, '-');

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
   * Busca un proyecto de API que coincida con un nombre de servicio derivado de una variable de entorno.
   * @param serviceName El nombre del servicio (ej. 'users', 'orders-detail').
   * @returns El nombre del proyecto correspondiente (ej. 'api-users') o null.
   */
  private findMatchingApiProject(serviceName: string): string | null {
    const exactMatch = `api-${serviceName}`;
    if (this.projects.has(exactMatch) && !exactMatch.endsWith('-e2e')) {
      return exactMatch;
    }

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
   * Descubre los proyectos de API basándose en sus tags y prepara su configuración.
   */
  private discoverApiProjects(): void {
    console.log('🔍 Descubriendo proyectos API y dependencias...');

    for (const [projectName, projectConfig] of Array.from(
      this.projects.entries()
    )) {
      if (
        projectConfig.projectType === 'application' &&
        projectConfig.tags?.includes('scope:gcp-gateway')
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
   * Obtiene las dependencias de un proyecto a partir del grafo de Nx ya cargado.
   * @param projectName El nombre del proyecto.
   * @returns Un array con los nombres de sus dependencias (excluyendo paquetes de npm).
   */
  private getProjectDependencies(projectName: string): string[] {
    if (!this.projectGraph || !this.projectGraph.dependencies) {
      console.warn(`   ⚠️  No se pudo encontrar el grafo de dependencias.`);
      return [];
    }

    const projectDependencies = this.projectGraph.dependencies[projectName];

    if (!projectDependencies) {
      return [];
    }

    return projectDependencies
      .map((dep) => dep.target)
      .filter((depName) => !depName.startsWith('npm:'));
  }

  /**
   * Genera las especificaciones OpenAPI individuales para cada API descubierta.
   * @returns Un record donde las claves son los nombres de los proyectos y los valores son sus OpenApiSpec.
   */
  public async generateIndividualSpecs(): Promise<
    Record<string, OpenApiSpec>
  > {
    console.log('📊 Generando especificaciones individuales...');

    const specs: Record<string, OpenApiSpec> = {};

    for (const project of this.apiProjects) {
      try {
        console.log(`   🔧 Procesando ${project.name}...`);

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
   * Extrae la configuración Swagger de un proyecto usando el analizador estático.
   * @param project El proyecto de API a analizar.
   * @returns La especificación OpenAPI para ese proyecto.
   */
  private async extractSwaggerFromProject(
    project: ApiProject
  ): Promise<OpenApiSpec> {
    console.log(`   🔍 Analizando controladores para ${project.name}...`);

    const allControllers: ControllerInfo[] = [];

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

    const projectPath = join(this.workspaceRoot, project.path);
    const projectControllers =
      ControllerAnalyzer.analyzeProjectControllers(projectPath);
    allControllers.push(...projectControllers);

    const allSchemas: Record<string, SchemaObject | OpenAPIV3.ReferenceObject> = {};
    for (const controllerInfo of allControllers) {
      Object.assign(allSchemas, controllerInfo.schemas);
    }

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
        schemas: allSchemas,
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
   * Construye el objeto `paths` de OpenAPI a partir de la información de los controladores.
   * @param controllers La información extraída de los controladores.
   * @param serviceBasePath El path base del servicio.
   * @returns Un objeto `paths` para la especificación OpenAPI.
   */
  private buildPathsFromControllers(
    controllers: ControllerInfo[],
    serviceBasePath: string
  ): Record<string, Record<string, SwaggerOperation>> {
    const paths: Record<string, Record<string, SwaggerOperation>> = {};

    const healthPath = `${serviceBasePath}/health`;
    paths[healthPath] = {
      get: {
        summary: 'Health check',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Service is healthy',
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'ok' },
                service: { type: 'string' },
              },
            },
          },
        },
        tags: ['health'],
      },
    };

    for (const controller of controllers) {
      for (const route of controller.routes) {
        const openApiPath = route.path.replace(/:(\w+)/g, '{$1}');
        const fullPath = openApiPath.startsWith('/')
          ? openApiPath
          : `/${openApiPath}`;

        if (!paths[fullPath]) {
          paths[fullPath] = {};
        }

        const operation: SwaggerOperation = {
          summary:
            route.summary || `${route.method.toUpperCase()} ${route.path}`,
          operationId:
            route.operationId ||
            `${route.method}${route.path.replace(/[/{}:]/g, '_')}`,
          tags: route.tags || ['default'],
          responses: {},
        };

        if (route.parameters && route.parameters.length > 0) {
          operation.parameters = route.parameters.map((param) => {
            // Los parámetros 'body' anidan el schema.
            if (param.in === 'body') {
              return {
                name: param.name,
                in: param.in,
                required: param.required,
                description: param.description,
                schema: param.schema,
              };
            }

            // Los parámetros que no son 'body' (path, query) tienen las propiedades
            // del schema al nivel superior (según la especificación Swagger 2.0).
            const { schema, ...baseParam } = param;

            // Comprobamos si el schema es un objeto de referencia o un objeto de schema.
            if (schema && '$ref' in schema) {
              // Swagger 2.0 no soporta $ref directamente en parámetros que no son 'body'.
              // Se podría implementar una lógica para resolver la referencia, pero por ahora
              // es más seguro omitirlo y registrar una advertencia.
              console.warn(
                `ADVERTENCIA: $ref en el parámetro "${param.name}" (que no es 'body') no está soportado en la conversión a Swagger 2.0.`
              );
              return baseParam;
            } else {
              // Si es un SchemaObject, expandimos sus propiedades,
              // pero excluimos su propiedad 'required' para evitar conflictos.
              // Usamos desestructuración para separar 'required' del resto de las
              // propiedades del schema. Nombramos la variable con '_' para indicar
              // que es intencionadamente no utilizada, evitando errores del linter.
              const { required: _schemaRequired, ...schemaProps } = schema;

              return {
                ...baseParam,
                ...schemaProps,
              };
            }
          });
        }

        const finalResponses: Record<string, SwaggerResponse> = {};
        if (route.responses && route.responses.length > 0) {
          for (const res of route.responses) {
            const responseContent: SwaggerResponse = {
              description: res.description,
            };
            if (res.schema) {
              responseContent.schema = res.schema;
            }
            finalResponses[res.statusCode] = responseContent;
          }
        } else {
          finalResponses['200'] = {
            description: 'Success',
          };
        }
        operation.responses = finalResponses;

        paths[fullPath][route.method] = operation;
      }
    }

    return paths;
  }

  /**
   * Extrae todos los tags únicos de los controladores analizados.
   * @param controllers La información de los controladores.
   * @param projectName El nombre del proyecto (usado como fallback).
   * @returns Un array de objetos de tag para OpenAPI.
   */
  private extractTagsFromControllers(
    controllers: ControllerInfo[],
    projectName: string
  ): Array<{ name: string }> {
    const tags = new Set<string>();

    tags.add('health');

    for (const controller of controllers) {
      if (controller.tags) {
        controller.tags.forEach((tag) => tags.add(tag));
      }

      for (const route of controller.routes) {
        if (route.tags) {
          route.tags.forEach((tag) => tags.add(tag));
        }
      }
    }

    if (tags.size === 1) {
      tags.add(projectName.replace('api-', ''));
    }

    return Array.from(tags).map((name) => ({ name }));
  }

  /**
   * Genera la configuración de servicios compatible con el resto del sistema.
   * @returns Un array de `ServiceConfig`.
   */
  generateServiceConfigs(): ServiceConfig[] {
    this.discoverApiProjects();

    const services: ServiceConfig[] = [];

    for (const project of this.apiProjects) {
      if (project.serviceUrl) {
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
   * Encuentra la variable de entorno asociada a un nombre de proyecto.
   * @param projectName El nombre del proyecto.
   * @returns El nombre de la variable de entorno.
   */
  private findEnvVarForProject(projectName: string): string {
    for (const [envVar, config] of Array.from(this.serviceConfigs.entries())) {
      if (envVar === projectName) {
        return config.envVar;
      }
    }

    const cleanName = projectName
      .replace('api-', '')
      .replace(/-/g, '_')
      .toUpperCase();
    return `${cleanName}_BACKEND_URL`;
  }

  /**
   * Genera un título legible para un servicio a partir de su nombre de proyecto.
   * @param projectName El nombre del proyecto.
   * @returns Un título legible.
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
}