# DevOps Services Installation Guide

This document describes how to install DevOps services on a VPS using k3s, Docker, and Traefik for automatic SSL.

## Architecture Overview

```
                    Internet
                        │
                        ▼
                 ┌─────────────┐
                 │   Traefik   │  (k3s built-in ingress)
                 │  Port 80/443│  Auto SSL via Let's Encrypt
                 └──────┬──────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
  ┌──────────┐   ┌───────────┐   ┌──────────────┐
  │ Docker   │   │ Kubernetes│   │ Docker       │
  │ Services │   │ (AWX)     │   │ Monitoring   │
  └──────────┘   └───────────┘   └──────────────┘
```

**Two types of services:**
1. **Docker Compose services** - Jenkins, GitLab, OpenProject (exposed via host ports)
2. **Kubernetes native** - AWX (deployed via operator)

---

## Prerequisites: k3s Installation

k3s was installed as the Kubernetes distribution:

```bash
# Install k3s (already includes Traefik)
curl -sfL https://get.k3s.io | sh -

# Verify installation
kubectl get nodes
kubectl get pods -A
```

k3s includes Traefik as the default ingress controller with Let's Encrypt support.

---

## 1. Jenkins Installation

**Location:** `~/online/jenkins/`
**URL:** https://jenkins.yourdomain.com
**Host Port:** JENKINS_PORT (e.g., 8080 or custom)

### Docker Compose Configuration

```yaml
# ~/online/jenkins/docker-compose.yml
services:
  jenkins:
    image: jenkins/jenkins:lts
    container_name: jenkins
    restart: always
    user: root
    environment:
      - JAVA_OPTS=-Djenkins.install.runSetupWizard=true -Dhudson.footerURL=
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
    ports:
      - "JENKINS_PORT:8080"

volumes:
  jenkins_home:
```

### Installation Steps

```bash
# Create directory
mkdir -p ~/online/jenkins
cd ~/online/jenkins

# Create docker-compose.yml (as shown above)

# Start Jenkins
docker compose up -d

# Get initial admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

---

## 2. GitLab CE Installation

**Location:** `~/online/gitlab/`
**URL:** https://gitlab.yourdomain.com
**Host Port:** GITLAB_HTTP_PORT (HTTP), GITLAB_SSH_PORT (SSH)

### Docker Compose Configuration

```yaml
# ~/online/gitlab/docker-compose.yml
services:
  gitlab:
    image: gitlab/gitlab-ce:latest
    container_name: gitlab
    restart: always
    hostname: gitlab.yourdomain.com
    environment:
      GITLAB_OMNIBUS_CONFIG: |
        external_url 'https://gitlab.yourdomain.com'
        nginx['listen_port'] = 80
        nginx['listen_https'] = false
        nginx['proxy_set_headers'] = {
          "X-Forwarded-Proto" => "https",
          "X-Forwarded-Ssl" => "on"
        }
        gitlab_rails['initial_root_password'] = 'CHANGE_ME_SECURE_PASSWORD'
        gitlab_rails['gitlab_shell_ssh_port'] = GITLAB_SSH_PORT
        puma['worker_processes'] = 2
        sidekiq['concurrency'] = 10
        prometheus_monitoring['enable'] = false
        registry['enable'] = false
    ports:
      - "GITLAB_SSH_PORT:22"
      - "GITLAB_HTTP_PORT:80"
    volumes:
      - gitlab_config:/etc/gitlab
      - gitlab_logs:/var/log/gitlab
      - gitlab_data:/var/opt/gitlab
    shm_size: '256m'

volumes:
  gitlab_config:
  gitlab_logs:
  gitlab_data:
```

### Installation Steps

```bash
# Create directory
mkdir -p ~/online/gitlab
cd ~/online/gitlab

# Create docker-compose.yml (as shown above)

# Start GitLab
docker compose up -d

# GitLab takes several minutes to initialize
# Monitor logs
docker logs -f gitlab
```

**Key Configuration Notes:**
- `nginx['listen_https'] = false` - Traefik handles SSL termination
- `nginx['proxy_set_headers']` - Required for HTTPS behind reverse proxy
- `gitlab_shell_ssh_port` - Custom SSH port to avoid conflicts

---

## 3. OpenProject Installation

**Location:** `~/online/openproject/`
**URL:** https://openproject.yourdomain.com
**Host Port:** OPENPROJECT_PORT

### Docker Compose Configuration

```yaml
# ~/online/openproject/docker-compose.yml
services:
  openproject:
    image: openproject/openproject:14
    container_name: openproject
    restart: always
    environment:
      - OPENPROJECT_SECRET_KEY_BASE=${OPENPROJECT_SECRET_KEY_BASE}
      - OPENPROJECT_HOST__NAME=openproject.yourdomain.com
      - OPENPROJECT_HTTPS=true
      - OPENPROJECT_DEFAULT__LANGUAGE=en
      - OPENPROJECT_SEED_ADMIN_USER_PASSWORD=${ADMIN_PASSWORD}
      - OPENPROJECT_SEED_ADMIN_USER_NAME=admin
      - OPENPROJECT_SEED_ADMIN_USER_MAIL=admin@yourdomain.com
    volumes:
      - openproject_pgdata:/var/openproject/pgdata
      - openproject_assets:/var/openproject/assets
    ports:
      - "OPENPROJECT_PORT:8080"

