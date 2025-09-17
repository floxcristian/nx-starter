/**
 * @fileoverview Utilidades para operaciones con archivos
 *
 * Proporciona funciones de utilidad para escribir archivos,
 * manejar rutas y operaciones del sistema de archivos.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { SwaggerV2Document } from '../types/index';

/**
 * Escribe un documento Swagger en formato YAML
 *
 * @param document - Documento Swagger a escribir
 * @param outputPath - Ruta del archivo de salida
 *
 * @example
 * ```typescript
 * const spec = { swagger: '2.0', info: { title: 'API' } };
 * writeSwaggerDocument(spec, './api-spec.yaml');
 * console.log('Archivo escrito correctamente');
 * ```
 *
 * @throws {Error} Si no se puede escribir el archivo
 */
export function writeSwaggerDocument(
  document: SwaggerV2Document,
  outputPath: string
): void {
  console.log('💾 Escribiendo archivo de especificación...');

  try {
    const resolvedPath = path.resolve(outputPath);
    const yamlContent = YAML.stringify(document);

    fs.writeFileSync(resolvedPath, yamlContent, 'utf8');

    console.log(`✅ Especificación OpenAPI generada con éxito:`);
    console.log(`   📄 Archivo: ${resolvedPath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error escribiendo archivo ${outputPath}: ${errorMessage}`);
  }
}

/**
 * Verifica si un archivo existe
 *
 * @param filePath - Ruta del archivo a verificar
 * @returns true si el archivo existe
 *
 * @example
 * ```typescript
 * if (fileExists('./config.json')) {
 *   console.log('Archivo de configuración encontrado');
 * }
 * ```
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Obtiene la extensión de un archivo
 *
 * @param fileName - Nombre del archivo
 * @returns Extensión del archivo (incluyendo el punto)
 *
 * @example
 * ```typescript
 * const ext = getFileExtension('api-spec.yaml');
 * console.log(ext); // '.yaml'
 * ```
 */
export function getFileExtension(fileName: string): string {
  return path.extname(fileName);
}

/**
 * Normaliza una ruta de archivo
 *
 * @param filePath - Ruta a normalizar
 * @returns Ruta normalizada
 *
 * @example
 * ```typescript
 * const normalized = normalizePath('./some/../path/file.txt');
 * console.log(normalized); // './path/file.txt'
 * ```
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

/**
 * Obtiene el directorio padre de un archivo
 *
 * @param filePath - Ruta del archivo
 * @returns Directorio padre
 *
 * @example
 * ```typescript
 * const dir = getDirectory('/path/to/file.txt');
 * console.log(dir); // '/path/to'
 * ```
 */
export function getDirectory(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Crea un directorio si no existe
 *
 * @param dirPath - Ruta del directorio a crear
 *
 * @example
 * ```typescript
 * ensureDirectoryExists('./output/specs');
 * // Crea la carpeta si no existe
 * ```
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
