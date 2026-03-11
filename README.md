# Agendai

**Tu agenda inteligente, siempre lista — en cualquier dispositivo.**

Agendai es una PWA (Progressive Web App) de agenda diaria potenciada con IA. Diseñada para profesionales que necesitan organizar su día con rapidez: dictás por voz, la IA interpreta tus tareas, y las tenés listas en segundos. Sin fricciones, sin instalar nada.

---

## ✨ Características

### 🎙️ Entrada por voz con IA
Dictás lo que necesitás hacer y la IA (GPT-4o) transcribe, clasifica y estructura tus tareas automáticamente. Detecta el tipo (audiencia, reunión, llamada, plazo…), la hora si la mencionás, y la fecha si es para otro día. Todo en un solo dictado.

### 📅 Vista de agenda y calendario
Navegá por días con scroll horizontal o activá la vista mensual para tener el panorama completo. Los días con tareas se marcan visualmente para que sepas de un vistazo qué días tenés compromisos.

### 🔔 Notificaciones push
Recibís alertas automáticas en tu dispositivo:
- **Resumen matutino** con todas las tareas del día
- **Recordatorios** 3 días, 1 día y 1 hora antes de audiencias, reuniones y plazos
- Funcionan aunque la app esté cerrada, como cualquier notificación nativa

### 🔄 Carry-over automático
Las tareas pendientes del día anterior se arrastran solas al día de hoy. No perdés nada por no haberlo tachado a tiempo.

### ↕️ Reordenamiento drag & drop
Reorganizás tus tareas con arrastrar y soltar para priorizar lo que importa.

### 📱 PWA — Instalable en cualquier dispositivo
Funciona como app nativa en iPhone, Android y escritorio. Sin App Store, sin Play Store. Entrás a la URL, la instalás desde el browser y la tenés en tu pantalla de inicio.

### ⚡ Tiempo real
Los cambios se sincronizan al instante entre todos tus dispositivos vía Supabase Realtime.

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| UI | [React 19](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| Base de datos | [Supabase](https://supabase.com/) (PostgreSQL + Realtime + Auth + RLS) |
| IA | [OpenAI GPT-4o](https://platform.openai.com/) (transcripción y extracción estructurada) |
| Push | Web Push API + VAPID |
| Deploy | [Vercel](https://vercel.com/) |
| Lenguaje | TypeScript strict |

---

## 🚀 Instalación local

### Prerequisitos

- Node.js 20+
- Cuenta en [Supabase](https://supabase.com/)
- API Key de [OpenAI](https://platform.openai.com/)

### 1. Clonar el repositorio

```bash
git clone https://github.com/notclapxz/agendai.git
cd agendai
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Completá el archivo con tus credenciales:

```env
# Supabase — obtener desde: supabase.com → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]

# OpenAI — obtener desde: platform.openai.com/api-keys
OPENAI_API_KEY=[OPENAI_API_KEY]

# VAPID — generar con: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=[PUBLIC_KEY]
VAPID_PRIVATE_KEY=[PRIVATE_KEY]
VAPID_SUBJECT=mailto:tu@email.com
```

### 3. Configurar la base de datos

Ejecutá la migración inicial en tu proyecto de Supabase:

```bash
# Desde el SQL Editor de Supabase, ejecutá el contenido de:
supabase/migrations/20260211_initial.sql
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

---

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── agenda/          # Vista principal (auth guard)
│   ├── login/           # Autenticación
│   └── api/
│       ├── push/        # Suscripción a notificaciones push
│       └── voice/       # Pipeline IA: transcripción → extracción de tareas
├── components/
│   ├── agenda/          # AgendaLayout, CalendarView, DayView, TaskItem, RecordingPanel…
│   └── ui/              # Componentes shadcn/ui
├── hooks/
│   ├── useTasks.ts      # CRUD + realtime + carry-over
│   └── usePush.ts       # Web Push subscription
└── lib/
    ├── supabase/        # Clientes browser y servidor
    ├── types/           # Tipos TypeScript — fuente de verdad
    └── utils/           # dates, task-parser, carry-over
supabase/
├── migrations/          # Schema inicial
└── functions/           # Edge Functions (cron: resumen + recordatorios)
```

---

## 🔒 Seguridad

- **Row Level Security (RLS)** habilitada en todas las tablas — cada usuario solo accede a sus propios datos
- **Autenticación** manejada por Supabase Auth (email/password)
- **Variables de entorno** nunca commiteadas al repositorio
- **Service Role Key** usada únicamente en servidor (Edge Functions), nunca expuesta al cliente

---

## 📋 Tipos de tarea soportados

| Tipo | Ícono | Recordatorio automático |
|------|-------|------------------------|
| Tarea | 📄 | Solo resumen matutino |
| Audiencia | ⚖️ | 3d · 1d · 1h antes |
| Reunión | 🤝 | 3d · 1d · 1h antes |
| Llamada | 📞 | Solo resumen matutino |
| Plazo | ⏰ | 3d · 1d · 1h antes |
| Escrito | 📝 | Solo resumen matutino |
| Otro | 📌 | Solo resumen matutino |

---

## 🌐 Deploy en Vercel

```bash
npx vercel --prod
```

Configurá las mismas variables de entorno en el dashboard de Vercel antes del deploy.

---

## 💼 ¿Querés esta app para tu negocio?

Esta aplicación está disponible como producto personalizable. Si te interesa una versión adaptada a tu industria, flujo de trabajo o marca, podemos hablar.

📩 **Contacto**: [sebastian_zagrev@hotmail.com](mailto:sebastian_zagrev@hotmail.com)

---

## 📄 Licencia

MIT — libre para usar, modificar y distribuir.
