import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export interface ControllerRoute {
  path: string;
  method: string;
  summary?: string;
  operationId?: string;
  tags?: string[];
  parameters?: RouteParameter[];
  responses?: RouteResponse[];
}

export interface RouteParameter {
  name: string;
  in: 'path' | 'query' | 'body';
  type: string;
  required?: boolean;
  description?: string;
}

export interface RouteResponse {
  statusCode: string;
  description: string;
  type?: string;
}

export interface ControllerInfo {
  basePath: string;
  routes: ControllerRoute[];
  tags?: string[];
}

export class ControllerAnalyzer {
  /**
   * Analiza todos los controladores en un directorio de proyecto
   */
  static analyzeProjectControllers(projectRoot: string): ControllerInfo[] {
    const controllersDir = path.join(projectRoot, 'src', 'lib', 'controllers');

    if (!fs.existsSync(controllersDir)) {
      return [];
    }

    const controllerFiles = fs
      .readdirSync(controllersDir)
      .filter((file) => file.endsWith('.controller.ts'))
      .map((file) => path.join(controllersDir, file));

    return controllerFiles.map((file) => this.analyzeControllerFile(file));
  }

  /**
   * Analiza un archivo de controlador específico
   */
  static analyzeControllerFile(filePath: string): ControllerInfo {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    let basePath = '';
    let tags: string[] = [];
    const routes: ControllerRoute[] = [];

    // Función recursiva para visitar nodos del AST
    const visit = (node: ts.Node) => {
      // Buscar clases con decorador @Controller
      if (ts.isClassDeclaration(node)) {
        const decorators =
          (
            node as ts.ClassDeclaration & {
              decorators?: readonly ts.Decorator[];
            }
          ).decorators ||
          (ts.getDecorators && ts.getDecorators(node));
        if (decorators) {
          const controllerDecorator = this.findDecorator(
            decorators,
            'Controller'
          );
          const apiTagsDecorator = this.findDecorator(decorators, 'ApiTags');

          if (controllerDecorator) {
            basePath =
              this.extractStringFromDecorator(controllerDecorator) || '';
          }

          if (apiTagsDecorator) {
            const tagValue = this.extractStringFromDecorator(apiTagsDecorator);
            if (tagValue) {
              tags = [tagValue];
            }
          }
        }

        // Analizar métodos de la clase
        node.members?.forEach((member) => {
          if (ts.isMethodDeclaration(member)) {
            const memberDecorators =
              (
                member as ts.MethodDeclaration & {
                  decorators?: readonly ts.Decorator[];
                }
              ).decorators ||
              (ts.getDecorators && ts.getDecorators(member));
            if (memberDecorators) {
              const route = this.analyzeRouteMethod(member, basePath);
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

    return {
      basePath,
      routes,
      tags,
    };
  }

  /**
   * Analiza un método de ruta
   */
  private static analyzeRouteMethod(
    method: ts.MethodDeclaration,
    basePath: string
  ): ControllerRoute | null {
    const decorators =
      (
        method as ts.MethodDeclaration & {
          decorators?: readonly ts.Decorator[];
        }
      ).decorators ||
      (ts.getDecorators && ts.getDecorators(method));
    if (!decorators) return null;

    // Buscar decoradores HTTP
    const httpDecorator = this.findHttpDecorator(decorators);
    if (!httpDecorator) return null;

    const httpMethod = httpDecorator.name;
    const routePath =
      this.extractStringFromDecorator(httpDecorator.decorator) || '';

    // Construir path completo
    const fullPath = this.buildFullPath(basePath, routePath);

    // Extraer información adicional de decoradores de Swagger
    const apiOperation = this.findDecorator(decorators, 'ApiOperation');

    const route: ControllerRoute = {
      path: fullPath,
      method: httpMethod.toLowerCase(),
      operationId: method.name?.getText(),
    };

    // Extraer summary de @ApiOperation
    if (apiOperation) {
      const summary = this.extractPropertyFromDecorator(
        apiOperation,
        'summary'
      );
      if (summary) {
        route.summary = summary;
      }
    }

    // Extraer parámetros de la ruta
    route.parameters = this.extractParameters(method, routePath);

    // Extraer responses
    route.responses = this.extractResponses(decorators);

    return route;
  }

  /**
   * Busca un decorador específico por nombre
   */
  private static findDecorator(
    decorators: readonly ts.Decorator[],
    name: string
  ): ts.Decorator | undefined {
    return decorators.find((decorator) => {
      if (ts.isCallExpression(decorator.expression)) {
        const identifier = decorator.expression.expression;
        return ts.isIdentifier(identifier) && identifier.text === name;
      }
      return (
        ts.isIdentifier(decorator.expression) &&
        decorator.expression.text === name
      );
    });
  }

  /**
   * Busca decoradores HTTP (@Get, @Post, etc.)
   */
  private static findHttpDecorator(
    decorators: readonly ts.Decorator[]
  ): { name: string; decorator: ts.Decorator } | null {
    const httpMethods = [
      'Get',
      'Post',
      'Put',
      'Delete',
      'Patch',
      'Options',
      'Head',
    ];

    for (const decorator of decorators) {
      if (
        ts.isCallExpression(decorator.expression) ||
        ts.isIdentifier(decorator.expression)
      ) {
        const name = ts.isCallExpression(decorator.expression)
          ? (decorator.expression.expression as ts.Identifier)?.text
          : (decorator.expression as ts.Identifier)?.text;

        if (httpMethods.includes(name)) {
          return { name, decorator };
        }
      }
    }

    return null;
  }

  /**
   * Extrae string de un decorador
   */
  private static extractStringFromDecorator(
    decorator: ts.Decorator
  ): string | null {
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

  /**
   * Extrae una propiedad específica de un decorador de objeto
   */
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

  /**
   * Construye el path completo combinando basePath y routePath
   */
  private static buildFullPath(basePath: string, routePath: string): string {
    const cleanBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`;

    if (!routePath) {
      return cleanBasePath;
    }

    const cleanRoutePath = routePath.startsWith('/')
      ? routePath
      : `/${routePath}`;
    return `${cleanBasePath}${cleanRoutePath}`;
  }

  /**
   * Extrae parámetros de la ruta y del método
   */
  private static extractParameters(
    method: ts.MethodDeclaration,
    routePath: string
  ): RouteParameter[] {
    const parameters: RouteParameter[] = [];

    // Extraer parámetros de path (:id, :userId, etc.)
    const pathParams = routePath.match(/:(\w+)/g);
    if (pathParams) {
      pathParams.forEach((param) => {
        const paramName = param.substring(1); // remover ':'
        parameters.push({
          name: paramName,
          in: 'path',
          type: 'string',
          required: true,
        });
      });
    }

    // Buscar parámetros en los decoradores del método
    method.parameters?.forEach((param) => {
      const paramDecorators =
        (
          param as ts.ParameterDeclaration & {
            decorators?: readonly ts.Decorator[];
          }
        ).decorators ||
        (ts.getDecorators && ts.getDecorators(param));
      if (paramDecorators) {
        const bodyDecorator = this.findDecorator(paramDecorators, 'Body');
        const queryDecorator = this.findDecorator(paramDecorators, 'Query');

        if (bodyDecorator && param.name && ts.isIdentifier(param.name)) {
          parameters.push({
            name: param.name.text,
            in: 'body',
            type: 'object', // Podríamos ser más específicos analizando el tipo
            required: true,
          });
        }

        if (queryDecorator && param.name && ts.isIdentifier(param.name)) {
          parameters.push({
            name: param.name.text,
            in: 'query',
            type: 'string',
            required: false,
          });
        }
      }
    });

    return parameters;
  }

  /**
   * Extrae información de respuestas de los decoradores
   */
  private static extractResponses(
    decorators: readonly ts.Decorator[]
  ): RouteResponse[] {
    const responses: RouteResponse[] = [];

    decorators.forEach((decorator) => {
      if (
        ts.isCallExpression(decorator.expression) &&
        ts.isIdentifier(decorator.expression.expression) &&
        decorator.expression.expression.text === 'ApiResponse'
      ) {
        const response: RouteResponse = {
          statusCode: '200',
          description: 'Success',
        };

        if (decorator.expression.arguments.length > 0) {
          const responseConfig = decorator.expression.arguments[0];
          if (ts.isObjectLiteralExpression(responseConfig)) {
            responseConfig.properties.forEach((property) => {
              if (
                ts.isPropertyAssignment(property) &&
                ts.isIdentifier(property.name)
              ) {
                const propName = property.name.text;
                if (
                  propName === 'status' &&
                  ts.isNumericLiteral(property.initializer)
                ) {
                  response.statusCode = property.initializer.text;
                }
                if (
                  propName === 'description' &&
                  ts.isStringLiteral(property.initializer)
                ) {
                  response.description = property.initializer.text;
                }
              }
            });
          }
        }

        responses.push(response);
      }
    });

    // Si no hay respuestas definidas, agregar una por defecto
    if (responses.length === 0) {
      responses.push({
        statusCode: '200',
        description: 'Success',
      });
    }

    return responses;
  }
}
