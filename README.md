# Mesa Arcana — Dungeon Master con IA (D&D 5e)

**Mesa Arcana** es una aplicación web interactiva donde una Inteligencia Artificial asume el rol de **Dungeon Master** para narrar partidas de rol de **Dungeons & Dragons 5ª Edición (D&D 5e)**. Permite jugar en solitario o en grupo con amigos de manera online, cada uno encarnando a su propio héroe.

---

## 🌟 Características Principales

- **Dungeon Master con IA en Tiempo Real:** Narración inmersiva impulsada por Google Gemini (`gemini-3.5-flash`). El DM arbitra acciones, describe escenarios, plantea desafíos y actualiza el estado del grupo (vida, inventario y modo de combate).
- **Salón de Héroes y Autenticación:** Registro y login de usuarios con Supabase Auth. Gestión de fichas permanentes de D&D 5e (clase, raza, vida, armadura y atributos).
- **Parties Online con Invitación por Código:** Creación de salas multijugador con código único de 6 caracteres (ej. `K9X2B7`). Los jugadores se unen con su personaje y comparten la mesa en tiempo real.
- **Combate por Turnos Sincronizado:** Modo combate con indicador de turnos, seguimiento de iniciativa y actualización concurrente de puntos de vida (PV) mediante funciones atómicas en la base de datos.
- **Estética Inmersiva de Pergamino:** Diseño visual inspirado en las hojas clásicas de D&D, con textura de pergamino procedural en SVG, marcos góticos, filigranas de dragón y tipografías de fantasía (*Cinzel* y *EB Garamond*).

---

## 🛠️ Stack Tecnológico

- **Frontend & Framework:** [Next.js 16](https://nextjs.org/) (App Router, React 19)
- **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/) + Google Fonts (*Cinzel* y *EB Garamond*)
- **Gestión de Estado:** [Zustand 5](https://zustand-demo.pmnd.rs/)
- **Backend & Base de Datos:** [Supabase](https://supabase.com/) (PostgreSQL 15, Auth, Row Level Security y Realtime Presence/Broadcast)
- **Motor de Inteligencia Artificial:** [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai) (Google Gemini API)
- **Iconografía:** [Lucide React](https://lucide.dev/)

---

## 📋 Requisitos Previos

1. **Node.js:** Versión 18.18 o superior (se recomienda Node 20 LTS).
2. **Proyecto en Supabase:** Cuenta gratuita en [supabase.com](https://supabase.com/).
3. **Clave de Google AI Studio:** Clave de API para acceder a los modelos de Gemini desde [aistudio.google.com](https://aistudio.google.com/).

---

## ⚙️ Configuración del Entorno

Creá un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
# Conexión con Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<tu-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-publishable-key sb_publishable_...>

# Google Gemini AI Studio
GEMINI_API_KEY=<tu-api-key-de-google-ai-studio>
GEMINI_MODEL=gemini-3.5-flash
```

> **Nota de seguridad:** Nunca compartas ni hagas commit de tus claves privadas o credenciales de Supabase en repositorios públicos.

---

## 🗄️ Configuración de la Base de Datos

En el panel de tu proyecto en Supabase, abrí el **SQL Editor** y ejecutá los scripts en el siguiente orden:

1. **`dnd_dm_database_limpio.sql`**: Crea la estructura base de partidas, funciones de sincronización de vida (`update_player_hp`) y tablas iniciales.
2. **`dnd_dm_auth.sql`**: Configura la extensión de perfiles de usuario, fichas permanentes de personajes, triggers de registro automático y políticas de seguridad RLS.
3. **`dnd_dm_parties.sql`**: Implementa el sistema multijugador de parties, generación de códigos únicos de 6 caracteres, vistas relacionales (`v_parties_usuario`, `v_miembros_party`) y funciones RPC para crear y unirse a salas.

> Para más detalles sobre las tablas, vistas, triggers y funciones de la base de datos, consultá el archivo técnico [`docs/base-de-datos.md`](docs/base-de-datos.md).

---

## 🚀 Instalación y Ejecución Local

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abrí [http://localhost:3000](http://localhost:3000) en tu navegador.

3. **Verificar calidad del código y compilación:**
   ```bash
   # Comprobar reglas de ESLint
   npm run lint

   # Generar build optimizado para producción
   npm run build
   ```

---

## 📖 Cómo Jugar

### Modo Rápido (En Solitario / Mesa Local)
1. Entrá en la portada principal.
2. Elegí o creá hasta 5 personajes con su nombre, raza y clase (Guerrero, Mago, Pícaro, Clérigo, etc.).
3. Hacé clic en **Iniciar Partida**.
4. Escribí tu primera acción o pregunta en el chat y el Dungeon Master comenzará a narrar la aventura.

### Modo Multijugador (Party Online con Amigos)
1. Iniciá sesión con tu cuenta de usuario (o registrate en `/registro`).
2. Entrá en **Salón de Parties** (`/parties`).
3. Creá una nueva party (por ejemplo *"La Cripta del Nigromante"*). Se generará automáticamente un **código de invitación de 6 caracteres**.
4. Compartí el código con tus amigos para que se unan desde sus cuentas y seleccionen sus héroes.
5. Una vez reunidos en el lobby, iniciá la aventura y todos los miembros verán la misma crónica e interactuarán por turnos en vivo.

---

## 📂 Estructura del Proyecto

```
DnD-DM/
├── app/
│   ├── api/chat/route.js     # Endpoint del Dungeon Master con Gemini API
│   ├── components/           # Componentes modulares (PlayerCard, MessageBubble, ChatInput)
│   │   └── ui/               # Elementos ornamentales (DragonCorner, BannerTitulo, VitralDM)
│   ├── juego/[id]/page.js    # Mesa de juego en vivo con Realtime
│   ├── parties/page.js       # Listado y creación de parties online
│   ├── party/[codigo]/page.js# Lobby en tiempo real previo a la partida
│   ├── personajes/page.js    # Fichas permanentes de héroes D&D 5e
│   ├── login/page.js         # Inicio de sesión con Supabase Auth
│   ├── registro/page.js      # Registro de nuevas cuentas
│   └── page.js               # Portada y mesa de preparación
├── docs/
│   └── base-de-datos.md      # Documentación académica de PostgreSQL (parcial)
├── lib/
│   └── supabase.js           # Cliente configurado de Supabase
├── store/
│   └── useGameStore.js       # Store global de Zustand (historial, turnos, jugadores)
├── dnd_dm_database_limpio.sql# Script SQL base
├── dnd_dm_auth.sql           # Script SQL de autenticación y personajes
└── dnd_dm_parties.sql        # Script SQL de parties y multijugador
```

---

## 📜 Licencia

Proyecto desarrollado con fines académicos y de entretenimiento bajo licencia MIT.
Contenido y reglas de rol basados en el SRD (System Reference Document) de D&D 5ª Edición.
