import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { OpenAPIV3 } from 'openapi-types';

// --- INTERFACES Y TIPOS ---
interface ServiceConfig {
  name: string;
  urlEnvVar: string;
  pathPrefix: string;
  title: string;
  description: string;
}

interface Config {
  outputFile: string;
  gatewayTitle: string;
  gatewayDescription: string;
  gatewayVersion: string;
  protocol: string;
  projectId?: string;
  clientId?: string;
}

// --- CONFIGURACIÓN ---
function getConfig(): Config {
  const args = process.argv.slice(2);
  const flags = args.reduce((acc, arg, index) => {
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value =
        args[index + 1] && !args[index + 1].startsWith('--')
          ? args[index + 1]
          : true;
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string | boolean>);

  return {
    outputFile:
      (flags['output'] as string) ||
      process.env['OPENAPI_OUTPUT_FILE'] ||
      'openapi-gateway.yaml',
    gatewayTitle:
      (flags['title'] as string) ||
      process.env['GATEWAY_TITLE'] ||
      'Monorepo API Gateway',
    gatewayDescription:
      (flags['description'] as string) ||
      process.env['GATEWAY_DESCRIPTION'] ||
      'Gateway principal que unifica todos los microservicios.',
    gatewayVersion:
      (flags['version'] as string) || process.env['GATEWAY_VERSION'] || '1.0.0',
    protocol:
      (flags['protocol'] as string) ||
      process.env['BACKEND_PROTOCOL'] ||
      'https',
    projectId:
      (flags['project-id'] as string) || process.env['GOOGLE_CLOUD_PROJECT'],
    clientId: (flags['client-id'] as string) || process.env['GOOGLE_CLIENT_ID'],
  };
}

const SERVICES: ServiceConfig[] = [
  {
    name: 'users',
    urlEnvVar: 'USERS_BACKEND_URL',
    pathPrefix: '/users',
    title: 'Users API',
    description: 'API para gestión de usuarios y autenticación',
  },
  {
    name: 'orders',
    urlEnvVar: 'ORDERS_BACKEND_URL',
    pathPrefix: '/orders',
    title: 'Orders API',
    description: 'API para gestión de órdenes y pagos',
  },
];

function validateEnvironmentVariables(): Record<string, string> {
  const envVars: Record<string, string> = {};
  const missingVars: string[] = [];

  for (const service of SERVICES) {
    const value = process.env[service.urlEnvVar];
    if (!value) {
      missingVars.push(service.urlEnvVar);
    } else {
      envVars[service.urlEnvVar] = value;
    }
  }

  if (missingVars.length > 0) {
    console.error(
      `❌ Error: Las siguientes variables de entorno son requeridas: ${missingVars.join(
        ', '
      )}`
    );
    console.error('Ejemplo:');
    missingVars.forEach((varName) => {
      console.error(`export ${varName}=https://your-service-url.com`);
    });
    process.exit(1);
  }

  return envVars;
}

function getBackendUrlForPath(
  path: string,
  envVars: Record<string, string>
): string {
  for (const service of SERVICES) {
    if (path.startsWith(service.pathPrefix)) {
      return envVars[service.urlEnvVar];
    }
  }
  return envVars[SERVICES[0].urlEnvVar];
}

// Generar especificación básica para cada servicio
function generateServiceSpec(service: ServiceConfig): OpenAPIV3.Document {
  const paths: OpenAPIV3.PathsObject = {};

  if (service.name === 'users') {
    // Rutas típicas de un servicio de usuarios
    paths['/users'] = {
      get: {
        summary: 'Obtener todos los usuarios',
        tags: ['users'],
        responses: {
          '200': {
            description: 'Lista de usuarios',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Crear nuevo usuario',
        tags: ['users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserDto' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Usuario creado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    };

    paths['/users/{id}'] = {
      get: {
        summary: 'Obtener usuario por ID',
        tags: ['users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Usuario encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    };

    paths['/auth/login'] = {
      post: {
        summary: 'Iniciar sesión',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginDto' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login exitoso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
        },
      },
    };
  }

  if (service.name === 'orders') {
    // Rutas típicas de un servicio de órdenes
    paths['/orders'] = {
      get: {
        summary: 'Obtener todas las órdenes',
        tags: ['orders'],
        responses: {
          '200': {
            description: 'Lista de órdenes',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Order' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Crear nueva orden',
        tags: ['orders'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrderDto' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Orden creada',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
        },
      },
    };

    paths['/orders/{id}'] = {
      get: {
        summary: 'Obtener orden por ID',
        tags: ['orders'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Orden encontrada',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
        },
      },
    };

    paths['/payments'] = {
      post: {
        summary: 'Procesar pago',
        tags: ['payments'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaymentDto' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Pago procesado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentResponse' },
              },
            },
          },
        },
      },
    };
  }

  return {
    openapi: '3.0.0',
    info: {
      title: service.title,
      description: service.description,
      version: '1.0.0',
    },
    paths,
    components: {
      schemas: generateSchemas(service.name),
    },
  };
}

function generateSchemas(
  serviceName: string
): Record<string, OpenAPIV3.SchemaObject> {
  const schemas: Record<string, OpenAPIV3.SchemaObject> = {};

  if (serviceName === 'users') {
    schemas['User'] = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'email', 'name'],
    };

    schemas['CreateUserDto'] = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        password: { type: 'string', minLength: 6 },
      },
      required: ['email', 'name', 'password'],
    };

    schemas['LoginDto'] = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' },
      },
      required: ['email', 'password'],
    };

    schemas['AuthResponse'] = {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        user: { $ref: '#/components/schemas/User' },
      },
      required: ['access_token', 'user'],
    };
  }

  if (serviceName === 'orders') {
    schemas['Order'] = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/OrderItem' },
        },
        total: { type: 'number', format: 'double' },
        status: {
          type: 'string',
          enum: ['pending', 'confirmed', 'shipped', 'delivered'],
        },
        createdAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'userId', 'items', 'total', 'status'],
    };

    schemas['OrderItem'] = {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        quantity: { type: 'integer', minimum: 1 },
        price: { type: 'number', format: 'double' },
      },
      required: ['productId', 'quantity', 'price'],
    };

    schemas['CreateOrderDto'] = {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/OrderItem' },
        },
      },
      required: ['userId', 'items'],
    };

    schemas['PaymentDto'] = {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        amount: { type: 'number', format: 'double' },
        method: {
          type: 'string',
          enum: ['credit_card', 'paypal', 'bank_transfer'],
        },
        cardToken: { type: 'string' },
      },
      required: ['orderId', 'amount', 'method'],
    };

    schemas['PaymentResponse'] = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
        transactionId: { type: 'string' },
      },
      required: ['id', 'status'],
    };
  }

  return schemas;
}

