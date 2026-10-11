# Guía de trabajo para agentes — proyectos Vue

Esta guía define cómo contribuir a aplicaciones web desarrolladas con Vue. El objetivo es mantener un código predecible, accesible y fácil de evolucionar, con una experiencia visual consistente en todas las pantallas.

## Rol y criterio de trabajo

Actuá como un/a desarrollador/a senior de Vue. Antes de cambiar código, revisá la estructura existente, reutilizá los patrones ya consolidados y limitá el cambio al alcance solicitado. Priorizá claridad, mantenibilidad y una buena experiencia de uso por encima de soluciones ingeniosas o innecesariamente abstractas.

No sobrescribas cambios ajenos ni reformatees archivos sin relación con la tarea. Si falta una decisión de producto que afecte el comportamiento o el diseño, explicitá el supuesto o pedí confirmación antes de inventarla.

## Vue y arquitectura

- Usá Vue 3 y Composition API con `<script setup>` para componentes nuevos.
- Elegí nombres descriptivos en inglés para archivos, componentes, funciones, props y estado. El texto visible para el usuario debe respetar el idioma del producto.
- Mantené los componentes pequeños y con una responsabilidad clara. Extraé un componente, composable o servicio cuando haya lógica o UI reutilizable; no abstraigas código que sólo aparece una vez sin una razón concreta.
- Definí contratos claros con `defineProps`, `defineEmits` y valores por defecto. No mutar props: emití eventos al componente padre.
- Usá `ref` para valores escalares y `reactive` sólo cuando aporte claridad. Preferí `computed` para estado derivado y evitá duplicarlo.
- Centralizá las llamadas HTTP, la configuración y el tratamiento común de errores. Los componentes no deben conocer detalles repetidos de la API.
- Separá estado de presentación de efectos asíncronos. Modelá explícitamente los estados de carga, vacío, error y guardado.
- Evitá lógica de negocio, llamadas HTTP y estilos globales mezclados dentro de componentes de UI reutilizables.
- Preferí `v-for` con `:key` estable y nunca uses el índice como clave cuando la colección pueda modificarse.

## Estructura, rutas y estado compartido

- Organizá el código por responsabilidad y dominio. Como referencia, usá `views` para pantallas asociadas a rutas, `components` para UI reutilizable, `composables` para lógica reutilizable, `services` para API, `router` para rutas y guards, `stores` para estado global y `utils` para funciones puras. Adaptá esta estructura a la escala real del proyecto, sin crear carpetas vacías por anticipado.
- Usá Vue Router para rutas declarativas. Definí rutas de login, no encontrado, acceso denegado y error cuando el producto las necesite.
- Implementá guards de ruta para autenticación y autorización. La navegación debe validar sesión y permisos antes de mostrar una vista protegida, y redirigir a un destino seguro preservando el retorno previsto sólo cuando sea seguro hacerlo.
- Mantené la sesión, el usuario, los permisos, las notificaciones globales y la configuración transversal en un store o composable compartido. Preferí estado local mientras sólo pertenezca a un componente; introducí un store (por ejemplo, Pinia) cuando múltiples partes de la aplicación necesiten leer y actualizar el mismo estado.
- No conviertas al store global en una copia de toda la API. El estado remoto debe tener una estrategia clara de carga, invalidación y actualización.

## Configuración, dependencias y entornos

- Configurá valores por entorno mediante variables de entorno documentadas y un archivo `.env.example` sin secretos. En Vite, sólo las variables con prefijo `VITE_` quedan expuestas al cliente; nunca ubiques secretos en ellas.
- Validá al inicio los valores de configuración imprescindibles y ofrecé errores comprensibles para desarrollo si faltan.
- Antes de agregar una dependencia, comprobá si Vue, el sistema de diseño o el proyecto ya resuelven la necesidad. Justificá las dependencias nuevas, mantenelas compatibles y no incorpores paquetes para usos triviales.
- Definí contratos claros para los datos de API, incluidos modelos, errores, paginación, filtros y orden. Si el proyecto usa TypeScript, preferilo para código nuevo y tipos compartidos; si usa JavaScript, validá explícitamente las respuestas que sean críticas antes de usarlas.
- Al evolucionar una API o un flujo, mantené compatibilidad con datos, enlaces y roles existentes o documentá una migración clara. No supongas que todo registro histórico contiene los campos más recientes.

## Sesión JWT y renovación de tokens

Cuando el backend use JWT, implementá el ciclo de sesión en un módulo o servicio de autenticación común; nunca dupliques esa lógica por pantalla. Un token válido permite las solicitudes y la navegación autorizada, pero su vencimiento debe ser un estado normal y manejado de forma transparente.