volumes:
  openproject_pgdata:
  openproject_assets:
```

### Environment File

```bash
# ~/online/openproject/.env
OPENPROJECT_SECRET_KEY_BASE=$(openssl rand -hex 64)
ADMIN_PASSWORD=CHANGE_ME_SECURE_PASSWORD
```

### Installation Steps

```bash
# Create directory
mkdir -p ~/online/openproject
cd ~/online/openproject

# Create .env file with secrets
echo "OPENPROJECT_SECRET_KEY_BASE=$(openssl rand -hex 64)" > .env
echo "ADMIN_PASSWORD=CHANGE_ME_SECURE_PASSWORD" >> .env

# Create docker-compose.yml (as shown above)

# Start OpenProject
docker compose up -d
```

---

## 4. Monitoring Stack (Prometheus + Grafana + Alertmanager)

**Location:** `~/online/monitoring/`
**URLs:**
- https://prometheus.yourdomain.com (PROMETHEUS_PORT)
- https://grafana.yourdomain.com (GRAFANA_PORT)
- https://alertmanager.yourdomain.com (ALERTMANAGER_PORT)

### Directory Structure

```
~/online/monitoring/
├── docker-compose.yml
├── .env
├── prometheus/
│   ├── prometheus.yml
│   ├── web.yml
│   └── alerts/
├── grafana/
│   └── provisioning/
└── alertmanager/
    ├── alertmanager.yml
    └── web.yml
```

### Docker Compose Configuration

```yaml
# ~/online/monitoring/docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: always
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
      - '--web.external-url=https://prometheus.yourdomain.com'
      - '--web.config.file=/etc/prometheus/web.yml'
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/web.yml:/etc/prometheus/web.yml:ro
      - ./prometheus/alerts:/etc/prometheus/alerts:ro
      - prometheus_data:/prometheus
    networks:
      - monitoring-internal
    ports:
      - "PROMETHEUS_PORT:9090"

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: always
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_SERVER_ROOT_URL=https://grafana.yourdomain.com
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SECURITY_DISABLE_GRAVATAR=true
      - GF_SECURITY_COOKIE_SECURE=true
      - GF_SECURITY_STRICT_TRANSPORT_SECURITY=true
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    networks:
      - monitoring-internal
    ports:
      - "GRAFANA_PORT:3000"
    depends_on:
      - prometheus

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    restart: always
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=https://alertmanager.yourdomain.com'
      - '--web.config.file=/etc/alertmanager/web.yml'
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - ./alertmanager/web.yml:/etc/alertmanager/web.yml:ro
      - alertmanager_data:/alertmanager
    networks:
      - monitoring-internal
    ports:
      - "ALERTMANAGER_PORT:9093"

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: always
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    networks:
      - monitoring-internal
    expose:
      - "9100"

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    restart: always
    privileged: true
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    networks:
      - monitoring-internal
    expose:
      - "8080"

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:

networks:
  monitoring-internal:
    driver: bridge
```

### Prometheus Configuration

```yaml
# ~/online/monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'my-monitor'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

