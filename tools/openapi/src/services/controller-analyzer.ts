import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import type { OpenAPIV3 } from 'openapi-types';

/** Representa un schema de OpenAPI. */
export type SchemaObject = OpenAPIV3.SchemaObject;

/** Información extraída de una ruta de un controlador. */
export interface ControllerRoute {
  /** Path de la ruta, relativo al controlador. */
  path: string;
  /** Método HTTP (get, post, etc.). */
  method: string;
  /** Resumen de la operación, extraído de @ApiOperation. */
  summary?: string;
  /** ID de la operación, usualmente el nombre del método. */
  operationId?: string;
  /** Tags para agrupar la ruta, extraídos de @ApiTags. */
  tags?: string[];
  /** Parámetros de la ruta (path, query, body). */
  parameters?: RouteParameter[];
  /** Respuestas HTTP posibles para la ruta. */
  responses?: RouteResponse[];
}

/** Representa un parámetro de una ruta. */
export interface RouteParameter {
  /** Nombre del parámetro. */
  name: string;
  /** Ubicación del parámetro. */
  in: 'path' | 'query' | 'body';
  /** Si el parámetro es requerido. */
  required?: boolean;
  /** Descripción del parámetro. */
  description?: string;
  /** El schema que define el tipo y formato del parámetro. */
  schema: SchemaObject | OpenAPIV3.ReferenceObject;
}

/** Representa una respuesta HTTP de una ruta. */
export interface RouteResponse {
  /** Código de estado HTTP (ej. '200', '404'). */
  statusCode: string;
  /** Descripción de la respuesta. */
  description: string;
  /** El schema que define el cuerpo de la respuesta. */
  schema?: SchemaObject | OpenAPIV3.ReferenceObject;
}

/** Contiene toda la información extraída de un archivo de controlador. */
export interface ControllerInfo {
  /** El path base para todas las rutas del controlador. */
  basePath: string;
  /** Lista de rutas definidas en el controlador. */
  routes: ControllerRoute[];
  /** Tags a nivel de controlador. */
  tags?: string[];
  /** Mapa de todos los schemas de DTOs encontrados. */
  schemas: Record<string, SchemaObject | OpenAPIV3.ReferenceObject>;
}

/**
 * Clase para analizar estáticamente archivos de controladores de NestJS.
 */
export class ControllerAnalyzer {
  /**
   * Analiza todos los controladores en un directorio de proyecto usando el Type Checker de TS.
   * @param projectRoot El path raíz del proyecto a analizar.
   * @returns Un array con la información de todos los controladores encontrados.
   */
  static analyzeProjectControllers(projectRoot: string): ControllerInfo[] {
    const controllersDir = path.join(projectRoot, 'src', 'lib', 'controllers');
    if (!fs.existsSync(controllersDir)) return [];

    const controllerFiles = fs
      .readdirSync(controllersDir)
      .filter((file) => file.endsWith('.controller.ts'))
      .map((file) => path.join(controllersDir, file));

    if (controllerFiles.length === 0) return [];

    const tsconfigPath = ts.findConfigFile(projectRoot, ts.sys.fileExists);
    if (!tsconfigPath) {
      console.warn(
        `   ⚠️  Could not find a 'tsconfig.json' for ${projectRoot}. Analysis may be incomplete.`
      );
      const program = ts.createProgram(controllerFiles, {});
      return this.analyzeProgram(program);
    }

    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    const compilerOptions = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(tsconfigPath)
    );

