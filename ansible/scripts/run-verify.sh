#!/usr/bin/env bash
set -euo pipefail

CLIENT="${1:-}"

if [[ -z "$CLIENT" ]]; then
  echo "Usage: $0 <client-name>" >&2
  exit 64
fi

# Find project root reliably
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PLAYBOOK="$PROJECT_ROOT/ansible/playbooks/verify_jira.yml"
INVENTORY="$PROJECT_ROOT/ansible/inventory/hosts"

if [[ ! -f "$PLAYBOOK" ]]; then
  echo "ERROR: Playbook not found at $PLAYBOOK" >&2
  exit 1
fi

if [[ ! -f "$INVENTORY" ]]; then
  echo "ERROR: Inventory not found at $INVENTORY" >&2
  exit 1
fi

echo "→ Running verification for client: $CLIENT"
echo "→ Playbook: $PLAYBOOK"

docker run --rm \
  -v "$PROJECT_ROOT/ansible":/ansible \
  -w /ansible \
  my-ansible \
  ansible-playbook \
    -i inventory/hosts \
    --extra-vars "client_name=$CLIENT" \
    playbooks/verify_jira.yml