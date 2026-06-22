# Rubber-Ducking w/ BillAI

**Refactorización automática de código Angular mediante un pipeline multi-agente con IA.**

Rubber-Ducking w/ BillAI automatiza la migración de código Angular legacy al patrón moderno de **Signals** utilizando un pipeline secuencial de 3 agentes de IA (CrewAI + Groq LLM) que analizan, refactorizan y validan el código en tiempo real.

El nombre evoca la técnica del *Rubber Duck Debugging* — explicar tu código a un patito de goma para encontrar errores — pero aquí el patito es reemplazado por agentes de IA especializados que no solo escuchan, sino que transforman activamente tu código.

---

## Arquitectura del Sistema

```
Navegador → localhost:8080 → nginx-proxy
  ├── /       → frontend (Angular 21 SPA)
  ├── /ws/    → backend (WebSocket /ws/agents)
  └── /health → backend health check
```

Tres servicios Docker orquestados con Docker Compose:

| Servicio | Tecnología | Puerto Interno | Rol |
|----------|-----------|----------------|-----|
| **frontend** | Angular 21 Standalone + nginx:alpine | 80 | Interfaz de usuario Coquette Tech |
| **backend** | FastAPI + Uvicorn + CrewAI | 8000 | Pipeline multi-agente con Groq LLM |
| **proxy** | nginx:stable-alpine | **8080** (público) | Proxy reverso unificado |

---

## Pipeline Multi-Agente

Pipeline secuencial de 3 etapas. Cada agente recibe la salida del anterior y transmite su progreso vía WebSocket:

| Fase | Agente | Rol | Función |
|------|--------|-----|---------|
| 1 | **Syntax Auditor** | Auditor de Sintaxis | Analiza el código con AST, detecta errores, anti-patrones y code smells |
| 2 | **Signal Refactoring Engineer** | Programador Signals | Refactoriza a Signals: signal, computed, effect, input, output |
| 3 | **AST Validator** | Validador AST | Valida el código refactorizado, verifica type safety y breaking changes |

### Reglas de Refactorización

1. `BehaviorSubject` / `Subject` → `signal()`
2. `async` pipes → `computed()` o `toSignal()`
3. `ngOnChanges` → `effect()` o `computed()`
4. `@Input()` → `input()` (signal inputs)
5. `@Output()` → `output()`
6. Eliminar `NgZone` cuando sea posible
7. `linkedSignal()` para estado dependiente

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Angular 21 Standalone, Angular Material 3, Signals, RxJS 7 |
| **Backend** | Python 3.11, FastAPI 0.115, Uvicorn 0.34, WebSockets |
| **Agentes IA** | CrewAI 0.108, Groq API (llama3-70b-8192), OpenAI SDK |
| **Proxy** | nginx stable-alpine (proxy reverso con soporte WebSocket) |
| **Infraestructura** | Docker Compose, multi-stage builds |
| **Testing** | pytest (backend, 15 tests), Vitest (frontend, 20 tests) |
| **CI/CD** | GitHub Actions (build + test automáticos en push/PR a main) |

---

## Diseño UI — Coquette Tech

Tema oscuro con acentos rosa y lavanda desarrollado por Carmen Varela Iglesias:

| Token | Valor | Uso |
|-------|-------|-----|
| `--bg-main` | `#080a0f` | Fondo principal ultra oscuro |
| `--bg-surface` | `#111420` | Superficies (sidebar, tarjetas) |
| `--pink-primary` | `#ff7ebb` | Acento primario rosa |
| `--pink-neon` | `#ff409f` | Hover neón |
| `--lavender` | `#cba3f9` | Acento terciario lavanda |
| `--text-main` | `#f3f4f7` | Texto principal |
| `--code-bg` | `#0b0d14` | Fondo del editor |

Layout responsive de 3 columnas: configuración (280px) | editores gemelos (código original / refactorizado) | monitoreo (agentes + consola).

---

## Cómo Empezar

### Prerrequisitos

