

from fastapi import FastAPI, HTTPException
from typing import List, Dict
from uuid import uuid4

app = FastAPI(title="Fake Jira")

# ---- In-memory DB ----
PROJECTS = [
    {"id": "10001", "key": "ACME", "name": "ACME"},
    {"id": "10002", "key": "ACME-RUN", "name": "ACME RUN"},
    {"id": "10003", "key": "SD", "name": "Service Desk"},
]

COMPONENTS: Dict[str, List[dict]] = {
    "ACME": []
}

ISSUES = [
    {
        "id": "20001",
        "key": "ACME-1",
        "project": "ACME",
        "status": "Build"
    },
    {
        "id": "20002",
        "key": "ACME-2",
        "project": "ACME",
        "status": "Build"
    }
]

TRANSITIONS = [
    {"id": "1", "name": "Done"},
    {"id": "2", "name": "Closed"}
]

# ---- API ----

@app.get("/rest/api/3/project/search")
def project_search(query: str = ""):
    values = [p for p in PROJECTS if query.lower() in p["name"].lower()]
    return {"values": values}

@app.get("/rest/api/3/project/{project_key}/components")
def get_components(project_key: str):
    return COMPONENTS.get(project_key, [])

@app.post("/rest/api/3/component")
def create_component(payload: dict):
    project = payload.get("project")
    name = payload.get("name")
    if not project or not name:
        raise HTTPException(400, "Invalid component payload")

    comp = {"id": str(uuid4()), "name": name}
    COMPONENTS.setdefault(project, []).append(comp)
    return comp

@app.get("/rest/api/3/search")
def search_issues(jql: str, maxResults: int = 50):
    # extremely simplified JQL parsing
    results = []
    for issue in ISSUES:
        if issue["status"] in jql and issue["project"] in jql:
            results.append({
                "id": issue["id"],
                "key": issue["key"]
            })
    return {"issues": results}

@app.get("/rest/api/3/issue/{issue_key}/transitions")
def get_transitions(issue_key: str):
    return {"transitions": TRANSITIONS}

@app.post("/rest/api/3/issue/{issue_key}/transitions")
def do_transition(issue_key: str, payload: dict):
    for issue in ISSUES:
        if issue["key"] == issue_key:
            issue["status"] = "Done"
            return {}
    raise HTTPException(404, "Issue not found")

@app.post("/rest/api/3/issue")
def create_issue(payload: dict):
    key = f"SD-{len(ISSUES)+1}"
    ISSUES.append({
        "id": str(uuid4()),
        "key": key,
        "project": payload["fields"]["project"]["key"],
        "status": "Open"
    })
    return {"key": key}





