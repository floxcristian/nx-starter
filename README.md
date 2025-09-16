# NxStarter

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is almost ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/getting-started/tutorials/angular-monorepo-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Finish your CI setup

[Click here to finish setting up your workspace!](https://cloud.nx.app/connect/QVbGr2TYES)

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve front-admin
```

To create a production bundle:

```sh
npx nx build front-admin
```

To see all available targets to run for a project, run:

```sh
npx nx show project front-admin
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/angular:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/angular:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## OpenAPI para Google Cloud API Gateway

Este proyecto incluye herramientas para generar especificaciones OpenAPI optimizadas para Google Cloud API Gateway.

### Comandos disponibles:

```bash
# Generar especificación OpenAPI para DESARROLLO (por defecto)
npm run openapi:generate
# o usando Nx
nx run openapi-tools:generate

# Generar para PRODUCCIÓN
nx run openapi-tools:generate:production

# Validar especificación generada
npm run openapi:validate
# o usando Nx
nx run openapi-tools:validate

# Desplegar a Google Cloud API Gateway
npm run gateway:deploy
# o usando Nx
nx run openapi-tools:deploy
```

**⚠️ Nota:** Para generar especificaciones de producción, usa siempre el comando explícito `nx run openapi-tools:generate:production`.

### Configuración requerida:

```bash
# Variables de entorno para los servicios
export USERS_BACKEND_URL=https://users-api.example.com
export ORDERS_BACKEND_URL=https://orders-api.example.com

# Variables opcionales para Google Cloud
export GOOGLE_CLOUD_PROJECT=mi-proyecto-id
export GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
```

Más información detallada en `tools/openapi/README.md`.

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/getting-started/tutorials/angular-monorepo-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

# Creación

## Paso 1: Crear el workspace inicial

```bash
pnpm create-nx-workspace@latest nx-starter
```

**Seleccionar en la GUI:**

- **Preset:** Angular
- **Integrated monorepo or standalone project:** integrated
- **Application name:** `front-admin`
- **Bundler:** esbuild
- **Style format:** SCSS
- **Server-side rendering:** Sí
- **Unit test:** Jest
- **E2E test runner:** Playwright
- **CI Provider:** Github Actions
  nx g @nx/nest:app apps/api-users
  nx g @nx/nest:app apps/api-orders

## Paso 2: Configurar pnpm workspace

- Añadir al archivo `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'libs/*'
```

## Paso 3: Instalar plugins y generar aplicaciones

- Instalar plugin de NestJS

```bash
nx add @nx/nest
```

# Generar las APIs

nx g @nx/nest:app apps/api-users
nx g @nx/nest:app apps/api-orders

# Generar las librerías de dominio

nx g @nx/nest:lib --name=users-domain --directory=libs/users-domain --buildable
nx g @nx/nest:lib --name=orders-domain --directory=libs/orders-domain --buildable

# Generar librería compartida para UI

nx g @nx/angular:lib --name=shared-ui --directory=libs/shared-ui --buildable

# Instalar dependencias

- Instalar dependencias compartidas:
  pnpm add class-validator class-transformer @nestjs/swagger -w

- Instalar dependencias específicas de una librería:
  pnpm add bcryptjs --filter @nx-starter/users-domain
  "@nestjs/jwt": "^11.0.0",
  "@nestjs/passport": "^11.0.5",
  "bcryptjs": "^3.0.2"

  pnpm add @nestjs/jwt @nestjs/passport bcryptjs --filter @nx-starter/users-domain

pruebita