- Docker y Docker Compose
- API key de Groq (gratuita en [console.groq.com](https://console.groq.com))

### Instalación

```bash
# Clonar
git clone https://github.com/varelaiglesiascarmen/Rubber-Ducking.git
cd Rubber-Ducking

# Configurar API key
cp backend/.env.example backend/.env
# Editar backend/.env y añadir GROQ_API_KEY

# Construir y levantar
docker compose build
docker compose up -d

# Acceder → http://localhost:8080
```

### Comandos Útiles

```bash
# Ver logs
docker compose logs -f

# Tests del backend
docker compose run --rm backend python3 -m pytest tests/ -v

# Tests del frontend (requiere Node.js local)
cd frontend && npm test

# Detener
docker compose down
```

---

## Variables de Entorno

| Variable | Requerida | Defecto | Descripción |
|----------|-----------|---------|-------------|
| `GROQ_API_KEY` | Sí | — | API key de Groq |
| `GROQ_MODEL` | No | `llama3-70b-8192` | Modelo LLM |
| `WS_MAX_CONNECTIONS` | No | `10` | Conexiones WebSocket simultáneas |
| `AGENT_TIMEOUT` | No | `120` | Timeout por agente (segundos) |
| `MAX_WORKERS` | No | `4` | Hilos del ThreadPoolExecutor |
| `CORS_ALLOWED_ORIGINS` | No | `["http://localhost:8080"]` | Orígenes CORS permitidos |

---

## Estructura del Proyecto

```
Rubber-Ducking/
├── docker-compose.yml          # Orquestación (frontend + backend + proxy)
├── nginx-proxy.conf            # Proxy reverso unificado en :8080
├── README.md                   # Documentación principal
├── AGENTS.md                   # Documentación del pipeline
├── LICENSE                     # MIT License
├── .gitignore                  # Excluye .env, node_modules, dist
├── .github/workflows/ci.yml    # CI: build + test automáticos
│
├── backend/                    # FastAPI + CrewAI + Groq
│   ├── Dockerfile              # python:3.11-slim + HEALTHCHECK
│   ├── requirements.txt        # Dependencias Python
│   ├── .env.example            # Template de variables de entorno
│   ├── main.py                 # FastAPI + WebSocket /ws/agents
│   ├── core/                   # Config, helpers, WS manager, rate limiter
│   ├── agents/                 # 3 agentes CrewAI + orquestador
│   └── tests/                  # 15 tests unitarios (pytest)
│
└── frontend/                   # Angular 21 Standalone + Material
    ├── Dockerfile              # Multi-stage (node:22 → nginx:alpine)
    ├── nginx.conf              # SPA fallback
    ├── angular.json            # Build + budgets CSS (8kB)
    ├── package.json            # Dependencias Angular 21 + Vitest
    └── src/
        ├── index.html          # Entry point HTML
        ├── main.ts             # bootstrapApplication standalone
        ├── styles.css          # Sistema de diseño Coquette Tech
        ├── material-theme.scss # Tema Material 3 rose/violet
        ├── app/
        │   ├── app.config.ts   # provideRouter + provideAnimations
        │   ├── app.routes.ts   # /dashboard → DashboardLayout
        │   ├── core/services/
        │   │   └── agent-ws.service.ts  # WebSocket + reconexión
        │   └── features/dashboard/
        │       └── dashboard-layout/    # Dashboard 3 columnas
        └── public/logo.svg     # Logotipo BillAI
```

---

## Endpoints de la API

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/health` | GET | Estado del backend, versión, conexiones activas |
| `/ws/agents` | WebSocket | Pipeline de agentes en tiempo real |

### Formato de Mensajes WebSocket

**Cliente → Servidor:**
```json
{ "type": "analyze", "code": "// tu código TypeScript aquí" }
{ "type": "ping" }
```

**Servidor → Cliente:**
```json
{ "type": "agent_status",   "agent": "auditor",     "status": "running",   "message": "Starting..." }
{ "type": "agent_output",   "agent": "programmer",  "output": "...",       "finished": false }
{ "type": "pipeline_complete", "result": { "audit": "...", "refactored": "...", "validation": "..." } }
{ "type": "error",          "message": "Rate limit exceeded" }
```

---

## Licencia

MIT License

Copyright (c) 2026 **Carmen Varela Iglesias**

Se concede permiso, de forma gratuita, a cualquier persona que obtenga una copia de este software y de los archivos de documentación asociados (el "Software"), para utilizar el Software sin restricción, incluyendo, sin limitación, los derechos de usar, copiar, modificar, fusionar, publicar, distribuir, sublicenciar y/o vender copias del Software, y de permitir a las personas a las que se les proporcione el Software a hacer lo mismo, sujeto a las siguientes condiciones:

El aviso de copyright anterior y este aviso de permiso se incluirán en todas las copias o partes sustanciales del Software.

**Se requiere atribución:** cualquier uso de este proyecto debe incluir crédito a **Carmen Varela Iglesias** como autora original.

EL SOFTWARE SE PROPORCIONA "TAL CUAL", SIN GARANTÍA DE NINGÚN TIPO, EXPRESA O IMPLÍCITA, INCLUYENDO PERO NO LIMITADO A GARANTÍAS DE COMERCIALIZACIÓN, IDONEIDAD PARA UN PROPÓSITO PARTICULAR Y NO INFRACCIÓN. EN NINGÚN CASO LOS AUTORES O TITULARES DEL COPYRIGHT SERÁN RESPONSABLES DE NINGUNA RECLAMACIÓN, DAÑO U OTRA RESPONSABILIDAD, YA SEA EN UNA ACCIÓN CONTRACTUAL, EXTRACONTRACTUAL O DE OTRO TIPO, QUE SURJA DE O EN CONEXIÓN CON EL SOFTWARE O EL USO U OTRO TIPO DE ACCIONES EN EL SOFTWARE.
