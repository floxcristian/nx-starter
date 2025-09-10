FROM node:18-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Solo las librerías que usa el frontend
COPY libs/shared-ui/package.json ./libs/shared-ui/

RUN pnpm install --filter front-admin --filter shared-ui --prod --frozen-lockfile

FROM node:18-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY . .
RUN pnpm install --frozen-lockfile

# Build shared-ui + front-admin
RUN pnpm nx build shared-ui
RUN pnpm nx build front-admin --configuration=production

# Usar nginx para servir archivos estáticos
FROM nginx:alpine AS runtime

# Copiar build de Angular
COPY --from=builder /app/dist/apps/front-admin /usr/share/nginx/html

# Configuración nginx para SPA
RUN echo 'server { \
  listen 80; \
  location / { \
    root /usr/share/nginx/html; \
    index index.html index.htm; \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]