This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Panel del DM (`/dm`)

Dashboard para llevar una sesión: iniciativa, PV, CA, condiciones, turnos/rondas, notas del encuentro y registro de combate. Se guarda solo (autosave) y se puede cargar, duplicar, exportar e importar.

**Setup (Supabase)**
1. Crea `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Ejecuta `supabase_dm_dashboard.sql` en el SQL Editor (añade columnas a `partidas`; no rompe el chat con IA).
3. `npm run dev` → abre `/dm`.

Sin variables de entorno el panel funciona en modo local (localStorage).

**Atajos:** `Espacio`/`N`/`→` siguiente turno · `P`/`←` anterior · `A` añadir · `Ctrl+Z` deshacer.
**Campo de PV:** `7` daño · `+7` curación · `t5` PV temporales · `⇧+Enter` cura.
