# B2R Checklist - Ansible Playbooks

Ansible playbooks for automated verification of all 8 B2R (Build-to-Run) checklist sections.

## Structure

```
ansible/
├── ansible.cfg                          # Ansible configuration
├── inventory/hosts                      # Target hosts
├── group_vars/all.yml                   # Variables for all sections
├── playbooks/
│   ├── verify_all.yml                   # Run ALL sections
│   ├── verify_jira.yml                  # Section 1: JIRA
│   ├── verify_dollar_universe.yml       # Section 2: Dollar Universe
│   ├── verify_plan_production.yml       # Section 3: Plan de Production
│   ├── verify_env_applicatif.yml        # Section 4: Environnement Applicatif
│   ├── verify_monitoring.yml            # Section 5: Monitoring
│   ├── verify_livrables.yml             # Section 6: Livrables
│   ├── verify_systeme_infra.yml         # Section 7: Système & Infrastructure
│   └── verify_security.yml              # Section 8: Security
├── roles/
│   └── verify_jira/                     # JIRA verification role
├── scripts/
│   └── verify_jira.py                   # JIRA API verification script
└── mock_jira/                           # Mock JIRA server for testing
```

## Running Locally

```bash
# Run a single section
cd ansible
ansible-playbook playbooks/verify_security.yml -e "client_name=Nexity"

# Run all sections
ansible-playbook playbooks/verify_all.yml -e "client_name=Nexity"

# Run with verbose output
ansible-playbook playbooks/verify_monitoring.yml -e "client_name=Nexity" -vv
```

## AWX Setup (for Web UI Integration)

The web app's "Ansible" button in each checklist section triggers AWX job templates.
Follow these steps to set up AWX:

### 1. Create a Project in AWX

1. Go to AWX → Resources → Projects
2. Click **Add**
3. Fill in:
   - **Name**: `B2R-Checklist`
   - **Organization**: Default
   - **Source Control Type**: Git
   - **Source Control URL**: `http://10.7.157.105:8081/koussay/projet-fin-etude-main.git`
   - **Source Control Branch**: `main`
4. Click **Save**

### 2. Create an Inventory

1. Go to AWX → Resources → Inventories
2. Click **Add** → **Add inventory**
3. Fill in:
   - **Name**: `B2R-Hosts`
   - **Organization**: Default
4. Click **Save**
5. Go to the **Hosts** tab → **Add**
   - **Name**: `localhost`
   - **Variables**: `ansible_connection: local`

For remote hosts, add your actual servers with SSH credentials.

### 3. Create Job Templates (one per section)

Create 8 job templates, one for each section:

| Template Name | Playbook |
|---|---|
| `B2R-Verify-JIRA` | `ansible/playbooks/verify_jira.yml` |
| `B2R-Verify-Dollar-Universe` | `ansible/playbooks/verify_dollar_universe.yml` |
| `B2R-Verify-Plan-Production` | `ansible/playbooks/verify_plan_production.yml` |
| `B2R-Verify-Env-Applicatif` | `ansible/playbooks/verify_env_applicatif.yml` |
| `B2R-Verify-Monitoring` | `ansible/playbooks/verify_monitoring.yml` |
| `B2R-Verify-Livrables` | `ansible/playbooks/verify_livrables.yml` |
| `B2R-Verify-Systeme-Infra` | `ansible/playbooks/verify_systeme_infra.yml` |
| `B2R-Verify-Security` | `ansible/playbooks/verify_security.yml` |

For each template:
1. Go to AWX → Resources → Templates
2. Click **Add** → **Add job template**
3. Fill in:
   - **Name**: (from table above)
   - **Job Type**: Run
   - **Inventory**: `B2R-Hosts`
   - **Project**: `B2R-Checklist`
   - **Playbook**: (from table above)
   - **Extra Variables**: Check "Prompt on launch"
4. Click **Save**

### 4. Quick Setup Script

You can also create all templates via the AWX API:

```bash
AWX_URL="http://10.7.157.105:30080"
AWX_TOKEN="your-token-here"

# Get token first:
curl -s -k -X POST "$AWX_URL/api/v2/tokens/" \
  -H "Content-Type: application/json" \
  -u "admin:np8H1YJCFprU6JVSJVluIcWRmPkvBGuF" | jq .token

# Create project
curl -s -k -X POST "$AWX_URL/api/v2/projects/" \
  -H "Authorization: Bearer $AWX_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "B2R-Checklist",
    "organization": 1,
    "scm_type": "git",
    "scm_url": "http://10.7.157.105:8081/koussay/projet-fin-etude-main.git",
    "scm_branch": "main"
  }'

# Create inventory
curl -s -k -X POST "$AWX_URL/api/v2/inventories/" \
  -H "Authorization: Bearer $AWX_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "B2R-Hosts", "organization": 1}'

# Create templates (repeat for each section)
for section in \
  "B2R-Verify-JIRA:ansible/playbooks/verify_jira.yml" \
  "B2R-Verify-Dollar-Universe:ansible/playbooks/verify_dollar_universe.yml" \
  "B2R-Verify-Plan-Production:ansible/playbooks/verify_plan_production.yml" \
  "B2R-Verify-Env-Applicatif:ansible/playbooks/verify_env_applicatif.yml" \
  "B2R-Verify-Monitoring:ansible/playbooks/verify_monitoring.yml" \
  "B2R-Verify-Livrables:ansible/playbooks/verify_livrables.yml" \
  "B2R-Verify-Systeme-Infra:ansible/playbooks/verify_systeme_infra.yml" \
  "B2R-Verify-Security:ansible/playbooks/verify_security.yml"; do

  NAME="${section%%:*}"
  PLAYBOOK="${section##*:}"

  curl -s -k -X POST "$AWX_URL/api/v2/job_templates/" \
    -H "Authorization: Bearer $AWX_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$NAME\",
      \"job_type\": \"run\",
      \"inventory\": 1,
      \"project\": 2,
      \"playbook\": \"$PLAYBOOK\",
      \"ask_variables_on_launch\": true
    }"
done
```

## Output Format

Each playbook outputs a JSON result via `debug` with this structure:

```json
{
  "section": 8,
  "name": "SECURITY",
  "client": "Nexity",
  "timestamp": "2026-02-19T10:00:00Z",
  "items": [
    {
      "id": "8.1",
      "name": "Agent Trend déployé et à jour",
      "status": "done",
      "detail": "Trend agent: active"
    }
  ]
}
```

Status values: `done`, `in_progress`, `not_started`, `na`

The web app parses this JSON and updates the checklist items automatically.

## Customization

Edit `group_vars/all.yml` to customize:
- Service paths and names
- Expected versions
- Monitoring URLs
- Security tool names
- Document search paths