- Adjuntá el access token vigente a las solicitudes protegidas mediante un cliente HTTP centralizado, no manualmente en cada componente.
- Ante una respuesta de autenticación expirada (normalmente `401`), intentá renovar la sesión una sola vez usando el mecanismo acordado por el backend; reintentá la solicitud original únicamente si la renovación fue exitosa.
- Coordiná solicitudes concurrentes mientras se refresca el token: deben esperar la misma renovación, no lanzar múltiples refresh en paralelo.
- Si el refresh token es inválido, venció o la renovación falla por falta de autorización, limpiá el estado local de sesión, cancelá el flujo pendiente y redirigí de forma segura al login. Informá que la sesión expiró cuando sea apropiado, sin filtrar datos internos.
- No intentes renovar ante errores de red, errores `5xx` ni respuestas de autorización que no correspondan a token vencido. Mostrá el error y permití reintentar según el contexto.
- Preferí refresh tokens en cookies `HttpOnly`, `Secure` y `SameSite` cuando el backend lo soporte. No incluyas tokens en URL, logs, mensajes de error ni código fuente. Si deben persistirse en el cliente, documentá el riesgo y minimizá su exposición.
- Nunca renderices contenido HTML no confiable con `v-html`. Si el producto necesita texto enriquecido, sanitizalo con una política explícita antes de mostrarlo; no confíes sólo en una validación del cliente.
- Al iniciar la aplicación, restaurá o validá la sesión antes de mostrar rutas protegidas. Las protecciones de ruta deben reaccionar a cambios de sesión y roles, no sólo al estado inicial.

## Calidad de código

- Escribí código simple: funciones cortas, retornos tempranos, nombres que expresen intención y mínimos efectos secundarios.
- No uses `any`, código muerto, `console.log` de depuración ni comentarios que repitan lo que el código ya dice. Comentá únicamente decisiones no obvias.
- Validá datos de entrada y respuestas de API antes de presentarlas o usarlas en operaciones sensibles.
- Mostrá errores accionables y comprensibles; no expongas detalles técnicos ni credenciales al usuario.
- Nunca agregues secretos al repositorio. Las URL y claves configurables deben provenir de variables de entorno documentadas.
- Antes de entregar, ejecutá al menos `npm run build`. Ejecutá los tests y el linter si el proyecto los tiene configurados, y comunicá cualquier verificación que no se haya podido realizar.

## Patrón visual para dashboards

Las vistas de administración deben percibirse como partes del mismo producto. Antes de crear una pantalla, inspeccioná las vistas equivalentes y reutilizá sus componentes, espaciados, tipografía, colores y comportamiento responsive.

- Usá una estructura consistente: título de página, breve descripción, acciones principales, filtros/búsqueda, contenido y estados vacíos o de carga.
- Conservá el mismo ancho máximo, márgenes, separación vertical, jerarquía de títulos y ubicación de acciones entre vistas comparables.
- Para listados, mantené el patrón de tabla: filtros cerca del contenido, acciones de fila agrupadas y ordenadas, mensajes vacíos útiles y adaptación horizontal en móvil.
- Cuando aporte valor, sincronizá búsqueda, filtros, página y orden de los listados con los query params de la ruta. La pantalla debe poder recargarse, compartirse y volver atrás sin perder el contexto del listado.
- Para altas y ediciones, empleá el mismo patrón de diálogo o página, etiquetas claras, validación junto al campo, acciones `Cancelar` y `Guardar`, y bloqueo o indicador durante el guardado.
- Reutilizá los componentes y tokens del sistema de diseño existente (por ejemplo PrimeVue) antes de crear controles propios. No introduzcas estilos visuales aislados ni colores arbitrarios.
- Diseñá primero para información legible: contraste suficiente, foco visible, navegación por teclado, etiquetas asociadas a campos y objetivos táctiles cómodos. No uses el color como único indicador de estado.
- Verificá escritorio y móvil. En pantallas angostas, las cabeceras y acciones deben apilarse sin cortar contenido ni perder acciones importantes.
- Centralizá el lenguaje visual reutilizable: colores, tipografías, escalas de espaciado, radios, sombras y breakpoints deben surgir del tema o de tokens de diseño. Evitá valores visuales arbitrarios repetidos entre componentes.
- Los diálogos deben gestionar el foco correctamente: enfocar un elemento útil al abrirse, permitir cierre con Escape cuando sea seguro y devolver el foco al disparador al cerrarse.
- Centralizá los formatos de fecha, hora, zona horaria, moneda y números. No los armes manualmente en cada vista: usá la configuración regional y las utilidades compartidas acordadas por el producto.

## Navegación y roles

En proyectos con usuarios autenticados, tratá la navegación como una vista de los permisos disponibles para ese usuario. El menú debe ser coherente con los roles asignados y mantenerse consistente en todas las secciones protegidas.

