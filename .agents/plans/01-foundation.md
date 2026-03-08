# Fase 1 · Foundation

Duración estimada: 2 días  
Dependencias: Ninguna

---

## Objetivos

Proyecto corriendo localmente, conectado a Supabase, con login funcional y PWA base instalable.

---

## Tareas

### 1.1 Crear proyecto Next.js

```bash
cd /Users/sebastian/Desktop
npx create-next-app@latest agenda-legal \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

Luego instalar dependencias:

```bash
cd agenda-legal
npm install @supabase/ssr @supabase/supabase-js
npm install next-pwa
npm install web-push
npm install @types/web-push -D
npm install lucide-react
npm install date-fns
npm install clsx tailwind-merge
```

Instalar shadcn/ui:
```bash
npx shadcn@latest init
npx shadcn@latest add button input dialog badge separator toast
```

### 1.2 Configurar TypeScript strict

Verificar en `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 1.3 Crear proyecto Supabase

1. Ir a supabase.com → New project
2. Nombre: `agenda-legal`
3. Region: **South America (São Paulo)** — más cercano a Lima
4. Guardar las credenciales en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]

# VAPID (generar con: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=[PUBLIC_KEY]
VAPID_PRIVATE_KEY=[PRIVATE_KEY]
VAPID_SUBJECT=mailto:admin@mlpperu.com
```

### 1.4 Aplicar migration inicial

En el SQL Editor de Supabase Dashboard, ejecutar el contenido completo de:
`.agents/contracts/types.md` → sección "Schema SQL"

Verificar que las 4 tablas fueron creadas: `tasks`, `push_subscriptions`, `user_preferences`, `notifications_log`

### 1.5 Crear cliente Supabase

`src/lib/supabase/client.ts` — cliente browser  
`src/lib/supabase/server.ts` — cliente SSR (async)

Patrón idéntico al proyecto `abogados-app` existente.

### 1.6 Configurar PWA

En `next.config.ts`:
```typescript
import withPWA from 'next-pwa'

const config = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

export default config
```

Crear `public/manifest.json`:
```json
{
  "name": "Agenda Legal",
  "short_name": "Agenda",
  "description": "Agenda personal del estudio MLP",
  "start_url": "/agenda",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e40af",
  "orientation": "landscape",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

> **Nota**: Los íconos PNG los crea Sebastian (logo MLP). Tamaños: 192x192 y 512x512.

### 1.7 Pantalla de login

`src/app/login/page.tsx` — Client Component  
- Email + password
- Supabase `signInWithPassword`
- Redirect a `/agenda` si ya autenticado
- Sin registro (el usuario se crea manualmente en Supabase Dashboard)
- Diseño simple: centrado, logo MLP, campo email, campo password, botón

### 1.8 Ruta raíz → redirect

`src/app/page.tsx`:
```typescript
import { redirect } from 'next/navigation'
export default function Home() {
  redirect('/agenda')
}
```

### 1.9 Middleware de protección de rutas

`src/middleware.ts` — verificar sesión, redirect a `/login` si no autenticado.

### 1.10 Tipos base

Copiar el contenido de `.agents/contracts/types.md` → sección "Tipos TypeScript" a `src/lib/types/database.ts`

### 1.11 Deploy inicial a Vercel

```bash
# Conectar repo a Vercel (GitHub o Vercel CLI)
npx vercel
# Agregar las env vars en Vercel Dashboard
# El dominio temporal estará en agenda-legal-xxx.vercel.app
```

---

## Checklist de done

- [ ] `npm run build` pasa sin errores
- [ ] `npm run lint` pasa con 0 errores
- [ ] Login funciona (puede autenticarse con usuario creado en Supabase)
- [ ] Redirige a `/agenda` después del login
- [ ] Las 4 tablas existen en Supabase
- [ ] App instalable en Chrome (aparece botón "Instalar" en barra de dirección)
- [ ] Deploy en Vercel funciona
