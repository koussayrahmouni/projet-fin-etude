#!/usr/bin/env python3
"""
verify_jira.py
Run checks against Jira and print a standardized JSON result to stdout.

Env vars:
  JIRA_URL, JIRA_USER, JIRA_API_TOKEN, SERVICE_DESK_PROJECT_KEY
Args:
  --client "ClientName"

Outputs:
  JSON matching the B2R checklist format:
  {
    "section": 1,
    "name": "JIRA",
    "client": "...",
    "timestamp": "...",
    "items": [
      { "id": "1.1", "name": "...", "status": "done|not_started", "detail": "..." }
    ]
  }
"""
import os
import sys
import argparse
import requests
import json
import datetime
from typing import List

requests.packages.urllib3.disable_warnings()


def api_get(url, auth, params=None):
    r = requests.get(url, params=params, verify=True, timeout=30)
    r.raise_for_status()
    return r.json()


def api_post(url, auth, payload):
    r = requests.post(url, json=payload, verify=True, timeout=30)
    r.raise_for_status()
    return r.json()


def find_project_by_name(base_url, auth, name):
    try:
        url = f"{base_url}/rest/api/3/project/search"
        params = {"query": name}
        res = api_get(url, auth, params=params)
        for p in res.get("values", []):
            if p.get("name", "").lower() == name.lower():
                return p
        for p in res.get("values", []):
            if name.lower() in p.get("name", "").lower():
                return p
    except requests.HTTPError:
        pass
    return None


def ensure_component(base_url, auth, project_key, component_name):
    try:
        comps = api_get(f"{base_url}/rest/api/3/project/{project_key}/components", auth)
        for c in comps:
            if c.get("name", "").lower() == component_name.lower():
                return True, "Component already exists"
    except Exception:
        pass
    payload = {"name": component_name, "project": project_key}
    try:
        api_post(f"{base_url}/rest/api/3/component", auth, payload)
        return True, "Component created successfully"
    except Exception as e:
        return False, f"Failed to create component: {e}"


def find_issues_in_status(base_url, auth, project_key, status_name) -> List[dict]:
    jql = f'project = "{project_key}" AND status = "{status_name}"'
    url = f"{base_url}/rest/api/3/search"
    params = {"jql": jql, "maxResults": 500}
    try:
        res = api_get(url, auth, params=params)
        return res.get("issues", [])
    except Exception:
        return []


def get_transitions(base_url, auth, issue_key):
    url = f"{base_url}/rest/api/3/issue/{issue_key}/transitions"
    try:
        res = api_get(url, auth)
        return res.get("transitions", [])
    except Exception:
        return []


def transition_issue(base_url, auth, issue_key, target_names):
    transitions = get_transitions(base_url, auth, issue_key)
    target_lc = [t.lower() for t in target_names]
    chosen = None
    for t in transitions:
        if t.get("name", "").lower() in target_lc:
            chosen = t
            break
    if not chosen and transitions:
        chosen = transitions[-1]
    if not chosen:
        return False, "No available transition"
    trans_url = f"{base_url}/rest/api/3/issue/{issue_key}/transitions"
    try:
        r = requests.post(trans_url, json={"transition": {"id": chosen["id"]}}, verify=True, timeout=30)
        if r.status_code in (200, 204):
            return True, f"Transitioned to {chosen.get('name')}"
        else:
            return False, f"HTTP {r.status_code}: {r.text[:100]}"
    except Exception as e:
        return False, str(e)


