/**
 * @fileoverview Servicio de configuración para Google Cloud API Gateway
 *
 * Se encarga de añadir todas las configuraciones específicas necesarias
 * para que la especificación OpenAPI funcione correctamente con Google Cloud API Gateway.
 */

import {
  SwaggerV2Document,
  SecurityDefinition,
  Config,
  ServiceConfig,
  ValidatedServiceUrls,
  CONSTANTS,
} from '../types/index';

/**
 * Mejora una especificación Swagger 2.0 con configuraciones específicas de Google Cloud
 *
 * Añade metadatos de gestión, endpoints, esquemas de seguridad y configuración
 * de backends necesarios para el funcionamiento en Google Cloud API Gateway.
 *
 * @param spec - Especificación Swagger 2.0 base
 * @param serviceUrls - URLs validadas de los servicios backend
 * @param config - Configuración del gateway
 * @param services - Configuraciones de servicios para mapeo de rutas
 * @returns Especificación mejorada para Google Cloud
 *
 * @example
 * ```typescript
 * const enhanced = enhanceSpecificationForGoogleCloud(
 *   baseSpec,
 *   { USERS_BACKEND_URL: 'https://api.example.com' },
 *   config,
 *   services
 * );
 * console.log('Especificación mejorada para Google Cloud');
 * ```
 */
export function enhanceSpecificationForGoogleCloud(
  spec: SwaggerV2Document,
  serviceUrls: ValidatedServiceUrls,
  config: Config,
  services: ServiceConfig[]
): SwaggerV2Document {
  console.log('☁️ Añadiendo configuración de Google Cloud API Gateway...');

  const enhancedSpec = { ...spec };

  // Añadir configuraciones de Google Cloud
  addGoogleCloudManagement(enhancedSpec, config);
  addSecuritySchemes(enhancedSpec, config);
  addBackendConfiguration(enhancedSpec, serviceUrls, config, services);

  return enhancedSpec;
}

/**
 * Añade configuración de gestión y endpoints de Google Cloud
 *
 * @param spec - Especificación a modificar
 * @param config - Configuración del gateway
 */
function addGoogleCloudManagement(
  spec: SwaggerV2Document,
  config: Config
): void {
  // Configuración de gestión para métricas y cuotas
  Object.assign(spec.info, {
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
        name: generateEndpointName(config.gatewayTitle),
        allowCors: true,
      },
    ],
  });
}

/**
 * Genera un nombre de endpoint válido para Google Cloud
 *
 * @param title - Título del gateway
 * @returns Nombre de endpoint normalizado
 */
function generateEndpointName(title: string): string {
  return `${title.toLowerCase().replace(/\s+/g, '-')}-gateway`;
}

/**
 * Añade esquemas de seguridad compatibles con Google Cloud
 *
 * @param spec - Especificación a modificar
 * @param config - Configuración del gateway
 */
function addSecuritySchemes(spec: SwaggerV2Document, config: Config): void {
  // Inicializar securityDefinitions si no existe
  if (!spec.securityDefinitions) {
    spec.securityDefinitions = {};
  }

  const securitySchemes: Record<string, SecurityDefinition> = {
    // API Key en query parameter (formato estándar de Google Cloud)
    api_key: {
      type: 'apiKey',
      name: 'key',
      in: 'query',
    },

    // API Key en header alternativo
    x_api_key: {
      type: 'apiKey',
      name: 'x-api-key',
      in: 'header',
    },

    // Firebase Authentication (OAuth2)
    firebase_auth: {
      type: 'oauth2',
      authorizationUrl: `https://securetoken.google.com/${config.projectId}`,
      flow: 'implicit',
      'x-google-issuer': `https://securetoken.google.com/${config.projectId}`,
      'x-google-jwks_uri':
        'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
      'x-google-audiences': config.projectId,
    },
  };

  Object.assign(spec.securityDefinitions, securitySchemes);

  // Configurar seguridad global (API key requerida por defecto)
  spec.security = [{ api_key: [] }, { x_api_key: [] }];
}

/**
 * Añade configuración de backends para cada path
 *
 * @param spec - Especificación a modificar
 * @param serviceUrls - URLs de servicios backend
 * @param config - Configuración del gateway
 * @param services - Configuraciones de servicios
 */
function addBackendConfiguration(
  spec: SwaggerV2Document,
  serviceUrls: ValidatedServiceUrls,
  config: Config,
  services: ServiceConfig[]
): void {
  if (!spec.paths) {
    return;
  }

  Object.keys(spec.paths).forEach((pathKey) => {
    const pathItem = spec.paths?.[pathKey] as Record<string, unknown>;

    // Configurar cada método HTTP en el path
    CONSTANTS.HTTP_METHODS.forEach((method) => {
      const operation = pathItem[method];

      if (
        operation &&
        typeof operation === 'object' &&
        !Array.isArray(operation)
      ) {
        const service = findServiceForPath(pathKey, services);

        if (service) {
          // Añadir configuración de backend de Google Cloud
          Object.assign(operation, {
            'x-google-backend': {
              address: serviceUrls[service.urlEnvVar],
              protocol: config.protocol === 'https' ? 'h2' : 'http/1.1',
              path_translation: 'APPEND_PATH_TO_ADDRESS',
            },
            // Asegurar que cada operación tenga seguridad
            security: (operation as { security?: unknown }).security || [
              { api_key: [] },
              { x_api_key: [] },
            ],
          });
        }
      }
    });
  });
}

/**
 * Encuentra el servicio correspondiente a un path específico
 *
 * @param pathKey - Path de la API
 * @param services - Configuraciones de servicios disponibles
 * @returns Configuración del servicio correspondiente o undefined
 *
 * @example
 * ```typescript
 * const service = findServiceForPath('/users/profile', services);
 * // Retorna el servicio con pathPrefix '/users'
 * ```
 */
function findServiceForPath(
  pathKey: string,
  services: ServiceConfig[]
): ServiceConfig | undefined {
  return services.find((service) => pathKey.startsWith(service.pathPrefix));
}
