#!/usr/bin/env python3
"""
verify_jira.py
Run checks against Jira and print a single JSON result to stdout.

Env vars:
  JIRA_URL, JIRA_USER, JIRA_API_TOKEN, SERVICE_DESK_PROJECT_KEY
Args:
  --client "ClientName"

Outputs:
  JSON object with "client", "timestamp", "checks" array.
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
    # try project search endpoint
    try:
        url = f"{base_url}/rest/api/3/project/search"
        params = {"query": name}
        res = api_get(url, auth, params=params)
        for p in res.get("values", []):
            if p.get("name","").lower() == name.lower():
                return p
        for p in res.get("values", []):
            if name.lower() in p.get("name","").lower():
                return p
    except requests.HTTPError:
        pass
    return None

def ensure_component(base_url, auth, project_key, component_name):
    try:
        comps = api_get(f"{base_url}/rest/api/3/project/{project_key}/components", auth)
        for c in comps:
            if c.get("name","").lower() == component_name.lower():
                return {"created": False, "component": c}
    except Exception:
        # ignore; we'll try to create it
        pass
    payload = {"name": component_name, "project": project_key}
    try:
        comp = api_post(f"{base_url}/rest/api/3/component", auth, payload)
        return {"created": True, "component": comp}
    except Exception as e:
        return {"created": False, "error": str(e)}

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
        if t.get("name","").lower() in target_lc:
            chosen = t
            break
    if not chosen and transitions:
        chosen = transitions[-1]  # fallback
    if not chosen:
        return {"ok": False, "error": "no available transition"}
    trans_url = f"{base_url}/rest/api/3/issue/{issue_key}/transitions"
    try:
        r = requests.post(trans_url, json={"transition": {"id": chosen["id"]}}, verify=True, timeout=30)
        if r.status_code in (200,204):
            return {"ok": True, "transitioned_to": chosen.get("name")}
        else:
            return {"ok": False, "status": r.status_code, "text": r.text}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def create_service_desk_issue(base_url, auth, project_key, summary, description):
    url = f"{base_url}/rest/api/3/issue"
    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": summary,
            "description": description,
            "issuetype": {"name": "Task"}  # adapt if you want a Service Request type
        }
    }
    try:
        res = api_post(url, auth, payload)
        return {"created": True, "key": res.get("key")}
    except Exception as e:
        return {"created": False, "error": str(e)}

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
        "ok": False,
        "error": "JIRA_URL environment variable is required"
    }))
        sys.exit(2)

    #auth = (user, token)
    auth = None
    client = args.client.strip()
    out = {"client": client, "timestamp": datetime.datetime.utcnow().isoformat(), "checks": []}

    project = find_project_by_name(base_url, auth, client)
    if not project:
        out["checks"].append({
            "name": "find_project",
            "ok": False,
            "message": f"Project not found for client '{client}'"
        })
        print(json.dumps(out, ensure_ascii=False))
        sys.exit(0)

    out["project"] = {"key": project.get("key"), "name": project.get("name")}
    out["checks"].append({"name": "find_project", "ok": True, "project": out["project"]})

    # 1) Create or verify component
    comp_res = ensure_component(base_url, auth, project.get("key"), "Création du composant JIRA")
    out["checks"].append({"name": "component_creation", **comp_res})

    # 2) Check RUN project (we try matching "client RUN" or project with 'RUN' in name)
    run_candidate = find_project_by_name(base_url, auth, f"{client} RUN")
    if not run_candidate:
        # fallback: search for any project with RUN in the name
        # call project search without filters and scan (may be paginated)
        run_found = None
        try:
            url = f"{base_url}/rest/api/3/project/search"
            res = api_get(url, auth)
            for p in res.get("values", []):
                if "run" in p.get("name","").lower() and client.lower() in p.get("name","").lower():
                    run_found = p
                    break
        except Exception:
            run_found = None
        if run_found:
            out["checks"].append({"name": "run_project", "ok": True, "project": {"key": run_found.get("key"), "name": run_found.get("name")}})
        else:
            out["checks"].append({"name": "run_project", "ok": False, "message": "RUN project not found"})
    else:
        out["checks"].append({"name": "run_project", "ok": True, "project": {"key": run_candidate.get("key"), "name": run_candidate.get("name")}})

    # 3) Close tickets in "Build"
    issues = find_issues_in_status(base_url, auth, project.get("key"), "Build")
    close_results = []
    for issue in issues:
        key = issue.get("key")
        res = transition_issue(base_url, auth, key, default_transitions)
        close_results.append({"key": key, "result": res})
    out["checks"].append({"name": "close_build_issues", "count": len(issues), "results": close_results})

    # 4) Inform service desk
    summary = f"Verification results for client {client} - {datetime.date.today().isoformat()}"
    description = "Verification summary:\n\n" + json.dumps(out, indent=2, ensure_ascii=False)
    sd = create_service_desk_issue(base_url, auth, sd_project, summary, description)
    out["checks"].append({"name": "inform_service_desk", **sd})

    print(json.dumps(out, ensure_ascii=False))
    sys.exit(0)

if __name__ == "__main__":
    main()































