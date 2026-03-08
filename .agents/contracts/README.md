# Contracts — Fuente de verdad del sistema

Este proyecto usa **Supabase JS client directamente** desde el frontend.  
No hay API REST separada. El "contrato" es el schema de la base de datos y los tipos TypeScript.

## Archivo único

**`types.md`** — Contiene:
1. Schema SQL completo (migrations)
2. Tipos TypeScript que mapean exactamente al schema
3. Utilidades de parsing (task-parser)
4. Reglas de negocio críticas

## Regla de oro

Si cambia la base de datos → actualizá `types.md` → actualizá `src/lib/types/database.ts`

Estos dos archivos deben estar siempre sincronizados.
