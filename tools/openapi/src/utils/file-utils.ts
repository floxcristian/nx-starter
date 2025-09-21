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
