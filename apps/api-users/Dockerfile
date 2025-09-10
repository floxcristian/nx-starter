FROM node:18-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm

# Copiar workspace config
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Solo copiar las librerías que SÍ usa api-users
COPY libs/users-domain/package.json ./libs/users-domain/

# Instalar solo dependencias de api-users + users-domain
RUN pnpm install --filter api-users --filter users-domain --prod --frozen-lockfile

FROM node:18-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY . .
RUN pnpm install --frozen-lockfile

# Build solo las librerías que necesita api-users
RUN pnpm nx build users-domain
RUN pnpm nx build api-users

FROM node:18-alpine AS runtime
WORKDIR /app

RUN addgroup -g 1001 -S nestjs && adduser -S nestjs -u 1001

COPY --from=deps --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/dist/apps/api-users ./dist

USER nestjs
EXPOSE 3000

CMD ["node", "dist/main.js"]