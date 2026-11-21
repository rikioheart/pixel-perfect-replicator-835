# Cloisonnement des comptes non validés (critère GO n°1, migration 0074).
# Lecture seule par l'API réelle avec un compte fictif temporaire (agent-test+…@example.com),
# créé par l'outil de session Lovable (utilisateur d'essai) puis supprimé automatiquement.
# Le statut (PENDING / REFUSED / ACTIVE) est posé à part par l'agent ; ce script ne fait que lire.
#
# Usage : LVDC_EXPECT=PENDING|REFUSED|ACTIVE python3 scripts/rls/unvalidated-isolation.py
import json, os, re, sys, requests

ENV = open(os.path.join(os.path.dirname(__file__), "..", "..", ".env")).read()
URL = re.search(r'VITE_SUPABASE_URL="?([^"\n]+)', ENV).group(1)
KEY = re.search(r'VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\n]+)', ENV).group(1)
S = json.load(open(os.path.expanduser(os.environ.get("LVDC_SESSION", "~/.cache/lovable-auth/session.json"))))
TOK, EMAIL = S["session"]["access_token"], S["session"]["user"]["email"]
if not re.fullmatch(r"agent-test\+[0-9a-f]+@example\.com", EMAIL):
    sys.exit("Ce script ne s'exécute qu'avec un compte fictif temporaire agent-test+…@example.com.")
EXPECT = os.environ.get("LVDC_EXPECT", "PENDING")
H = {"apikey": KEY, "Authorization": f"Bearer {TOK}", "Content-Type": "application/json"}
def sel(q): r = requests.get(f"{URL}/rest/v1/{q}", headers=H); return r.json() if r.ok else []
def rpc(fn, a): r = requests.post(f"{URL}/rest/v1/rpc/{fn}", json=a, headers=H); return r.json() if r.ok else None

ok = True
def check(name, cond, detail=""):
    global ok; ok &= bool(cond); print("OK    " if cond else "ÉCHEC ", name, "" if cond else detail)

counts = {t: len(sel(f"{t}?select=id&limit=200")) for t in
          ["projects", "tasks", "project_milestones", "project_members", "contributions", "events", "documents", "comments"]}
print(EXPECT, counts)
search = rpc("global_search", {"_term": "de"}) or []
kinds = {x["kind"] for x in search}
first_project = sel("projects?select=id&limit=1")

if EXPECT in ("PENDING", "REFUSED"):
    for t, n in counts.items():
        check(f"{EXPECT} : aucune ligne interne lisible dans {t}", n == 0, n)
    check(f"{EXPECT} : la recherche ne renvoie ni projet, tâche, événement ni document",
          not (kinds & {"project", "task", "event", "document"}), kinds)
    r = requests.post(f"{URL}/rest/v1/contributions", headers={**H, "Prefer": "return=representation"},
                      json={"user_id": S["session"]["user"]["id"], "status": "PROPOSED", "title": "test"})
    check(f"{EXPECT} : proposer son aide est refusé", r.status_code >= 400, r.status_code)
    if r.ok:  # ne doit jamais arriver ; on annule aussitôt
        for row in r.json(): requests.delete(f"{URL}/rest/v1/contributions?id=eq.{row['id']}", headers=H)
else:
    check("ACTIVE : les projets « Association » restent visibles", counts["projects"] > 0, counts)
    check("ACTIVE : les tâches des projets restent visibles", counts["tasks"] > 0, counts)
    check("ACTIVE : la recherche retrouve des projets", "project" in kinds, kinds)
    if first_project:
        peek = rpc("entity_peek", {"_type": "project", "_id": first_project[0]["id"]})
        check("ACTIVE : la fiche rapide d'un projet s'ouvre", bool(peek and peek.get("title")), peek)
sys.exit(0 if ok else 1)
