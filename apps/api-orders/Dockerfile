FROM node:18-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Solo las librerías que usa api-orders
COPY libs/orders-domain/package.json ./libs/orders-domain/

RUN pnpm install --filter api-orders --filter orders-domain --prod --frozen-lockfile

FROM node:18-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY . .
RUN pnpm install --frozen-lockfile

# Build orders-domain + api-orders
RUN pnpm nx build orders-domain
RUN pnpm nx build api-orders

FROM node:18-alpine AS runtime
WORKDIR /app

RUN addgroup -g 1001 -S nestjs && adduser -S nestjs -u 1001

COPY --from=deps --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/dist/apps/api-orders ./dist

USER nestjs
EXPOSE 3001

CMD ["node", "dist/main.js"]