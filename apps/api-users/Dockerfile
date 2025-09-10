
FROM node:22-alpine AS base

# Habilitar corepack y preparar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Instalar dumb-init para manejo correcto de señales
RUN apk add --no-cache dumb-init

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /usr/src/app

###################
# BUILD STAGE
###################
FROM base AS build

ARG APP_NAME=api-users
ENV APP_NAME=${APP_NAME}
ENV NX_DAEMON=false


# Copiar archivos de configuración del workspace
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc* ./

# Copiar package.json específico de la aplicación
#COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/ # el app debería tener package.json?
COPY libs/users-domain/package.json ./libs/users-domain/

# Copiar archivos de configuración de TypeScript y NX
COPY tsconfig.base.json nx.json ./

# Para el build stage necesitamos todas las dependencias
#RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
 #   pnpm install --frozen-lockfile

# Instalar dependencias con cache mount para optimización
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm add -g nx@21.5.1 && \
    pnpm install --filter ${APP_NAME} --filter libs/users-domain --frozen-lockfile

# Copiar código fuente
COPY libs/users-domain ./libs/users-domain
COPY apps/${APP_NAME}/ ./apps/${APP_NAME}/

# Build de la aplicación
RUN pnpm exec nx build users-domain
RUN pnpm exec nx build ${APP_NAME}


###################
# PRODUCTION DEPS
###################
FROM base AS production-deps

ARG APP_NAME=api-users

# Copiar archivos de configuración del workspace para dependencias
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
#COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/
COPY libs/users-domain/package.json ./libs/users-domain/


# Instalar SOLO dependencias de producción con cache
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter ${APP_NAME} --filter libs/users-domain --prod --frozen-lockfile

# Limpiar store de pnpm para reducir tamaño
RUN pnpm store prune

###################
# PRODUCTION
###################
FROM node:22-alpine AS production

ARG APP_NAME=api-users
ARG APP_PORT=3001
ENV APP_NAME=${APP_NAME}
ENV NODE_ENV=production
ENV PORT=${APP_PORT}

# Instalar dumb-init para manejo correcto de señales
RUN apk add --no-cache dumb-init

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /usr/src/app

# Copiar dependencias de producción
COPY --from=production-deps --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules

# Copiar build compilado (ya JavaScript, no necesita tsconfig)
COPY --from=build --chown=nestjs:nodejs /usr/src/app/dist/apps/${APP_NAME} ./dist


# Exponer puerto
EXPOSE ${APP_PORT}

# Cambiar a usuario no-root
USER nestjs

# Usar dumb-init como entrypoint para manejo correcto de señales
ENTRYPOINT ["dumb-init", "--"]

# Comando para ejecutar la aplicación
#CMD ["node", "dist/apps/api-users/main"]
CMD ["node", "dist/main.js"]

###################
# DEVELOPMENT
###################
FROM build AS development

ARG APP_NAME=api-users
ARG APP_PORT=3001
ENV APP_NAME=${APP_NAME}
ENV NODE_ENV=development
ENV PORT=${APP_PORT}

# Exponer puerto para desarrollo
EXPOSE ${APP_PORT}

# Comando para desarrollo con hot reload
CMD ["pnpm", "run", "start:dev", "api-users"]