rule_files:
  - /etc/prometheus/alerts/*.yml

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: 'jenkins'
    metrics_path: /prometheus
    static_configs:
      - targets: ['jenkins:8080']

  - job_name: 'gitlab'
    metrics_path: /-/metrics
    static_configs:
      - targets: ['gitlab:80']
```

### Alertmanager Configuration

```yaml
# ~/online/monitoring/alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default-receiver'
  routes:
    - match:
        severity: critical
      receiver: 'critical-receiver'
      repeat_interval: 1h

receivers:
  - name: 'default-receiver'
  - name: 'critical-receiver'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

### Installation Steps

```bash
# Create directory structure
mkdir -p ~/online/monitoring/{prometheus/alerts,grafana/provisioning,alertmanager}
cd ~/online/monitoring

# Create .env file
echo "GRAFANA_ADMIN_PASSWORD=CHANGE_ME_SECURE_PASSWORD" > .env

# Create configuration files (as shown above)

# Create web.yml for basic auth (optional)
touch prometheus/web.yml
touch alertmanager/web.yml

# Start monitoring stack
docker compose up -d
```

---

## 5. AWX Installation (Kubernetes)

**Location:** `~/online/awx-operator/`
**URL:** https://awx.yourdomain.com
**NodePort:** AWX_NODEPORT (e.g., 30080)

AWX is deployed using the AWX Operator on Kubernetes.

### Kustomization Configuration

```yaml
# ~/online/awx-operator/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - github.com/ansible/awx-operator/config/default?ref=2.19.1

images:
  - name: quay.io/ansible/awx-operator
    newTag: 2.19.1

namespace: awx
```

### AWX Custom Resource

```yaml
# ~/online/awx-operator/awx.yaml
---
apiVersion: awx.ansible.com/v1beta1
kind: AWX
metadata:
  name: awx
  namespace: awx
spec:
  service_type: NodePort
  nodeport_port: AWX_NODEPORT

  admin_user: admin

  # Postgres configuration (embedded)
  postgres_storage_class: local-path
  postgres_data_volume_init: true
  postgres_storage_requirements:
    requests:
      storage: 8Gi

  # Projects persistence
  projects_persistence: true
  projects_storage_class: local-path
  projects_storage_size: 8Gi
  projects_storage_access_mode: ReadWriteOnce

  # Resource limits
  web_resource_requirements:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi
  task_resource_requirements:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi
  ee_resource_requirements:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 1Gi

  extra_settings:
    - setting: CSRF_TRUSTED_ORIGINS
      value:
        - https://awx.yourdomain.com
        - http://localhost:AWX_NODEPORT
```

### Installation Steps

```bash
# Create namespace
kubectl create namespace awx

# Navigate to operator directory
cd ~/online/awx-operator

# Create kustomization.yaml (as shown above)

# Deploy AWX Operator
kubectl apply -k .

# Wait for operator to be ready
kubectl get pods -n awx -w

# Create awx.yaml (as shown above)

# Deploy AWX instance
kubectl apply -f awx.yaml

# Monitor deployment (takes several minutes)
kubectl logs -f deployment/awx-operator-controller-manager -n awx

# Get admin password
kubectl get secret awx-admin-password -n awx -o jsonpath="{.data.password}" | base64 --decode
```

---

## 6. Kubernetes Services & Ingress Configuration

To expose Docker services through Traefik (k3s ingress), we create Kubernetes Services and Ingresses.

### Kubernetes Services (for Docker containers)

Docker containers expose ports on the host. We create k8s Services pointing to `host.k3s.internal`:

```yaml
# docker-services.yaml
---
# Jenkins Service
apiVersion: v1
kind: Service
metadata:
  name: jenkins-docker
  namespace: default
spec:
  ports:
    - port: JENKINS_PORT
      targetPort: JENKINS_PORT
---
# GitLab Service
apiVersion: v1
kind: Service
metadata:
  name: gitlab-docker
  namespace: default
spec:
  ports:
    - port: GITLAB_HTTP_PORT
      targetPort: GITLAB_HTTP_PORT
---
# OpenProject Service
apiVersion: v1
kind: Service
metadata:
  name: openproject-docker
  namespace: default
spec:
  ports:
    - port: OPENPROJECT_PORT
      targetPort: OPENPROJECT_PORT
---
# Prometheus Service
apiVersion: v1
kind: Service
metadata:
  name: prometheus-docker
  namespace: default
spec:
  ports:
    - port: PROMETHEUS_PORT
      targetPort: PROMETHEUS_PORT
---
# Grafana Service
apiVersion: v1
kind: Service
metadata:
  name: grafana-docker
  namespace: default
spec:
  ports:
    - port: GRAFANA_PORT
      targetPort: GRAFANA_PORT
---
# Alertmanager Service
apiVersion: v1
kind: Service
metadata:
  name: alertmanager-docker
  namespace: default
spec:
  ports:
    - port: ALERTMANAGER_PORT
      targetPort: ALERTMANAGER_PORT
```

### Kubernetes Ingresses (with SSL)

```yaml
# ingresses.yaml
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: jenkins
  namespace: default
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
spec:
  rules:
  - host: jenkins.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: jenkins-docker
            port:
              number: JENKINS_PORT
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gitlab
  namespace: default
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
spec:
  rules:
  - host: gitlab.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gitlab-docker
            port:
              number: GITLAB_HTTP_PORT
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: openproject
  namespace: default
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
spec:
  rules:
  - host: openproject.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: openproject-docker
            port:
              number: OPENPROJECT_PORT
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: prometheus
  namespace: default
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
spec:
  rules:
  - host: prometheus.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: prometheus-docker
            port:
              number: PROMETHEUS_PORT
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana
  namespace: default
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
spec:
  rules:
  - host: grafana.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: grafana-docker
            port:
              number: GRAFANA_PORT
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: alertmanager
  namespace: default
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
spec:
  rules:
  - host: alertmanager.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: alertmanager-docker
            port:
              number: ALERTMANAGER_PORT
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: awx-ingress
  namespace: awx
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
spec:
  rules:
  - host: awx.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: awx-service
            port:
              number: 80
```

### Apply Kubernetes Resources

```bash
# Apply services
kubectl apply -f docker-services.yaml

# Apply ingresses
kubectl apply -f ingresses.yaml

# Verify
kubectl get svc -A
kubectl get ingress -A
```

---

## Service Summary

| Service | Type | URL | Host Port | Admin User |
|---------|------|-----|-----------|------------|
| Jenkins | Docker | https://jenkins.yourdomain.com | JENKINS_PORT | (setup wizard) |
| GitLab | Docker | https://gitlab.yourdomain.com | GITLAB_HTTP_PORT, GITLAB_SSH_PORT | root |
| OpenProject | Docker | https://openproject.yourdomain.com | OPENPROJECT_PORT | admin |
| Prometheus | Docker | https://prometheus.yourdomain.com | PROMETHEUS_PORT | - |
| Grafana | Docker | https://grafana.yourdomain.com | GRAFANA_PORT | admin |
| Alertmanager | Docker | https://alertmanager.yourdomain.com | ALERTMANAGER_PORT | - |
| AWX | Kubernetes | https://awx.yourdomain.com | AWX_NODEPORT | admin |

---

## Management Commands

### Docker Services

```bash
# Start a service
cd ~/online/<service>
docker compose up -d

# Stop a service
docker compose down

# View logs
docker compose logs -f

# Restart
docker compose restart
```

### AWX (Kubernetes)

```bash
# Check status
kubectl get pods -n awx

# View logs
kubectl logs -f deployment/awx-web -n awx
kubectl logs -f deployment/awx-task -n awx

# Get admin password
kubectl get secret awx-admin-password -n awx -o jsonpath="{.data.password}" | base64 --decode

# Restart
kubectl rollout restart deployment/awx-web -n awx
kubectl rollout restart deployment/awx-task -n awx
```

### Kubernetes/Traefik

```bash
# Check all pods
kubectl get pods -A

# Check ingresses
kubectl get ingress -A

# Check Traefik logs
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik -f

# Verify SSL certificates
curl -vI https://jenkins.yourdomain.com 2>&1 | grep -i "ssl\|certificate"
```

---

## Troubleshooting

### Service not accessible

1. Check Docker container is running:
   ```bash
   docker ps | grep <service>
   ```

2. Check k8s service exists:
   ```bash
   kubectl get svc -A | grep <service>
   ```

3. Check ingress is configured:
   ```bash
   kubectl get ingress -A | grep <service>
   ```

4. Check Traefik logs:
   ```bash
   kubectl logs -n kube-system -l app.kubernetes.io/name=traefik
   ```

### SSL certificate issues

Let's Encrypt certificates are auto-generated. If issues occur:

```bash
# Check Traefik for certificate errors
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik | grep -i cert

# Verify ingress annotations
kubectl get ingress <name> -o yaml | grep -A5 annotations
```

### AWX not starting

```bash
# Check operator logs
kubectl logs -f deployment/awx-operator-controller-manager -n awx

# Check AWX pods
kubectl describe pod -n awx -l app.kubernetes.io/name=awx

# Check persistent volumes
kubectl get pvc -n awx
```

---

## Configuration Checklist

Before deploying, replace these placeholders with your actual values:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `yourdomain.com` | Your domain name | `example.com` |
| `CHANGE_ME_SECURE_PASSWORD` | Secure passwords | Generate with `openssl rand -base64 32` |
| `JENKINS_PORT` | Jenkins host port | `8080` |
| `GITLAB_HTTP_PORT` | GitLab HTTP port | `8081` |
| `GITLAB_SSH_PORT` | GitLab SSH port | `2222` |
| `OPENPROJECT_PORT` | OpenProject port | `8082` |
| `PROMETHEUS_PORT` | Prometheus port | `9090` |
| `GRAFANA_PORT` | Grafana port | `3000` |
| `ALERTMANAGER_PORT` | Alertmanager port | `9093` |
| `AWX_NODEPORT` | AWX NodePort | `30080` |

**Tips:**
- Use high ports (e.g., 18080-18090) to avoid conflicts with system services
- Ensure ports don't conflict with existing services on your server
- Generate strong passwords for all services

---

*Document created: 2026-02*
