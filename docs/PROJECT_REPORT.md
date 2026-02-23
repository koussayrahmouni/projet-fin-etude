# Projet de Fin d'Etude — Full Technical Report

**Author:** Koussay
**Date:** February 19, 2026
**Server:** 10.7.157.105 — AlmaLinux 9.7 (Moss Jungle Cat)
**Hardware:** 4 vCPUs, 32 GB RAM, 50 GB Disk

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Infrastructure Architecture](#2-infrastructure-architecture)
3. [Web Application (Next.js)](#3-web-application-nextjs)
4. [DevOps Services Deployed](#4-devops-services-deployed)
5. [Monitoring Stack](#5-monitoring-stack)
6. [CI/CD Pipeline (Jenkins)](#6-cicd-pipeline-jenkins)
7. [Source Code Management (GitLab)](#7-source-code-management-gitlab)
8. [Automation (AWX / Ansible)](#8-automation-awx--ansible)
9. [Project Management (OpenProject)](#9-project-management-openproject)
10. [Kubernetes & Traefik Configuration](#10-kubernetes--traefik-configuration)
11. [Database](#11-database)
12. [Network & Port Map](#12-network--port-map)
13. [Screenshots](#13-screenshots)
14. [Summary of Work Done](#14-summary-of-work-done)
15. [Next Steps](#15-next-steps)

---

## 1. Project Overview

This project is a **Build-to-Run (B2R) DevOps Management Platform** — a web application that provides a unified interface for managing the transition from project build phase to production run phase. It integrates with multiple DevOps tools (Jenkins, GitLab, AWX/Ansible, Prometheus, Grafana) to automate and track infrastructure operations.

### Key Features
- **B2R Checklist Management** — Create, track, and export Build-to-Run checklists per client with 8 sections (~72 items) covering JIRA, Dollar Universe, Production Plan, Application Environment, Monitoring, Deliverables, System & Infrastructure, and Security
- **Excel Editor** — Parse, edit, and export Excel files with inline editing, search, and autosave
- **User Authentication** — Role-based access (superadmin, admin, collaborator, client) with Better Auth
- **Monitoring Dashboard** — Real-time server and container metrics via Prometheus + Grafana
- **Automation Integration** — Ansible/AWX buttons on each checklist section for automated infrastructure checks
- **Excel Export** — Professional Excel export matching the official B2R PDF layout (ExcelJS with styled headers, color-coded statuses, per-section progress)

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16.1.4, React 19.2, TypeScript 5 |
| Styling | TailwindCSS 4, Shadcn UI, Radix UI |
| Backend | Next.js App Router (API routes) |
| Database | PostgreSQL 16, Drizzle ORM |
| Authentication | Better Auth 1.4.17 |
| Runtime | Bun |
| Container Orchestration | K3s (Lightweight Kubernetes) v1.34.3 |
| Reverse Proxy | Traefik (K3s built-in) |
| CI/CD | Jenkins 2.541.1 LTS |
| Source Control | GitLab CE |
| Automation | AWX 24.6.1 (Ansible) |
| Monitoring | Prometheus, Grafana, Alertmanager |
| System Metrics | Node Exporter, cAdvisor |
| Project Management | OpenProject 14 |

---

## 2. Infrastructure Architecture

### Architecture Diagram

```
                        ┌─────────────────────────────────────────┐
                        │         VPS: 10.7.157.105               │
                        │         AlmaLinux 9.7                    │
                        │         4 vCPUs / 32 GB RAM              │
                        ├─────────────────────────────────────────┤
                        │                                          │
  ┌─────────────────────┤    K3s (Kubernetes)                      │
  │                     │    ├── Traefik (Ingress/Reverse Proxy)   │
  │   Kubernetes        │    ├── AWX Operator                      │
  │   Namespace: awx    │    ├── AWX Web (3 containers)            │
  │                     │    ├── AWX Task (4 containers)           │
  │                     │    └── AWX PostgreSQL                    │
  ├─────────────────────┤                                          │
  │                     │    Docker Containers                     │
  │   Docker            │    ├── Jenkins        (:8089)            │
  │   Containers        │    ├── GitLab         (:8081)            │
  │                     │    ├── OpenProject    (:8083)            │
  │                     │    ├── Prometheus     (:9090)            │
  │                     │    ├── Grafana        (:3001)            │
  │                     │    ├── Alertmanager   (:9093)            │
  │                     │    ├── Node Exporter  (:9100 internal)   │
  │                     │    ├── cAdvisor       (:8080 internal)   │
  │                     │    ├── PostgreSQL     (:5432)            │
  │                     │    └── Adminer        (:8080)            │
  ├─────────────────────┤                                          │
  │   Application       │    Next.js App       (:3000)             │
  └─────────────────────┴─────────────────────────────────────────┘
```

### Service Communication Flow

```
User Browser
    │
    ├── :3000  → Next.js App (B2R Checklist, Excel Editor)
    ├── :8089  → Jenkins (CI/CD)
    ├── :8081  → GitLab (Source Code)
    ├── :8083  → OpenProject (Project Management)
    ├── :3001  → Grafana (Dashboards)
    ├── :9090  → Prometheus (Metrics)
    ├── :9093  → Alertmanager (Alerts)
    └── :30080 → AWX (Ansible Automation)

Monitoring Flow:
    Node Exporter ──metrics──→ Prometheus ──alerts──→ Alertmanager
    cAdvisor ──────metrics──→ Prometheus ──data────→ Grafana
    Jenkins ───────metrics──→ Prometheus
    GitLab ────────metrics──→ Prometheus
```

---

## 3. Web Application (Next.js)

### Directory Structure

```
projet-fin-etude-main/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/route.ts     # Better Auth handler
│   │   ├── checklist/
│   │   │   ├── save/route.ts          # POST - Upsert checklist
│   │   │   ├── load/route.ts          # GET - Load by ID
│   │   │   ├── list/route.ts          # GET - List all for user
│   │   │   └── delete/route.ts        # DELETE - Remove checklist
│   │   ├── excel/
│   │   │   ├── save/route.ts          # POST - Save Excel session
│   │   │   └── load/route.ts          # GET - Load Excel session
│   │   ├── jira/route.ts              # JIRA integration
│   │   └── users/route.ts             # User management
│   ├── checklist/page.tsx             # B2R Checklist page (1112 lines)
│   ├── excel/page.tsx                 # Excel editor page
│   ├── dashboard/page.tsx             # Dashboard
│   ├── login/page.tsx                 # Login page
│   ├── register/page.tsx              # Registration page
│   └── layout.tsx                     # Root layout
├── components/
│   ├── ui/                            # 25 Shadcn UI components
│   ├── app-sidebar.tsx                # Navigation sidebar
│   ├── data-table.tsx                 # Data table component
│   └── ...
├── drizzle/
│   └── schema.ts                      # Database schema (5 tables)
├── lib/
│   ├── auth.ts                        # Better Auth server config
│   ├── auth-client.ts                 # Better Auth client
│   ├── db.ts                          # Database connection
│   └── utils.ts                       # Utilities
├── docker-services.yaml               # K8s Services for Traefik
├── docker-compose.yml                 # PostgreSQL + Adminer
└── package.json
```

### B2R Checklist Feature

The B2R Checklist page (`app/checklist/page.tsx` — 1,112 lines) is the core feature:

- **8 Sections** with ~72 items based on the official B2R PDF template:
  1. JIRA (5 items)
  2. Dollar Universe (12 items)
  3. Plan de Production (6 items)
  4. Environnement Applicatif (6 items)
  5. Monitoring (9 items)
  6. Livrables (7 items)
  7. Systeme & Infrastructure (12 items)
  8. Security (15 items)

- **Per-item tracking:** Status (Not Started / In Progress / Done / N/A), comments, owner
- **Progress visualization:** Per-section and overall progress bars with percentage
- **Client management:** Create checklists for different clients with metadata (offre, prestation, infra, gouvernance)
- **Autosave:** 800ms debounced save to PostgreSQL via JSONB column
- **Search & filter:** Real-time filtering across all items
- **Ansible integration:** Buttons per section for future automated checks via AWX
- **Excel export:** Professional styled XLSX matching the official B2R PDF layout using ExcelJS:
  - Orange title bar with company branding
  - Client information boxes
  - Per-section colored headers
  - Green checkmarks (Done) / Red X marks (Not Started)
  - Per-owner progress calculation
  - Avancement (progress) summary section

### API Routes

All API routes follow the same pattern:
- Authentication via `auth.api.getSession({ headers: req.headers })`
- PostgreSQL queries via `pool.query()` (raw SQL with parameterized queries)
- JSONB columns for flexible data storage
- User-scoped data (all queries filter by `user_id`)

### Authentication

- **Better Auth 1.4.17** with email/password
- Role-based access: `superadmin`, `admin`, `collaborator`, `client`
- Trusted origins configured for both `localhost:3000` and `10.7.157.105:3000`
- Sessions stored in PostgreSQL

---

## 4. DevOps Services Deployed

### Deployment Summary

| Service | Type | Port | Status | Uptime |
|---------|------|------|--------|--------|
| Next.js App | Bun process | 3000 | Running | On-demand |
| Jenkins | Docker | 8089 | Running | 35+ hours |
| GitLab CE | Docker | 8081 | Running (healthy) | 46+ hours |
| OpenProject 14 | Docker | 8083 | Running | 43+ hours |
| Prometheus | Docker | 9090 | Running | 34+ hours |
| Grafana | Docker | 3001 | Running | 43+ hours |
| Alertmanager | Docker | 9093 | Running | 43+ hours |
| Node Exporter | Docker | 9100 (internal) | Running | 43+ hours |
| cAdvisor | Docker | 8080 (internal) | Running (healthy) | 43+ hours |
| AWX | K3s (7 pods) | 30080 | Running | 41+ hours |
| PostgreSQL | Docker | 5432 | Running | 46+ hours |
| Adminer | Docker | 8080 | Running | 46+ hours |

**Total: 12 services, 10 Docker containers, 7 Kubernetes pods**

---

## 5. Monitoring Stack

### Architecture

The monitoring stack consists of 5 Docker containers on a shared `monitoring-internal` bridge network:

```
~/online/monitoring/
├── docker-compose.yml          # All 5 containers
├── .env                        # Grafana admin password
├── prometheus/
│   ├── prometheus.yml          # Scrape configuration
│   ├── web.yml                 # Optional basic auth
│   └── alerts/                 # Alert rules (ready for rules)
├── grafana/
│   └── provisioning/           # Auto-provisioning dashboards/datasources
└── alertmanager/
    ├── alertmanager.yml        # Alert routing configuration
    └── web.yml                 # Optional basic auth
```

### Prometheus Scrape Targets

| Target | Endpoint | Status |
|--------|----------|--------|
| prometheus (self) | `localhost:9090/metrics` | UP |
| node-exporter | `node-exporter:9100/metrics` | UP |
| cadvisor | `cadvisor:8080/metrics` | UP |
| jenkins | `10.7.157.105:8089/prometheus` | UP |
| gitlab | `10.7.157.105:8081/-/metrics` | UP |

**All 5/5 targets UP** — full observability across the infrastructure.

### Grafana Dashboards

| Dashboard | Grafana ID | Purpose |
|-----------|-----------|---------|
| Node Exporter Full | 1860 | Host metrics (CPU, RAM, disk, network) |
| Docker Monitoring | 193 | Container metrics (per-container CPU, memory, I/O) |

- **Data source:** Prometheus at `http://prometheus:9090` (Docker internal network)
- **Credentials:** admin / `Grafana@SecurePass2026`

### Alertmanager Configuration

- **Route:** Groups alerts by `alertname` + `severity`
- **Critical alerts:** Routed to `critical-receiver`, repeat every 1 hour
- **Default alerts:** Repeat every 4 hours
- **Inhibit rules:** Critical alerts suppress corresponding warning alerts
- **Receivers:** Configured (ready for email/Slack webhook integration)

---

## 6. CI/CD Pipeline (Jenkins)

### Installation Details

| Property | Value |
|----------|-------|
| Version | 2.541.1 LTS |
| Type | Docker container |
| Port | 8089 |
| Java | OpenJDK (container default) |
| Plugins | 143 active |

### Installed Plugins (Key)

| Category | Plugins |
|----------|---------|
| **Pipeline** | workflow-aggregator, pipeline-stage-view, Blue Ocean |
| **SCM** | Git, GitHub, GitLab Plugin |
| **Containers** | Docker, Docker Workflow, Kubernetes |
| **Automation** | Ansible, Job DSL, Configuration as Code |
| **Security** | Matrix Auth, Role Strategy, Credentials, SSH Credentials |
| **Notifications** | Email Extension, Generic Webhook Trigger |
| **Utilities** | AnsiColor, Rebuild, Publish Over SSH, Timestamper, Build Timeout |
| **Monitoring** | Prometheus Metrics |

### Plugin Installation Process

Due to Java SSL certificate issues inside the Docker container (PKIX path building failed), plugins were installed by:
1. Resolving all 127 plugins + dependencies from the Jenkins Update Center JSON
2. Downloading all `.hpi` files on the host machine
3. Copying them into the container via `docker cp` (tar pipe)
4. Restarting Jenkins to load all plugins

---

## 7. Source Code Management (GitLab)

| Property | Value |
|----------|-------|
| Type | Docker container (GitLab CE) |
| HTTP Port | 8081 |
| SSH Port | 2222 |
| Status | Running (healthy) |
| Prometheus Monitoring | Enabled |
| Monitoring Whitelist | `127.0.0.0/8`, `10.7.157.0/24`, `172.16.0.0/12` |

---

## 8. Automation (AWX / Ansible)

### Deployment

AWX was deployed on K3s using the AWX Operator via Kustomize:

```
~/online/awx-operator/
├── kustomization.yaml    # AWX Operator v2.19.1
└── awx.yaml              # AWX Custom Resource
```

### AWX Kubernetes Resources

| Pod | Containers | Status |
|-----|-----------|--------|
| awx-operator-controller-manager | 2/2 (kube-rbac-proxy, awx-manager) | Running |
| awx-web | 3/3 (redis, awx-web, awx-rsyslog) | Running |
| awx-task | 4/4 (redis, awx-task, awx-ee, awx-rsyslog) | Running |
| awx-postgres-15-0 | 1/1 | Running |
| awx-migration-24.6.1 | 0/1 | Completed |

### Configuration

- **Service type:** NodePort on port 30080
- **Redis:** Using `public.ecr.aws/docker/library/redis:7` (ECR mirror to avoid Docker Hub rate limits)
- **Storage:** `local-path` storage class with 8Gi for PostgreSQL and projects
- **Resource limits:** Web/Task: 200m-1000m CPU, 512Mi-2Gi RAM; EE: 200m-500m CPU, 256Mi-1Gi RAM

### Challenges Solved

1. **Metrics-server API blocking operator:** Deleted broken `v1beta1.metrics.k8s.io` APIService that was causing "Unable to determine if virtual resource" errors
2. **Docker Hub rate limit:** Switched Redis image from `docker.io/redis:7` to `public.ecr.aws/docker/library/redis:7`
3. **Pod-to-pod networking (firewall):** Added `cni0` and `flannel.1` interfaces to firewalld trusted zone
4. **Database migration:** AWX migration job completed successfully after networking fix

---

## 9. Project Management (OpenProject)

| Property | Value |
|----------|-------|
| Version | 14 |
| Type | Docker container |
| Port | 8083 |
| Language | English |
| HTTPS | Disabled (Traefik handles SSL) |

```
~/online/openproject/
├── docker-compose.yml
└── .env                  # Secret key + admin password
```

---

## 10. Kubernetes & Traefik Configuration

### K3s Cluster

| Component | Version | Status |
|-----------|---------|--------|
| K3s | v1.34.3+k3s1 | Running |
| Traefik | Built-in | Running |
| CoreDNS | Built-in | Running |
| Local Path Provisioner | Built-in | Running |
| Metrics Server | Built-in | Running |

### Kubernetes Services for Docker Containers

To bridge Docker containers (running outside K3s) with Traefik (running inside K3s), we created Kubernetes Services + Endpoints in `docker-services.yaml`:

| Service Name | Cluster IP | Forwards To |
|-------------|-----------|-------------|
| jenkins-docker | 10.43.150.143:8089 | 10.7.157.105:8089 |
| gitlab-docker | 10.43.59.11:8082 | 10.7.157.105:8082 |
| openproject-docker | 10.43.20.165:8083 | 10.7.157.105:8083 |
| prometheus-docker | 10.43.14.222:9090 | 10.7.157.105:9090 |
| grafana-docker | 10.43.47.244:3001 | 10.7.157.105:3001 |
| alertmanager-docker | 10.43.172.245:9093 | 10.7.157.105:9093 |

These services allow Traefik IngressRoutes to be configured later for domain-based routing and SSL termination.

---

## 11. Database

### PostgreSQL

| Property | Value |
|----------|-------|
| Version | 16 (Docker) |
| Port | 5432 |
| Database | excel_editor |
| User | excel_user |
| Management UI | Adminer on port 8080 |

### Schema (5 Tables)

| Table | Purpose |
|-------|---------|
| `users` | User accounts (id, name, email, role, password hash) |
| `sessions` | Authentication sessions |
| `accounts` | OAuth/provider accounts (Better Auth) |
| `excel_sessions` | Excel editor sessions (JSONB data) |
| `checklist_sessions` | B2R checklist sessions (JSONB data, client info) |

### Checklist Sessions Schema

```sql
CREATE TABLE checklist_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name       TEXT NOT NULL,
  client_info       JSONB,           -- {offre, prestation, infra, gouvernance}
  data              JSONB NOT NULL,   -- {sections: [{items: [{status, comment}]}]}
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON checklist_sessions(user_id);
```

---

## 12. Network & Port Map

### Full Port Map

| Port | Service | Protocol | Access |
|------|---------|----------|--------|
| 22 | SSH | TCP | External |
| 2222 | GitLab SSH | TCP | External |
| 3000 | Next.js App | TCP | External |
| 3001 | Grafana | TCP | External |
| 5432 | PostgreSQL | TCP | External |
| 6443 | K3s Kubernetes API | TCP | External |
| 8080 | Adminer | TCP | External |
| 8081 | GitLab HTTP | TCP | External |
| 8083 | OpenProject | TCP | External |
| 8089 | Jenkins | TCP | External |
| 9090 | Prometheus | TCP | External |
| 9093 | Alertmanager | TCP | External |
| 9100 | Node Exporter | TCP | Internal (Docker only) |
| 30080 | AWX (Ansible) | TCP | External (K3s NodePort) |
| 50000 | Jenkins Agent | TCP | External |

### Firewall Configuration

The following firewall rules were required for K3s pod-to-pod communication:

```bash
sudo firewall-cmd --add-interface=cni0 --zone=trusted --permanent
sudo firewall-cmd --add-interface=flannel.1 --zone=trusted --permanent
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload
```

---

## 13. Screenshots

All screenshots are saved in `docs/screenshots/`:

| Screenshot | File | Description |
|-----------|------|-------------|
| Grafana Login | `grafana-login.png` | Grafana authentication page |
| Prometheus Targets | `prometheus-targets.png` | All 5 scrape targets showing UP |
| Jenkins | `jenkins-login.png` | Jenkins login page (143 plugins active) |
| Alertmanager | `alertmanager.png` | Alertmanager web interface |
| OpenProject | `openproject.png` | OpenProject login page |
| AWX | `awx-login.png` | AWX/Ansible login page |
| GitLab | `gitlab.png` | GitLab interface |

---

## 14. Summary of Work Done

### Phase 1: Web Application Development

| Task | Status | Details |
|------|--------|---------|
| Database schema design | Done | 5 tables with JSONB columns, Drizzle ORM |
| B2R Checklist page | Done | 1,112 lines, 8 sections, 72 items, full CRUD |
| Checklist API routes | Done | 4 routes (save, load, list, delete) |
| Excel export (ExcelJS) | Done | Professional styled XLSX matching B2R PDF |
| Ansible buttons | Done | Per-section buttons (placeholder for AWX API) |
| Sidebar navigation | Done | Added Checklist nav item |
| Autosave system | Done | 800ms debounced save to PostgreSQL |
| Network access | Done | Configured `--hostname 0.0.0.0` + trusted origins |

### Phase 2: DevOps Infrastructure

| Task | Status | Details |
|------|--------|---------|
| OpenProject installation | Done | Docker Compose, port 8083 |
| Monitoring stack (5 containers) | Done | Prometheus, Grafana, Alertmanager, Node Exporter, cAdvisor |
| AWX installation on K3s | Done | Operator + AWX instance, 7 pods running |
| Jenkins plugin installation | Done | 143 plugins via host download + docker cp |
| Grafana configuration | Done | Prometheus data source + 2 dashboards (1860, 193) |
| K8s Services for Traefik | Done | 6 Services + Endpoints for Docker containers |
| Prometheus scrape targets | Done | All 5 targets UP (including Jenkins + GitLab) |
| Firewall configuration | Done | CNI interfaces trusted, port 3000 opened |

### Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| AWX operator "Unable to determine virtual resource" | Deleted broken `v1beta1.metrics.k8s.io` APIService |
| Docker Hub rate limit for Redis image | Switched to ECR mirror (`public.ecr.aws/docker/library/redis:7`) |
| K3s pod-to-pod networking blocked by firewall | Added `cni0` + `flannel.1` to firewalld trusted zone |
| Jenkins SSL certificate errors for plugin downloads | Downloaded 127 plugins on host, copied via tar pipe |
| GitLab metrics endpoint returning 502 | Enabled `prometheus_monitoring` + added IP whitelist |
| Better Auth rejecting requests from network IP | Added `http://10.7.157.105:3000` to `trustedOrigins` |
| Prometheus showing old config after edit | Restarted container (hot reload wasn't sufficient) |
| Jenkins setup wizard reset after plugin install | Re-created user + configured security via Groovy script |

---

## 15. Next Steps

### Day 2 — DevOps Integrations
- Connect Checklist Ansible buttons to AWX API
- Build SSH module for server management
- Set up email notifications (Nodemailer)

### Day 3 — Code Compliance
- Fix `: any` types across codebase
- Wire up ThemeProvider (dark/light mode)
- Refactor forms with React Hook Form + Zod
- Add TanStack React Query

### Day 4 — Testing
- Set up Vitest + Playwright
- Write unit and E2E tests

### Day 5 — AI Stack
- Ollama + AI SDK integration
- AI assistant for DevOps help

### Day 6 — Polish
- Internationalization (next-intl)
- Dockerfile for the app
- Component reorganization

---

## Appendix: Credentials

See separate document: **Services Credentials** (Notion page)

---

*Report generated on February 19, 2026*