function enhanceSpecForGoogleCloud(
  spec: OpenAPIV3.Document,
  envVars: Record<string, string>,
  config: Config
): OpenAPIV3.Document {
  const enhancedSpec = { ...spec };

  // Configuración de gestión para Google Cloud
  Object.assign(enhancedSpec.info, {
    'x-google-management': {
      metrics: [
        {
          name: 'request_count',
          display_name: 'Request Count',
          value_type: 'INT64',
          metric_kind: 'DELTA',
        },
        {
          name: 'request_latency',
          display_name: 'Request Latency',
          value_type: 'DISTRIBUTION',
          metric_kind: 'DELTA',
        },
      ],
      quota: {
        limits: [
          {
            name: 'RequestsPerMinutePerProject',
            metric: 'request_count',
            unit: '1/min/{project}',
            values: { STANDARD: 10000 },
          },
        ],
      },
    },
    'x-google-endpoints': [
      {
        name: `${config.gatewayTitle
          .toLowerCase()
          .replace(/\s+/g, '-')}-gateway`,
        allowCors: true,
      },
    ],
  });

  // Añadir esquemas de seguridad
  if (!enhancedSpec.components) {
    enhancedSpec.components = {};
  }
  if (!enhancedSpec.components.securitySchemes) {
    enhancedSpec.components.securitySchemes = {};
  }

  const securitySchemes: Record<string, OpenAPIV3.SecuritySchemeObject> = {
    api_key: {
      type: 'apiKey',
      name: 'key',
      in: 'query',
    },
  };

  if (config.clientId) {
    securitySchemes['google_id_token'] = {
      type: 'oauth2',
      flows: {},
      'x-google-issuer': 'https://accounts.google.com',
      'x-google-jwks_uri': 'https://www.googleapis.com/oauth2/v3/certs',
      'x-google-audiences': config.clientId,
    } as OpenAPIV3.SecuritySchemeObject;
  }

  if (config.projectId) {
    securitySchemes['firebase_auth'] = {
      type: 'oauth2',
      flows: {},
      'x-google-issuer': `https://securetoken.google.com/${config.projectId}`,
      'x-google-jwks_uri':
        'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
      'x-google-audiences': config.projectId,
    } as OpenAPIV3.SecuritySchemeObject;
  }

  Object.assign(enhancedSpec.components.securitySchemes, securitySchemes);

  // Configurar backends para cada path
  const HTTP_METHODS = [
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'options',
    'head',
    'trace',
  ];

  if (enhancedSpec.paths) {
    Object.keys(enhancedSpec.paths).forEach((pathKey) => {
      const pathItem = enhancedSpec.paths?.[
        pathKey
      ] as OpenAPIV3.PathItemObject;

      HTTP_METHODS.forEach((method) => {
        const operation = pathItem[method as keyof OpenAPIV3.PathItemObject];
        if (
          operation &&
          typeof operation === 'object' &&
          !Array.isArray(operation)
        ) {
          const backendUrl = getBackendUrlForPath(pathKey, envVars);

          Object.assign(operation, {
            'x-google-backend': {
              address: backendUrl,
              protocol: config.protocol,
              path_translation: 'APPEND_PATH_TO_ADDRESS',
            },
          });
        }
      });
    });
  }

  return enhancedSpec;
}

