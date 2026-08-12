# Rubber-Ducking w/ BillAI (DevAgent.mesh)

Monorepo de producción con Angular 21 + FastAPI + CrewAI para refactorización
automática de código mediante un pipeline multi-agente.

## Estructura del Proyecto

```
miWebDocker/
├── docker-compose.yml       ← Orquestación (frontend + backend + proxy)
├── nginx-proxy.conf         ← Proxy reverso unificado en :8080
├── AGENTS.md                ← Este archivo
│
├── frontend/                ← Angular 21 Standalone + Material
│   ├── Dockerfile           ← Multi-stage (node:22 build → nginx:alpine)
│   ├── nginx.conf           ← SPA fallback
│   ├── package.json
│   ├── src/
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── styles.css       ← Sistema Coquette Tech (dark, rosa, lavanda)
│   │   ├── material-theme.scss
│   │   └── app/
│   │       ├── app.config.ts
│   │       ├── app.routes.ts
│   │       ├── app.ts
│   │       └── features/
│   │           └── dashboard/dashboard-layout/  ← Shell 3 columnas
│   └── public/logo.svg      ← Logotipo del patito BillAI
│
└── backend/                 ← FastAPI + CrewAI + Groq
    ├── Dockerfile           ← python:3.11-slim
    ├── requirements.txt
    ├── .env.example         ← GROQ_API_KEY necesaria
    ├── main.py              ← FastAPI + WebSocket /ws/agents
    ├── core/
    │   ├── config.py        ← Settings (env vars)
    │   ├── models.py        ← Pydantic schemas
    │   └── websocket_manager.py  ← Conexiones WS + streaming
    └── agents/
        ├── crew.py          ← Orquestador CrewAI secuencial
        ├── auditor.py       ← Agente 1: Análisis sintáctico
        ├── programmer.py    ← Agente 2: Refactorización a Signals
        └── validator.py     ← Agente 3: Validación por AST
```

## Comandos

```bash
# Construir todo
docker compose build

# Levantar servicios
docker compose up -d

# Ver logs
docker compose logs -f

# Acceder
# → http://localhost:8080 (proxy unificado)
# → http://localhost:8080/health (health check backend)

# Detener
docker compose down
```

## Pipeline de Agentes

1. **Auditor de Sintaxis** — Analiza el código con AST + Groq, reporta errores
2. **Programador Signals** — Refactoriza a Angular Signals reactive pattern
3. **Validador AST** — Valida el código refactorizado con AST + Groq

## Variables de Entorno

Crear `backend/.env` basado en `backend/.env.example`:

```
GROQ_API_KEY=gsk_tu_api_key_aqui
GROQ_MODEL=llama3-70b-8192
```

## Diseño UI

- **Fondos:** ultra oscuros #080a0f, superficies #111420
- **Acentos:** rosa #ff7ebb, lavanda #cba3f9
- **Layout:** 3 columnas (config | editores gemelos | monitoreo)

## UI VERIFICADO EN LOCAL (no tocar salvo petición explícita)

- **Iconos:** fuente Material Icons cargada en `frontend/src/index.html`; el CSP
  del proxy (`nginx-proxy.conf`) permite `fonts.googleapis.com`/`fonts.gstatic.com`.
- **Copiar código refactorizado:** icono plano `content_copy` (sin caja) anclado
  a la ventana de salida, con fallback `execCommand`.
- **Layout 3 columnas:** sidebar usa `position:relative` en
  `.mat-drawer-inner-container` (NO en el drawer). Editores y "Flujo de Trabajo"
  van a la derecha del sidebar y el scroll es interno por panel
  (`min-height:0`/`minmax(0,1fr)` en breakpoints).
- **Sidebar:** colapsa/abre con `chevron_left`/`chevron_right`, mode `over` en
  móvil + auto-cierre en ≤1024px. Tooltips con Delay 2000ms.
- **Animación objetivos dinámicos:** `@objectiveFlash` con `:enter`/`:leave`
  (solo se muestran los objetivos del stack activo).

Convenciones: `main` está capada (solo merge vía PR); merges con
`gh pr merge --squash --delete-branch --admin` tras verificación en local.