    const program = ts.createProgram(controllerFiles, compilerOptions.options);
    return this.analyzeProgram(program);
  }

  /**
   * Orquesta el análisis de un programa TypeScript.
   * @param program El programa TS a analizar.
   * @returns Un array con la información de los controladores.
   */
  private static analyzeProgram(program: ts.Program): ControllerInfo[] {
    const typeChecker = program.getTypeChecker();
    const allControllerInfo: ControllerInfo[] = [];

    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.fileName.endsWith('.controller.ts')) {
        const controllerInfo = this.analyzeControllerFile(sourceFile, typeChecker);
        if (controllerInfo.routes.length > 0) {
          allControllerInfo.push(controllerInfo);
        }
      }
    }
    return allControllerInfo;
  }

  /**
   * Analiza un único archivo de controlador.
   * @param sourceFile El nodo AST del archivo a analizar.
   * @param typeChecker El type checker del programa TypeScript.
   * @returns La información extraída del controlador.
   */
  static analyzeControllerFile(
    sourceFile: ts.SourceFile,
    typeChecker: ts.TypeChecker
  ): ControllerInfo {
    let basePath = '';
    let tags: string[] = [];
    const routes: ControllerRoute[] = [];
    const schemas: Record<string, SchemaObject | OpenAPIV3.ReferenceObject> = {};
    let controllerClassName = '';

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
          controllerClassName = node.name.text;
        }

        const decorators = ts.getDecorators(node);
        if (decorators) {
          const controllerDecorator = this.findDecorator(decorators, 'Controller');
          const apiTagsDecorator = this.findDecorator(decorators, 'ApiTags');

          if (controllerDecorator) {
            basePath = this.extractStringFromDecorator(controllerDecorator) || '';
          }
          if (apiTagsDecorator) {
            const tagValue = this.extractStringFromDecorator(apiTagsDecorator);
            if (tagValue) tags = [tagValue];
          }
        }

        node.members.forEach((member) => {
          if (ts.isMethodDeclaration(member)) {
            const memberDecorators = ts.getDecorators(member);
            if (memberDecorators) {
              const route = this.analyzeRouteMethod(
                member,
                basePath,
                typeChecker,
                schemas,
                controllerClassName
              );
              if (route) {
                route.tags = tags;
                routes.push(route);
              }
            }
          }
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { basePath, routes, tags, schemas };
  }

  /** Analiza un método de ruta de un controlador. */
  private static analyzeRouteMethod(
    method: ts.MethodDeclaration,
    basePath: string,
    typeChecker: ts.TypeChecker,
    schemas: Record<string, SchemaObject | OpenAPIV3.ReferenceObject>,
    controllerClassName: string
  ): ControllerRoute | null {
    const decorators = ts.getDecorators(method);
    if (!decorators) return null;

    const httpDecorator = this.findHttpDecorator(decorators);
    if (!httpDecorator) return null;

    const httpMethod = httpDecorator.name;
    const routePath = this.extractStringFromDecorator(httpDecorator.decorator) || '';
    const fullPath = this.buildFullPath(basePath, routePath);
    const apiOperation = this.findDecorator(decorators, 'ApiOperation');

    const operationId = `${controllerClassName}_${method.name?.getText()}`;

    const route: ControllerRoute = {
      path: fullPath,
      method: httpMethod.toLowerCase(),
      operationId: operationId,
    };

    if (apiOperation) {
      const summary = this.extractPropertyFromDecorator(apiOperation, 'summary');
      if (summary) route.summary = summary;
    }

    route.parameters = this.extractParameters(
      method,
      routePath,
      typeChecker,
      schemas
    );
    route.responses = this.extractResponses(decorators, typeChecker, schemas);

    return route;
  }

  /** Extrae los parámetros de un método de ruta. */
  private static extractParameters(
    method: ts.MethodDeclaration,
    routePath: string,
    typeChecker: ts.TypeChecker,
    schemas: Record<string, SchemaObject | OpenAPIV3.ReferenceObject>
  ): RouteParameter[] {
    const parameters: RouteParameter[] = [];

    const pathParams = routePath.match(/:(\w+)/g);
    if (pathParams) {
      pathParams.forEach((param) => {
        const paramName = param.substring(1);
        parameters.push({
          name: paramName,
          in: 'path',
          schema: { type: 'string' },
          required: true,
        });
      });
    }

    method.parameters?.forEach((param) => {
      const paramDecorators = ts.getDecorators(param);
      if (!paramDecorators || paramDecorators.length === 0) return;

      const bodyDecorator = this.findDecorator(paramDecorators, 'Body');
      if (bodyDecorator && param.name && ts.isIdentifier(param.name)) {
        const paramSymbol = typeChecker.getSymbolAtLocation(param.name);
        if (paramSymbol) {
          const paramType = typeChecker.getDeclaredTypeOfSymbol(paramSymbol);
          parameters.push({
            name: 'body',
            in: 'body',
            required: true,
            schema: this.generateSchemaForType(paramType, typeChecker, schemas),
          });
        }
        return;
      }

      const queryDecorator = this.findDecorator(paramDecorators, 'Query');
      if (queryDecorator && param.name && ts.isIdentifier(param.name)) {
        parameters.push({
          name: param.name.text,
          in: 'query',
          schema: { type: 'string' },
          required: false,
        });
      }
    });

    return parameters;
  }

  /** Extrae las respuestas de un método de ruta. */
  private static extractResponses(
    decorators: readonly ts.Decorator[],
    typeChecker: ts.TypeChecker,
    schemas: Record<string, SchemaObject | OpenAPIV3.ReferenceObject>
  ): RouteResponse[] {
    const responses: RouteResponse[] = [];

    decorators.forEach((decorator) => {
      if (
        ts.isCallExpression(decorator.expression) &&
        ts.isIdentifier(decorator.expression.expression) &&
        decorator.expression.expression.text === 'ApiResponse'
      ) {
        const response: Partial<RouteResponse> & {
          schema?: SchemaObject | OpenAPIV3.ReferenceObject;
        } = {
          statusCode: '200',
          description: 'Success',
        };

        if (decorator.expression.arguments.length > 0) {
          const config = decorator.expression.arguments[0];
          if (ts.isObjectLiteralExpression(config)) {
            for (const prop of config.properties) {
              if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name))
                continue;

              const propName = prop.name.text;
              const initializer = prop.initializer;

              if (propName === 'status' && ts.isNumericLiteral(initializer)) {
                response.statusCode = initializer.text;
              }
              if (propName === 'description' && ts.isStringLiteral(initializer)) {
                response.description = initializer.text;
              }
              if (propName === 'type') {
                let type = typeChecker.getTypeAtLocation(initializer);
                const constructSignatures = type.getConstructSignatures();
                if (constructSignatures.length > 0) {
                  type = constructSignatures[0].getReturnType();
                }
                response.schema = this.generateSchemaForType(
                  type,
                  typeChecker,
                  schemas
                );
              }
            }
          }
        }
        responses.push(response as RouteResponse);
      }
    });

    if (responses.length === 0) {
      responses.push({
        statusCode: '200',
        description: 'Success',
      });
    }

    return responses;
  }

  /** Genera un JSON schema para un tipo de TypeScript dado. */
  private static generateSchemaForType(
    type: ts.Type,
    typeChecker: ts.TypeChecker,
    schemas: Record<string, SchemaObject | OpenAPIV3.ReferenceObject>
  ): SchemaObject | OpenAPIV3.ReferenceObject {
    const symbol = type.getSymbol();
    if (symbol && symbol.getName() === 'Date') {
      return { type: 'string', format: 'date-time' };
    }

    const numberIndexType = type.getNumberIndexType();
    if (numberIndexType) {
      return {
        type: 'array',
        items: this.generateSchemaForType(numberIndexType, typeChecker, schemas),
      };
    }

    const typeName = typeChecker.typeToString(type);

    if (schemas[typeName]) {
      return { $ref: `#/definitions/${typeName}` };
    }

    schemas[typeName] = {}; // Placeholder for circular refs

    const properties: Record<string, SchemaObject | OpenAPIV3.ReferenceObject> = {};
    const required: string[] = [];

    for (const property of type.getProperties()) {
      const propertyName = property.name;

      if (property.valueDeclaration) {
        const propertyType = typeChecker.getTypeOfSymbolAtLocation(
          property,
          property.valueDeclaration
        );

        if (!(property.flags & ts.SymbolFlags.Optional)) {
          required.push(propertyName);
        }

        const flags = propertyType.getFlags();

        if (flags & ts.TypeFlags.String) {
          properties[propertyName] = { type: 'string' };
        } else if (flags & ts.TypeFlags.Number) {
          properties[propertyName] = { type: 'number' };
        } else if (flags & ts.TypeFlags.Boolean) {
          properties[propertyName] = { type: 'boolean' };
        } else if (propertyType.isClassOrInterface()) {
          const nestedTypeName = typeChecker.typeToString(propertyType);
          if (nestedTypeName === typeName) {
            properties[propertyName] = { $ref: `#/definitions/${nestedTypeName}` };
          } else {
            properties[propertyName] =
              this.generateSchemaForType(propertyType, typeChecker, schemas) || {};
          }
        } else if (type.getNumberIndexType()) {
          const arrayType = type.getNumberIndexType();
          if (arrayType) {
            properties[propertyName] = {
              type: 'array',
              items: this.generateSchemaForType(arrayType, typeChecker, schemas),
            };
          }
        }
      }
    }

    const schema: SchemaObject = {
      type: 'object',
      properties,
    };
    if (required.length > 0) {
      schema.required = required;
    }

    schemas[typeName] = schema;

    return { $ref: `#/definitions/${typeName}` };
  }

  /** Encuentra un decorador específico por su nombre. */
  private static findDecorator(
    decorators: readonly ts.Decorator[],
    name: string
  ): ts.Decorator | undefined {
    return decorators.find((decorator) => {
      const expression = decorator.expression;
      if (ts.isCallExpression(expression)) {
        const identifier = expression.expression;
        return ts.isIdentifier(identifier) && identifier.text === name;
      }
      return ts.isIdentifier(expression) && expression.text === name;
    });
  }

  /** Encuentra decoradores HTTP (@Get, @Post, etc.). */
  private static findHttpDecorator(
    decorators: readonly ts.Decorator[]
  ): { name: string; decorator: ts.Decorator } | null {
    const httpMethods = ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head'];
    for (const decorator of decorators) {
      const expression = decorator.expression;
      if (ts.isCallExpression(expression) || ts.isIdentifier(expression)) {
        const name = ts.isCallExpression(expression)
          ? (expression.expression as ts.Identifier)?.text
          : (expression as ts.Identifier)?.text;
        if (name && httpMethods.includes(name)) {
          return { name, decorator };
        }
      }
    }
    return null;
  }

  /** Extrae el valor de un string de un decorador. */
  private static extractStringFromDecorator(decorator: ts.Decorator): string | null {
    if (
      ts.isCallExpression(decorator.expression) &&
      decorator.expression.arguments.length > 0
    ) {
      const firstArg = decorator.expression.arguments[0];
      if (ts.isStringLiteral(firstArg)) {
        return firstArg.text;
      }
    }
    return null;
  }

  /** Extrae una propiedad de un objeto literal en un decorador. */
  private static extractPropertyFromDecorator(
    decorator: ts.Decorator,
    propertyName: string
  ): string | null {
    if (
      ts.isCallExpression(decorator.expression) &&
      decorator.expression.arguments.length > 0
    ) {
      const firstArg = decorator.expression.arguments[0];
      if (ts.isObjectLiteralExpression(firstArg)) {
        for (const property of firstArg.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === propertyName &&
            ts.isStringLiteral(property.initializer)
          ) {
            return property.initializer.text;
          }
        }
      }
    }
    return null;
  }

  /** Construye el path completo de una ruta. */
  private static buildFullPath(basePath: string, routePath: string): string {
    const cleanBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
    if (!routePath) return cleanBasePath;
    const cleanRoutePath = routePath.startsWith('/') ? routePath : `/${routePath}`;
    return `${cleanBasePath}${cleanRoutePath}`;
  }
}