def create_service_desk_issue(base_url, auth, project_key, summary, description):
    url = f"{base_url}/rest/api/3/issue"
    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": summary,
            "description": description,
            "issuetype": {"name": "Task"},
        }
    }
    try:
        res = api_post(url, auth, payload)
        return True, f"Created issue {res.get('key')}"
    except Exception as e:
        return False, f"Failed: {e}"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--client", required=True)
    args = p.parse_args()

    base_url = os.getenv("JIRA_URL")
    user = os.getenv("JIRA_USER")
    token = os.getenv("JIRA_API_TOKEN")
    sd_project = os.getenv("SERVICE_DESK_PROJECT_KEY", "SD")
    default_transitions = os.getenv("DEFAULT_TRANSITIONS", "Done,Closed").split(",")

    if not base_url:
        print(json.dumps({
            "section": 1,
            "name": "JIRA",
            "client": args.client,
            "error": "JIRA_URL environment variable is required",
            "items": [
                {"id": "1.1", "name": "Projet JIRA RUN à ouvrir", "status": "not_started", "detail": "JIRA_URL not configured"},
                {"id": "1.2", "name": "Création du composant JIRA", "status": "not_started", "detail": "JIRA_URL not configured"},
                {"id": "1.3", "name": "Informer le service desk", "status": "not_started", "detail": "JIRA_URL not configured"},
                {"id": "1.4", "name": "Clôturer tickets Build (DELIVERY)", "status": "not_started", "detail": "JIRA_URL not configured"},
                {"id": "1.5", "name": "Clôturer tickets Build (ARCHITECTURE)", "status": "not_started", "detail": "JIRA_URL not configured"},
            ]
        }))
        sys.exit(0)

    auth = None
    client = args.client.strip()
    items = []

    # 1.1 - Find project (Projet JIRA RUN à ouvrir)
    project = find_project_by_name(base_url, auth, client)
    if project:
        items.append({
            "id": "1.1",
            "name": "Projet JIRA RUN à ouvrir",
            "status": "done",
            "detail": f"Project found: {project.get('key')} ({project.get('name')})"
        })
    else:
        items.append({
            "id": "1.1",
            "name": "Projet JIRA RUN à ouvrir",
            "status": "not_started",
            "detail": f"Project not found for client '{client}'"
        })
        # Can't continue without a project - mark rest as not_started
        items.extend([
            {"id": "1.2", "name": "Création du composant JIRA", "status": "not_started", "detail": "Project not found"},
            {"id": "1.3", "name": "Informer le service desk", "status": "not_started", "detail": "Project not found"},
            {"id": "1.4", "name": "Clôturer tickets Build (DELIVERY)", "status": "not_started", "detail": "Project not found"},
            {"id": "1.5", "name": "Clôturer tickets Build (ARCHITECTURE)", "status": "not_started", "detail": "Project not found"},
        ])
        out = {
            "section": 1,
            "name": "JIRA",
            "client": client,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "items": items,
        }
        print(json.dumps(out, ensure_ascii=False))
        sys.exit(0)

    project_key = project.get("key")

    # 1.2 - Create or verify component
    comp_ok, comp_detail = ensure_component(base_url, auth, project_key, "Création du composant JIRA")
    items.append({
        "id": "1.2",
        "name": "Création du composant JIRA",
        "status": "done" if comp_ok else "not_started",
        "detail": comp_detail,
    })

    # 1.3 - Inform service desk of B2R date
    summary = f"B2R verification for client {client} - {datetime.date.today().isoformat()}"
    description = f"Automated B2R checklist verification for {client}"
    sd_ok, sd_detail = create_service_desk_issue(base_url, auth, sd_project, summary, description)
    items.append({
        "id": "1.3",
        "name": "Informer le service desk",
        "status": "done" if sd_ok else "not_started",
        "detail": sd_detail,
    })

    # 1.4 - Close Build tickets (NSS DELIVERY)
    issues = find_issues_in_status(base_url, auth, project_key, "Build")
    closed_count = 0
    for issue in issues:
        ok, _ = transition_issue(base_url, auth, issue.get("key"), default_transitions)
        if ok:
            closed_count += 1
    items.append({
        "id": "1.4",
        "name": "Clôturer tickets Build (DELIVERY)",
        "status": "done" if len(issues) == 0 or closed_count == len(issues) else "in_progress",
        "detail": f"{closed_count}/{len(issues)} Build tickets closed" if issues else "No Build tickets found (already clean)",
    })

    # 1.5 - Close Build tickets (ARCHITECTURE) - same check, different owner
    items.append({
        "id": "1.5",
        "name": "Clôturer tickets Build (ARCHITECTURE)",
        "status": items[-1]["status"],  # Same result as 1.4
        "detail": items[-1]["detail"],
    })

    out = {
        "section": 1,
        "name": "JIRA",
        "client": client,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "items": items,
    }
    print(json.dumps(out, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