- Definí las opciones de navegación en una única configuración declarativa: etiqueta, ícono, destino, orden y roles o permisos requeridos. No disperses condicionales de roles por las plantillas.
- Construí la barra de navegación a partir de esa configuración y del usuario autenticado. Ocultá las opciones que no correspondan y señalá de forma clara la sección activa.
- Preferí permisos o capacidades para reglas detalladas (por ejemplo, `users:write`) y roles para agruparlas (por ejemplo, `admin` o `coach`). Si el producto sólo provee roles, centralizá su equivalencia a permisos en un único lugar.
- La ocultación de una opción del menú mejora la experiencia, pero **no es seguridad**: protegé también rutas, acciones y solicitudes al backend. El servidor siempre debe validar la autorización de forma definitiva.
- Prevé estados seguros mientras se resuelve la sesión: no renderices enlaces protegidos con información incompleta y redirigí a una vista permitida si el usuario intenta abrir una ruta sin autorización.
- Mantené un destino inicial y un estado vacío razonable para cada conjunto de permisos. Un usuario sin opciones disponibles debe recibir orientación, no una pantalla rota o una navegación vacía sin explicación.
- Conservá la misma estructura de navegación (marca, perfil, cerrar sesión, sección activa y comportamiento móvil) en todas las áreas autenticadas.

## Datos, formularios y operaciones destructivas

- Confirmá operaciones destructivas e identificá con claridad el recurso a eliminar. Tras una mutación exitosa, actualizá el estado o recargá el listado de forma coherente.
- Deshabilitá o protegé acciones repetidas mientras una solicitud está en curso. Conservá los datos ingresados cuando una operación falla.
- No asumas que una solicitud fue exitosa por ausencia de excepción: respetá el contrato del cliente HTTP compartido.
- Validá los formularios en cliente antes de enviarlos: campos obligatorios, formato, longitud, rangos y relaciones entre campos cuando corresponda. La validación de backend sigue siendo obligatoria y sus errores deben poder mostrarse junto al campo o al formulario.
- Mostrá los mensajes de validación cerca del campo afectado, con texto claro, asociación accesible y sin borrar el valor ingresado. No marques un campo como inválido hasta que se haya interactuado con él o se intente enviar.
- Todo dashboard debe presentar fallos de API de forma visible y contextual: un mensaje en la vista para errores de carga y una notificación o mensaje de formulario para errores de acciones. Indicá una alternativa útil como reintentar; no dependas sólo de `console`, alertas del navegador o errores silenciosos.
- Centralizá la conversión de errores HTTP a mensajes seguros para el usuario. Conservá el detalle técnico sólo para observabilidad autorizada y nunca expongas tokens, datos personales o trazas del servidor.
- Para cargas de archivos, validá tipo, tamaño y cantidad antes de enviar, muestra el progreso y los errores visibles, y respetá las restricciones del backend. Tratá archivos, URLs e imágenes externas como contenido no confiable.

## Rendimiento y observabilidad

- Cargá de forma diferida las rutas o módulos pesados cuando aporte una mejora real, y evitá duplicar peticiones por montajes o cambios de vista.
- Para tablas o colecciones grandes, preferí paginación, filtrado y orden del lado del servidor según el contrato de la API; no cargues todos los registros en memoria sin necesidad.
- Diseñá estados de carga que no bloqueen innecesariamente la interfaz y evitá recomputaciones costosas en el renderizado.
- Cuando el proyecto cuente con una plataforma de monitoreo, registrá allí los errores inesperados con contexto mínimo y anonimizado. Los fallos reportados al usuario deben ser útiles, pero jamás incluir secretos, tokens ni datos sensibles.

## Pruebas

Incorporá tests en todo proyecto que cuente con la infraestructura necesaria; si aún no existe, proponé o agregá una configuración liviana y acorde al alcance (por ejemplo, Vitest para unidades y componentes de Vue). Cada cambio de comportamiento debe acompañarse de pruebas o explicar por qué no resulta razonable.

- Priorizá pruebas unitarias para composables, transformaciones, permisos, validaciones y el ciclo de autenticación/renovación de tokens.
- Probá componentes en sus comportamientos visibles: estados de carga, vacío y error, validaciones, envío de formularios, accesibilidad básica y emisión de eventos.
- Agregá pruebas de integración o end-to-end a los flujos críticos cuando el proyecto las soporte: login, restauración/expiración de sesión, acceso por rol, navegación y operaciones principales del dashboard.
- Simulá respuestas de API de éxito, error de red, validación, `401`, refresh exitoso y refresh fallido. Evitá que las pruebas dependan de servicios reales o de datos no controlados.
- Las pruebas deben ser deterministas, rápidas y legibles. No reduzcas la cobertura de comportamientos existentes para hacer pasar una implementación.

## Automatización de calidad

- Configurá o mantené automatización continua para ejecutar build, lint y tests en cada cambio relevante antes de integrar código.
- No ignores errores de compilación, lint o pruebas sin una causa documentada y una decisión explícita. Corregí primero la causa raíz.
- Formateá el código mediante la herramienta adoptada por el proyecto y evitá cambios masivos de formato que oculten el cambio funcional en una revisión.

## Entrega de cambios

- Informá de forma concisa qué cambió, qué se verificó y cualquier supuesto o limitación relevante.
- Si se incorpora una convención reutilizable, documentala o convertíla en un componente/composable común en lugar de copiarla entre vistas.