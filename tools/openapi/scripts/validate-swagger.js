#!/usr/bin/env node

const fs = require('fs');
const yaml = require('yaml');

/**
 * Validador robusto de Swagger 2.0
 */
function validateSwagger20(filePath) {
  console.log(`🔍 Validando ${filePath} como Swagger 2.0...`);

  try {
    // 1. Validar que el archivo exista y sea YAML válido
    const content = fs.readFileSync(filePath, 'utf8');
    const spec = yaml.parse(content);

    console.log('✅ Archivo YAML parseable');

    // 2. Validar estructura básica de Swagger 2.0
    const errors = [];
    const warnings = [];

    if (!spec.swagger || spec.swagger !== '2.0') {
      errors.push('Debe especificar "swagger: 2.0"');
    }

    if (!spec.info) {
      errors.push('Falta sección "info"');
    } else {
      if (!spec.info.title) errors.push('Falta info.title');
      if (!spec.info.version) errors.push('Falta info.version');
    }

    // 3. Validar paths y parámetros
    if (spec.paths) {
      Object.keys(spec.paths).forEach((pathKey) => {
        const pathItem = spec.paths[pathKey];
        const httpMethods = [
          'get',
          'post',
          'put',
          'delete',
          'patch',
          'options',
          'head',
        ];

        httpMethods.forEach((method) => {
          const operation = pathItem[method];
          if (operation && operation.parameters) {
            operation.parameters.forEach((param, index) => {
              const paramPath = `paths.${pathKey}.${method}.parameters.${index}`;

              // Validar parámetros de path
              if (param.in === 'path') {
                if (param.schema && !param.type) {
                  errors.push(
                    `${paramPath}: Los parámetros de path no deben tener 'schema', deben usar 'type' directamente (Swagger 2.0)`
                  );
                }
                if (!param.type && !param.schema) {
                  errors.push(
                    `${paramPath}: Los parámetros de path requieren 'type' (Swagger 2.0)`
                  );
                }
                if (!param.required) {
                  warnings.push(
                    `${paramPath}: Los parámetros de path deberían ser 'required: true'`
                  );
                }
              }

              // Validar parámetros de query
              if (param.in === 'query') {
                if (param.schema && !param.type) {
                  warnings.push(
                    `${paramPath}: Los parámetros de query deberían usar 'type' en lugar de 'schema' (Swagger 2.0)`
                  );
                }
              }

              // Validar parámetros de body
              if (param.in === 'body') {
                if (!param.schema) {
                  errors.push(
                    `${paramPath}: Los parámetros de body requieren 'schema'`
                  );
                }
                if (param.type) {
                  warnings.push(
                    `${paramPath}: Los parámetros de body no deberían tener 'type', solo 'schema'`
                  );
                }
              }
            });
          }
        });
      });
    }

    // 4. Validar definiciones
    if (!spec.definitions) {
      warnings.push(
        'No se encontraron definiciones. ¿Estás seguro que esto es correcto?'
      );
    }

    // 5. Validar compatibilidad con Google Cloud API Gateway
    if (spec.paths) {
      Object.keys(spec.paths).forEach((pathKey) => {
        const pathItem = spec.paths[pathKey];
        const httpMethods = [
          'get',
          'post',
          'put',
          'delete',
          'patch',
          'options',
          'head',
        ];

        httpMethods.forEach((method) => {
          const operation = pathItem[method];
          if (operation) {
            const operationPath = `paths.${pathKey}.${method}`;

            // Verificar x-google-backend protocol
            if (
              operation['x-google-backend'] &&
              operation['x-google-backend'].protocol
            ) {
              const protocol = operation['x-google-backend'].protocol;
              if (protocol !== 'http/1.1' && protocol !== 'h2') {
                errors.push(
                  `${operationPath}: x-google-backend protocol debe ser 'http/1.1' o 'h2' (encontrado: '${protocol}')`
                );
              }
            }

            // Verificar que cada operación tenga security
            if (!operation.security && !spec.security) {
              warnings.push(
                `${operationPath}: Operación no requiere API key. Google Cloud recomienda security en cada operación.`
              );
            }
          }
        });
      });
    }

    // 6. Validar security definitions para Google Cloud
    if (spec.securityDefinitions) {
      Object.keys(spec.securityDefinitions).forEach((key) => {
        const secDef = spec.securityDefinitions[key];
        if (secDef.type === 'apiKey') {
          const isValidApiKey =
            (secDef.name === 'key' && secDef.in === 'query') ||
            (secDef.name === 'api_key' && secDef.in === 'query') ||
            (secDef.name === 'x-api-key' && secDef.in === 'header');

          if (!isValidApiKey) {
            errors.push(
              `securityDefinitions.${key}: Google Cloud solo acepta apiKey con name='key'|'api_key' in='query' o name='x-api-key' in='header'`
            );
          }
        }
      });
    }

    // 7. Validar referencias
    const refs = new Set();
    function extractRefs(obj) {
      if (typeof obj !== 'object' || obj === null) return;

      if (Array.isArray(obj)) {
        obj.forEach(extractRefs);
      } else {
        Object.keys(obj).forEach((key) => {
          if (key === '$ref' && typeof obj[key] === 'string') {
            refs.add(obj[key]);
          } else {
            extractRefs(obj[key]);
          }
        });
      }
    }

    extractRefs(spec);

    // Verificar que todas las referencias existan
    refs.forEach((ref) => {
      if (ref.startsWith('#/definitions/')) {
        const defName = ref.replace('#/definitions/', '');
        if (!spec.definitions || !spec.definitions[defName]) {
          errors.push(`Referencia no encontrada: ${ref}`);
        }
      } else if (ref.startsWith('#/components/schemas/')) {
        errors.push(
          `Referencia OpenAPI 3.0 detectada: ${ref}. Debe ser #/definitions/ para Swagger 2.0`
        );
      }
    });

    // 6. Reportar resultados
    console.log(`📊 Estadísticas:`);
    console.log(`   - Paths: ${Object.keys(spec.paths || {}).length}`);
    console.log(
      `   - Definitions: ${Object.keys(spec.definitions || {}).length}`
    );
    console.log(`   - Referencias: ${refs.size}`);

    if (warnings.length > 0) {
      console.log(`\n⚠️  Advertencias (${warnings.length}):`);
      warnings.forEach((warning) => console.log(`   - ${warning}`));
    }

    if (errors.length > 0) {
      console.log(`\n❌ Errores (${errors.length}):`);
      errors.forEach((error) => console.log(`   - ${error}`));
      console.log(
        `\n💡 Para más detalles, pega el archivo en: https://editor.swagger.io/`
      );
      process.exit(1);
    } else {
      console.log(`\n✅ Validación exitosa! El archivo cumple con Swagger 2.0`);
      if (warnings.length === 0) {
        console.log(`🎉 Sin advertencias - perfecto!`);
      }
    }
  } catch (error) {
    console.error(`❌ Error validando ${filePath}:`, error.message);
    process.exit(1);
  }
}

// Ejecutar validación
const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ Error: Debes especificar un archivo para validar');
  console.error('Uso: node validate-swagger.js <archivo.yaml>');
  process.exit(1);
}

validateSwagger20(filePath);
