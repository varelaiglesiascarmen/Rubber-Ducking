# Ritmo de trabajo con worktrees — QA BillAI

> Documento operativo para agentes. Léelo antes de implementar un issue del
> milestone `QA 2026-11`. La fuente de verdad son los issues de GitHub
> (#61–#77); este documento explica **cómo** trabajarlos en paralelo sin pisarse.

## 1. Para qué sirve

- Evitar que dos agentes editen el mismo fichero a la vez.
- Saber qué issues dependen de cuáles.
- Tener un orden de merge claro.
- Servir de material de aprendizaje sobre OpenCode, sesiones y worktrees.

## 2. Conceptos mínimos

| Concepto | Qué es |
|---|---|
| **Sesión** | Una conversación con historial propio. Se crea con `Ctrl+X N` o `/new`. |
| **Pestaña** | Cada sesión abierta se muestra como pestaña. `Ctrl+Tab` para cambiar. |
| **Agente** | El rol que ejecuta la sesión (`build`, `plan`, `explore`...). Se elige con `/agents`. |
| **Worktree** | Copia de trabajo del repo en otro directorio, con su propia rama. Comparte `.git`. |
| **Rama** | Línea de commits. Cada worktree trabaja en una rama distinta. |
| **Contexto** | Lo que el agente ve: `AGENTS.md`, este documento, los ficheros que lee y el historial. |

**Regla clave:** dos sesiones en el **mismo directorio** comparten ficheros y se
pisan. Para paralelizar de verdad, usa **worktrees**.

## 3. Crear sesiones

```text
Ctrl+X N        nueva sesión (o /new)
Ctrl+X L        listar sesiones (o /sessions)
Ctrl+O          recientes (sesiones + proyectos)
Ctrl+Tab        siguiente pestaña
Ctrl+Shift+Tab  pestaña anterior
Ctrl+X W        cerrar pestaña
Ctrl+Shift+T    reabrir última pestaña cerrada
Ctrl+R          renombrar sesión
/agents         elegir agente
```

Sin TUI:

```bash
opencode run --agent build --title "backend-ws" "Implementa el issue #77"
opencode run --session <id> "continúa"
opencode session list --format json
```

## 4. Crear worktrees

### Opción manual (recomendada)

```bash
cd /home/carmen/miWebDocker
git worktree add ../qa-backend      -b fix/backend-core  main
git worktree add ../qa-backend-ws   -b fix/backend-ws    main
git worktree add ../qa-frontend     -b fix/frontend-core main
git worktree add ../qa-frontend-ui  -b fix/frontend-ui   main
git worktree add ../qa-e2e          -b ci/e2e-qa         main
```

Abre OpenCode en cada uno:

```bash
opencode ../qa-backend-ws
```

### Opción TUI

`Ctrl+P` → **Move session**. En el diálogo:

| Tecla | Acción |
|---|---|
| `Ctrl+A` | Nuevo worktree |
| `Ctrl+M` | Mover la sesión al worktree |
| `Ctrl+D` | Borrar worktree |
| `Ctrl+R` | Refrescar lista |
| `Tab` | Generar nombre |

`session.move` no tiene tecla por defecto; si quieres una, añádela en
`~/.config/opencode/cli.json`.

### Opción agente

Pídeselo a la sesión: "crea un worktree `qa-backend-ws` y mueve esta sesión
allí". El agente tiene herramientas para crear worktrees y mover sesiones.

### Dónde se crean

Por defecto, OpenCode usa su directorio de datos. Para fijar una carpeta:

```jsonc
// opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "worktree": { "directory": "../worktrees" }
}
```

## 5. Mapa de ficheros (quién toca qué)

| Fichero | Issues |
|---|---|
| `backend/main.py` | #61, #65, #66, #70, #77 |
| `backend/core/config.py` | #61, #65 |
| `backend/.env.example` | #61, #64, #65 |
| `docker-compose.yml` | #64, #70 |
| `backend/agents/crew.py` | #61, #77 |
| `backend/agents/auditor.py` | #64, #66 |
| `frontend/.../dashboard-layout.ts` | #62, #63, #67, #68, #69, #71, #72 |
| `frontend/.../dashboard-layout.html` | #62, #63, #68, #69, #72, #73 |
| `frontend/.../dashboard-layout.css` | #62, #63, #69, #72, #73 |
| `frontend/.../agent-ws.service.ts` | #62, #63, #68 |
| `frontend/src/styles.css` | #74, #76 |
| `frontend/src/index.html` | #74 |
| `.github/workflows/ci.yml` | #74, #75 |

**Regla:** si dos issues comparten fichero, no van en paralelo. Se serializan en
la misma sesión o se rebasa la segunda rama antes del PR.

## 6. Dependencias

### Van de la mano

| Cadena | Motivo |
|---|---|
| #63 → #62 | Mismo `agent-ws.service.ts`; #62 usa los estados de #63 |
| #77 → #62 | Contrato "Detener": backend cancela, frontend desbloquea |
| #77 → #65 → #66 → #70 | Los cuatro reescriben el handler WS de `main.py` |
| #61 → #75 | Sin modelo válido no hay E2E real |
| #74 → #76 | Ambos `styles.css` |
| #74 → #75 | Ambos `ci.yml` |

### Comparten configuración

- `.env.example`: #61, #64, #65.
- `docker-compose.yml`: #64, #70.
- `auditor.py`: #64, #66.

### Pueden ir en paralelo

- Backend vs frontend vs estilos globales.
- #64 con #61 (coordinando `.env.example`).
- #76 con lo que no toque `styles.css`.

## 7. Carriles y olas

### Ola 0 — base (primero)

| Sesión | Issues |
|---|---|
| `qa-backend` | #61 → #64 |

Al terminar: merge a `main` y rebase de los demás worktrees.

### Ola 1 — tres carriles en paralelo

| Sesión | Issues (en orden) | Ficheros |
|---|---|---|
| `qa-backend-ws` | #77 → #65 → #66 → #70 | `backend/main.py` |
| `qa-frontend` | #63 → #62 → #67 → #68 → #71 → #72 → #69 → #73 | `dashboard-layout.*` |
| `qa-frontend-ui` | #74 → #76 | `index.html`, `styles.css` |

### Ola 2 — cierre

| Sesión | Issue | Requisito |
|---|---|---|
| `qa-e2e` | #75 | #61, #62, #63, #77 y #74 mergeados |

## 8. Ritmo por issue

1. `gh issue view <n>`: lee Problema, Solución propuesta, Archivos afectados y
   Criterios.
2. Comprueba en la tabla de la sección 5 que no chocas con otro carril.
3. Implementa **solo** los ficheros de "Archivos afectados".
4. Añade o actualiza los tests que pide el issue.
5. Ejecuta la suite: `pytest` en backend, `npm test` en frontend.
6. `git diff --check`.
7. Commit: `fix/<área>-<tema>: <descripción>` (el título del issue).
8. Push y PR. Un PR por issue o por cadena coherente.

## 9. Reglas de merge

1. Orden: `qa-backend` → `qa-backend-ws` → `qa-frontend` → `qa-frontend-ui`
   → `qa-e2e`.
2. Antes de cada PR: `git fetch && git rebase main`.
3. No mergees dos ramas que toquen el mismo fichero sin rebasar la segunda.
4. Tras mergear, actualiza los worktrees: `git -C ../qa-frontend rebase main`.
5. `main` siempre verde: tests y build antes de mergear.

## 10. Docker y puertos

La app corre en `http://localhost:8080` con `docker compose`. **No levantes cinco
instancias**: chocan los puertos.

- Usa **una sola** instancia para QA manual.
- Para tests unitarios, cada worktree puede correr su suite sin Docker.
- Si necesitas varias instancias, parametriza puertos por worktree.

## 11. Checklist antes de decir "terminado"

- [ ] Leí el issue completo y sus criterios.
- [ ] Solo toqué los ficheros de "Archivos afectados".
- [ ] No pisé el trabajo de otro carril.
- [ ] Tests pasan.
- [ ] `git diff --check` limpio.
- [ ] Commit con el título del issue.
- [ ] PR con referencia al issue (`Closes #n`).

## 12. Problemas típicos

| Síntoma | Causa / solución |
|---|---|
| La sesión no ve un cambio de `AGENTS.md` | Un fichero anidado ya cargado no se recarga; abre sesión nueva. |
| Dos agentes se pisan | Están en el mismo directorio. Crea un worktree. |
| `docker compose up` falla por puerto | Ya hay una instancia en `:8080`. Usa una sola o cambia puertos. |
| El PR tiene conflictos | Rebasa sobre `main` y resuelve; no mergees a ciegas. |
| El issue cita líneas que ya no existen | El código cambió: recalcula el rango antes de implementar. |

## 13. Referencias

- Issues: `gh issue list --milestone "QA 2026-11"`.
- OpenCode: `https://opencode.ai/v2/docs/`.
- Instrucciones de proyecto: `AGENTS.md`.
