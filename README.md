# storeApp

Tienda pública creada con Vue 3 y Vite.

## Configuración de la API

El proyecto usa `VITE_API_BASE_URL` como URL del backend. Si no está definida, conserva el túnel de desarrollo actual como valor predeterminado.

Para desarrollo local, copiá `.env.example` como `.env` y modificá el valor si hace falta. Vite recarga las variables sólo al reiniciar `npm run dev`.

Para Cloudflare Workers Builds, configurá las variables en sus dos contextos correspondientes y hacé un nuevo deployment:

- En **Settings → Builds → Build variables**, definí `VITE_API_BASE_URL`: URL pública del backend durante el build; también se usa para resolver URLs de imágenes relativas.
- En **Settings → Variables and Secrets**, definí `API_BASE_URL` con la misma URL. El Worker la usa al reenviar las solicitudes `/api` en tiempo de ejecución.

El Worker definido en `worker/index.js` sirve los archivos de `dist`, mantiene el fallback de Vue para rutas como `/:storeSlug` y reenvía las solicitudes de la tienda al backend en el mismo origen, por lo que no es necesario abrir CORS. En Cloudflare Workers Builds, usá `npm run build` como comando de build, `npx wrangler deploy --config wrangler.jsonc` como comando de deploy y `npx wrangler preview --config wrangler.jsonc` como comando de preview.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
