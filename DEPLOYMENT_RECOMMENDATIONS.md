# Configuraciones recomendadas adicionales para el workflow

## 1. Health Checks para las APIs

Considera agregar endpoints de health check en tus APIs:

```typescript
// En api-orders/src/app/app.controller.ts
@Get('health')
healthCheck() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
```

## 2. Variables de Entorno por Servicio

En lugar de usar puertos hardcodeados, considera:

```yaml
# En deploy-affected.yml, reemplazar la sección case con:
# Obtener configuración desde project.json
project_config=$(npx nx show project $app --json)
port=$(echo "$project_config" | jq -r '.targets.serve.options.port // 3000')
```

## 3. Secrets de GitHub Actions necesarios

Asegúrate de tener configurados:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

## 4. Variables de repositorio requeridas

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GAR_REPOSITORY`

## 5. Configuración de Nx Cloud

Para acelerar aún más los builds, considera:

```json
// En nx.json, asegurar:
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"],
        "parallel": 3
      }
    }
  }
}
```

## 6. Monitoreo post-deploy

Considera agregar:

- Logs estructurados
- Métricas de APM
- Alertas de uptime

## 7. Rollback automático mejorado

Para un rollback más robusto, podrías implementar:

```yaml
- name: Rollback on Health Check Failure
  if: failure()
  run: |
    echo "Rolling back ${{ matrix.service.name }} due to failed health checks"
    PREVIOUS_REVISION=$(gcloud run revisions list \
      --service=${{ matrix.service.name }} \
      --region=${{ env.GCP_REGION }} \
      --format="value(metadata.name)" \
      --limit=2 | tail -n 1)

    if [ ! -z "$PREVIOUS_REVISION" ]; then
      gcloud run services update-traffic ${{ matrix.service.name }} \
        --to-revisions=$PREVIOUS_REVISION=100 \
        --region ${{ env.GCP_REGION }}
    fi
```