async function generateAndPublishSpec(): Promise<void> {
  const config = getConfig();

  console.log('🔍 Validando variables de entorno...');
  const envVars = validateEnvironmentVariables();

  console.log('📋 Configuración detectada:');
  console.log(`   - Título: ${config.gatewayTitle}`);
  console.log(`   - Versión: ${config.gatewayVersion}`);
  console.log(`   - Archivo de salida: ${config.outputFile}`);
  console.log(`   - Protocolo: ${config.protocol}`);
  if (config.projectId)
    console.log(`   - Google Cloud Project: ${config.projectId}`);
  if (config.clientId) console.log(`   - Google Client ID: ${config.clientId}`);

  console.log('📡 URLs de servicios:');
  SERVICES.forEach((service) => {
    console.log(`   - ${service.title}: ${envVars[service.urlEnvVar]}`);
  });

  console.log('🚀 Generando especificaciones de servicios...');

  const serviceDocuments: OpenAPIV3.Document[] = [];

  for (const service of SERVICES) {
    console.log(`   - Generando ${service.title}...`);
    const doc = generateServiceSpec(service);
    serviceDocuments.push(doc);
    console.log(`   ✅ ${service.title} completado`);
  }

  console.log('🔗 Combinando especificaciones...');

  // Combinar todas las especificaciones
  const combinedSpec: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
      title: config.gatewayTitle,
      description: config.gatewayDescription,
      version: config.gatewayVersion,
    },
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
    },
  };

  // Combinar paths y components
  serviceDocuments.forEach((doc) => {
    if (doc.paths && combinedSpec.paths) {
      Object.assign(combinedSpec.paths, doc.paths);
    }
    if (doc.components?.schemas && combinedSpec.components?.schemas) {
      Object.assign(combinedSpec.components.schemas, doc.components.schemas);
    }
  });

  console.log('☁️ Configurando para Google Cloud API Gateway...');
  const finalSpec = enhanceSpecForGoogleCloud(combinedSpec, envVars, config);

  console.log('💾 Escribiendo archivo de especificación...');
  const outputPath = path.resolve(config.outputFile);
  fs.writeFileSync(outputPath, YAML.stringify(finalSpec), 'utf8');

  console.log(`✅ Especificación OpenAPI generada con éxito:`);
  console.log(`   📄 Archivo: ${outputPath}`);
  console.log(`   📊 Paths: ${Object.keys(finalSpec.paths || {}).length}`);
  console.log(
    `   🧩 Schemas: ${Object.keys(finalSpec.components?.schemas || {}).length}`
  );

  // Mostrar comandos útiles
  console.log('\n📚 Comandos útiles:');
  console.log(
    `   Validar especificación: swagger-codegen validate -i ${config.outputFile}`
  );
  console.log(
    `   Desplegar a Google Cloud: gcloud api-gateway api-configs create CONFIG_ID --api=API_ID --openapi-spec=${config.outputFile}`
  );
}

// Función principal con manejo de errores
async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
🔧 Generador de Especificación OpenAPI para Google Cloud API Gateway

Genera una especificación OpenAPI básica basada en la estructura típica de microservicios.

USAGE:
  node generate-openapi-basic.js [OPTIONS]

OPTIONS:
  --output <file>         Archivo de salida (default: openapi-gateway.yaml)
  --title <title>         Título del gateway (default: Monorepo API Gateway)
  --description <desc>    Descripción del gateway
  --version <version>     Versión del gateway (default: 1.0.0)
  --protocol <protocol>   Protocolo de backend (default: https)
  --project-id <id>       Google Cloud Project ID (para Firebase Auth)
  --client-id <id>        Google OAuth Client ID (para Google Auth)
  --help                  Mostrar esta ayuda

VARIABLES DE ENTORNO REQUERIDAS:
  USERS_BACKEND_URL       URL del servicio de usuarios
  ORDERS_BACKEND_URL      URL del servicio de órdenes
`);
    process.exit(0);
  }

  try {
    await generateAndPublishSpec();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fatal durante la generación:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
