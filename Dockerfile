
# ###################
# # ETAPA 1: BASE
# # Define nuestro entorno común: Alpine, pnpm, dumb-init y usuario no-root.
# # Servirá de base para las etapas posteriores, evitando repetición (DRY).
# ###################
FROM node:22-alpine AS base

# Habilitar corepack, la forma moderna de gestionar pnpm/yarn
RUN corepack enable

# Instalar dumb-init para un manejo correcto de señales (PID 1) en el contenedor
RUN apk add --no-cache dumb-init

# Crear un usuario y grupo no-root por seguridad.
# Evita que el proceso se ejecute como root dentro del contenedor.
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 nestjs -G nodejs

# Establecer el directorio de trabajo por defecto
WORKDIR /usr/src/app

# ###################
# # ETAPA 2: BUILDER
# # Esta etapa construye el artefacto de producción.
# # Instala TODAS las dependencias (dev y prod) para poder ejecutar el build de Nx.
# ###################
FROM base AS builder

# Argumento para hacer el Dockerfile reutilizable para cualquier aplicación
ARG APP_NAME
ENV APP_NAME=${APP_NAME}
# Variable de entorno para desactivar el daemon de Nx en entornos de CI/CD
ENV NX_DAEMON=false

# Copia los archivos de manifiesto y el .npmrc (clave para el caché)
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Usa --mount=type=cache para una instalación de dependencias ultra rápida.
# El "store" de pnpm se persiste entre builds, haciendo que solo se descarguen
# los paquetes nuevos o modificados.
RUN --mount=type=cache,id=pnpm,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile

# Copia todo el código fuente del monorepo
#COPY . .

# Copiar archivos de configuración de TypeScript y Nx
COPY nx.json tsconfig.base.json ./

# Copiar código fuente
COPY apps/${APP_NAME}/ ./apps/${APP_NAME}/
COPY libs/ ./libs/

# Ejecuta el build de producción. Esto crea la carpeta 'dist' con el código
# transpilado y el 'package.json' de producción optimizado.
RUN pnpm nx build ${APP_NAME} --configuration=production


# #############################################################################
# # ETAPA 3: PRODUCTION
# # Construye la imagen final, que es ligera, segura y optimizada para producción.
# #############################################################################
FROM base AS production

# Argumentos para configurar la aplicación final
ARG APP_NAME
ARG APP_PORT=3000
ENV NODE_ENV=production
ENV PORT=${APP_PORT}

# Copia el package.json y pnpm-lock.yaml generados por Nx desde la etapa 'builder'.
# Estos archivos son la ÚNICA fuente de verdad de las dependencias de producción.
COPY --from=builder /usr/src/app/dist/apps/${APP_NAME}/package.json .
COPY --from=builder /usr/src/app/dist/apps/${APP_NAME}/pnpm-lock.yaml .

# Instala ÚNICAMENTE las dependencias de producción definidas en el package.json generado.
RUN --mount=type=cache,id=pnpm,target=/root/.pnpm-store \
    pnpm install --prod --frozen-lockfile

# Copia el código compilado desde la etapa 'builder'.
COPY --from=builder /usr/src/app/dist/apps/${APP_NAME} .

# Cambia al usuario no-root que creamos en la etapa 'base'.
USER nestjs

# Expone el puerto que la aplicación escuchará.
EXPOSE ${APP_PORT}

# Usa dumb-init como punto de entrada para gestionar las señales correctamente.
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Comando final para ejecutar la aplicación Node.
CMD ["node", "main.js"]

# #############################################################################
# # ETAPA 4: DEVELOPMENT
# # Etapa para desarrollo local con hot-reload.
# #############################################################################
FROM builder AS development

ARG APP_NAME
ARG APP_PORT=3000
ENV NODE_ENV=development
ENV PORT=${APP_PORT}

# Reutilizamos la etapa 'builder' porque ya tiene todas las devDependencies.
# Cambiamos al usuario no-root por buena práctica, incluso en desarrollo.
USER nestjs

EXPOSE ${APP_PORT}

# Comando para iniciar la aplicación en modo desarrollo (hot-reload).
CMD ["pnpm", "nx", "serve", "${APP_NAME}"]