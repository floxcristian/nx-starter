/**
 * @fileoverview Definiciones de tipos TypeScript para el generador de OpenAPI
 *
 * Este archivo centraliza todas las interfaces y tipos utilizados en el sistema
 * de generación de especificaciones OpenAPI para Google Cloud API Gateway.
 */

/**
 * Representa un módulo de servicio NestJS que puede ser instanciado
 * para la generación de documentación OpenAPI.
 */
export interface ServiceModule {
  /** Constructor del módulo */
  new (...args: unknown[]): unknown;
  /** Nombre del módulo para identificación */
  name: string;
}

/**
 * Error que puede ocurrir durante la conversión de OpenAPI 3.0 a Swagger 2.0
 */
export interface ConversionError {
  /** Mensaje descriptivo del error */
  message?: string;
}

/**
 * Resultado de la conversión de especificación OpenAPI
 */
export interface ConversionResult {
  /** Especificación resultante en formato Swagger 2.0 */
  spec: SwaggerV2Document;
  /** Lista de errores o advertencias durante la conversión */
  errors?: ConversionError[];
}

/**
 * Documento OpenAPI en formato Swagger 2.0 compatible con Google Cloud API Gateway
 */
export interface SwaggerV2Document {
  /** Versión de la especificación Swagger */
  swagger: string;
  /** Información básica de la API */
  info: {
    /** Título de la API */
    title: string;
    /** Descripción opcional de la API */
    description?: string;
    /** Versión de la API */
    version: string;
    /** Propiedades adicionales para Google Cloud */
    [key: string]: unknown;
  };
  /** Paths y operaciones de la API */
  paths?: Record<string, Record<string, unknown>>;
  /** Definiciones de modelos de datos */
  definitions?: Record<string, unknown>;
  /** Definiciones de esquemas de seguridad */
  securityDefinitions?: Record<string, SecurityDefinition>;
  /** Configuración de seguridad global */
  security?: Array<Record<string, string[]>>;
  /** Propiedades adicionales */
  [key: string]: unknown;
}

/**
 * Definición de un esquema de seguridad para autenticación
 */
export interface SecurityDefinition {
  /** Tipo de autenticación (apiKey, oauth2, etc.) */
  type: string;
  /** Nombre del parámetro (para apiKey) */
  name?: string;
  /** Ubicación del parámetro (query, header, etc.) */
  in?: string;
  /** URL de autorización (para oauth2) */
  authorizationUrl?: string;
  /** Flujo de autorización (para oauth2) */
  flow?: string;
  /** Propiedades adicionales específicas de Google Cloud */
  [key: string]: unknown;
}

/**
 * Configuración de un servicio API individual
 */
export interface ServiceConfig {
  /** Nombre identificador del servicio */
  name: string;
  /** Módulo NestJS del servicio (cargado dinámicamente) */
  module: ServiceModule | null;
  /** Variable de entorno que contiene la URL del servicio */
  urlEnvVar: string;
  /** Prefijo de path para las rutas del servicio */
  pathPrefix: string;
  /** Título legible del servicio */
  title: string;
}

/**
 * Configuración principal del generador OpenAPI
 */
export interface Config {
  /** Nombre del archivo de salida */
  outputFile: string;
  /** Nombre de la API en Google Cloud API Gateway */
  gatewayApiName: string;
  /** Título del gateway API */
  gatewayTitle: string;
  /** Descripción del gateway API */
  gatewayDescription: string;
  /** Versión del gateway (formato semver) */
  gatewayVersion: string;
  /** Protocolo de comunicación con los backends */
  protocol: string;
  /** ID del proyecto de Google Cloud */
  projectId: string;
  /** Entorno target para deployment */
  environment: 'dev' | 'prod';
  /** Límite de requests por minuto en Google Cloud */
  rateLimitPerMinute: number;
}

/**
 * Argumentos de línea de comandos parseados
 */
export interface ParsedCliArgs {
  /** Argumentos con sus valores */
  [key: string]: string | boolean;
}

/**
 * Variables de entorno validadas para URLs de servicios
 */
export interface ValidatedServiceUrls {
  /** Mapeo de variable de entorno a URL validada */
  [envVar: string]: string;
}

/**
 * Constantes utilizadas en la aplicación
 */
export const CONSTANTS = {
  /** Métodos HTTP soportados */
  HTTP_METHODS: [
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'options',
    'head',
    'trace',
  ] as const,

  /** Configuración de Google Cloud API Gateway */
  GOOGLE_CLOUD: {
    /** Protocolo HTTP/1.1 para Google Cloud */
    PROTOCOL_HTTP: 'http/1.1',
    /** Protocolo HTTP/2 para Google Cloud */
    PROTOCOL_H2: 'h2',
  } as const,
} as const;

/**
 * Utilidades para manipulación de strings
 */
export const StringUtils = {
  /**
   * Capitaliza la primera letra de una cadena
   * @param str - Cadena a capitalizar
   * @returns Cadena con la primera letra en mayúscula
   */
  capitalize: (str: string): string =>
    str.charAt(0).toUpperCase() + str.slice(1),
} as const;
