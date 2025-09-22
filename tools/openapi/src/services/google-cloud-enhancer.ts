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
  config: Config,
  services: ServiceConfig[]
): SwaggerV2Document {
  console.log('☁️ Añadiendo configuración de Google Cloud API Gateway...');

  const enhancedSpec = { ...spec };

  // Construir URLs de servicios desde ServiceConfig
  const serviceUrls: Record<string, string> = {};
  for (const service of services) {
    const url = process.env[service.urlEnvVar];
    if (url) {
      serviceUrls[service.urlEnvVar] = url;
    }
  }

  // Añadir configuraciones de Google Cloud
  addGoogleCloudManagement(enhancedSpec, config);
  addSecuritySchemes(enhancedSpec);
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
            values: { STANDARD: config.rateLimitPerMinute },
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
}

/**
 * Añade esquemas de seguridad compatibles con Google Cloud
 *
 * @param spec - Especificación a modificar
 */
function addSecuritySchemes(spec: SwaggerV2Document): void {
  // Inicializar securityDefinitions si no existe
  if (!spec.securityDefinitions) {
    spec.securityDefinitions = {};
  }

  const securitySchemes: Record<string, SecurityDefinition> = {
    // API Key en header (formato recomendado por Google Cloud)
    x_api_key: {
      type: 'apiKey',
      name: 'x-api-key',
      in: 'header',
    },
  };

  Object.assign(spec.securityDefinitions, securitySchemes);

  // Configurar seguridad global (API key en header requerida por defecto)
  spec.security = [{ x_api_key: [] }];
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
  serviceUrls: Record<string, string>,
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
              protocol:
                config.protocol === 'https'
                  ? CONSTANTS.GOOGLE_CLOUD.PROTOCOL_H2
                  : CONSTANTS.GOOGLE_CLOUD.PROTOCOL_HTTP,
              path_translation: 'APPEND_PATH_TO_ADDRESS',
            },
            // Asegurar que cada operación tenga seguridad
            security: (operation as { security?: unknown }).security || [
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
