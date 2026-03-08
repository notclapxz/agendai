# Fase 5 · Deploy & Dominio

Duración estimada: 1 día  
Dependencias: Fase 4 completa

---

## Objetivos

La app está en `https://agenda.mlpperu.com`, instalable como PWA nativa en tablet y PC.

---

## Paso 1 · Variables de entorno en Vercel

En Vercel Dashboard → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL         = https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    = [ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY        = [SERVICE_ROLE_KEY]
NEXT_PUBLIC_VAPID_PUBLIC_KEY     = [VAPID_PUBLIC]
VAPID_PRIVATE_KEY                = [VAPID_PRIVATE]
VAPID_SUBJECT                    = mailto:admin@mlpperu.com
```

Environment: Production + Preview (todas las vars)

---

## Paso 2 · Agregar dominio en Vercel

1. Vercel Dashboard → Project → Settings → Domains
2. Agregar: `agenda.mlpperu.com`
3. Vercel mostrará el valor CNAME a configurar

---

## Paso 3 · Configurar CNAME en GoDaddy

1. Ir a `godaddy.com` → iniciar sesión con las credenciales del abogado
2. Mis Productos → `mlpperu.com` → DNS → Administrar DNS
3. Agregar registro:
   - **Tipo**: CNAME
   - **Host**: `agenda`
   - **Apunta a**: `cname.vercel-dns.com`
   - **TTL**: 1 hora (600 segundos)
4. Guardar

> Propagación DNS: puede tardar entre 5 minutos y 48 horas. Normalmente < 30 min.

---

## Paso 4 · Verificar HTTPS

Vercel provisiona certificado SSL automáticamente via Let's Encrypt.  
Verificar en: `https://agenda.mlpperu.com` → candado verde en navegador.

---

## Paso 5 · Instalar PWA en tablet Samsung

1. Abrir Chrome en la tablet
2. Ir a `https://agenda.mlpperu.com`
3. Login
4. Chrome mostrará "Agregar a pantalla de inicio" (banner o menú ⋮ → Instalar app)
5. La app aparece en el home screen con el ícono de MLP
6. Abrirla → verificar que abre sin barra de Chrome (modo standalone)
7. Activar notificaciones cuando pregunte

---

## Paso 6 · Instalar PWA en PC Windows

1. Abrir Edge o Chrome en el PC
2. Ir a `https://agenda.mlpperu.com`
3. Login
4. En Edge: barra de dirección → ícono de instalación
   En Chrome: ⋮ → Instalar agenda legal
5. La app aparece en el escritorio y en el menú de inicio
6. Activar notificaciones

---

## Paso 7 · Crear usuario del abogado

En Supabase Dashboard → Authentication → Users → Invite user:
- Email: [email del abogado]
- Crea contraseña segura
- El abogado recibe email de invitación (o se le da la contraseña directamente)

---

## Verificación final

- [ ] `https://agenda.mlpperu.com` carga con HTTPS
- [ ] Login funciona en producción
- [ ] App instalable en tablet Samsung (icono en home screen)
- [ ] App instalable en PC Windows (icono en escritorio)
- [ ] Notificaciones funcionan en ambos dispositivos
- [ ] Crear tarea en tablet → aparece en PC (sync realtime)
- [ ] Carry-over funciona en producción
- [ ] Resumen 7:20 AM llega correctamente (verificar el día siguiente)
- [ ] Crons corriendo (Supabase Dashboard → Database → Cron Jobs)

---

## Post-deploy: dar de alta al abogado

Script de onboarding para el abogado:
1. Abrir `agenda.mlpperu.com` en Chrome (tablet)
2. Ingresar email y contraseña
3. Instalar app desde el banner
4. Cuando pregunte "¿Permitir notificaciones?" → Permitir
5. La app abre en HOY → ya puede empezar a usarla

Tiempo estimado de onboarding: **3 minutos**.
