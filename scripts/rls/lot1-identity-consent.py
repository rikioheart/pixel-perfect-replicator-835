"""Real API tests on THREE temporary agent-test accounts only; no real member writes.

Usage: python3 scripts/rls/lot1-identity-consent.py /tmp/browser/lot1 initial|validated
The directory holds owner-session.json, representative-session.json and bureau-session.json
created with lovable auth-session --create-test-user. Initial never creates a pro request;
exercise that request and its Bureau approval through the UI before running validated.
"""
import json
import re
import sys
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2]
env = (ROOT / ".env").read_text()
url = re.search(r'VITE_SUPABASE_URL="?([^"\n]+)', env).group(1)
key = re.search(r'VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\n]+)', env).group(1)
folder = Path(sys.argv[1])
phase = sys.argv[2]
actors = {}
for name in ["owner", "representative", "bureau"]:
    session = json.loads((folder / f"{name}-session.json").read_text())["session"]
    if not session["user"]["email"].startswith("agent-test+") or not session["user"]["email"].endswith("@example.com"):
        raise SystemExit("Refus : compte non fictif")
    actors[name] = (session["user"]["id"], session["access_token"])
if len({a[0] for a in actors.values()}) != 3:
    raise SystemExit("Trois comptes fictifs distincts requis")
owner, representative, bureau = (actors[x][0] for x in ["owner", "representative", "bureau"])
results = []


def call(actor, method, path, data=None):
    headers = {"apikey": key, "Content-Type": "application/json", "Prefer": "return=representation"}
    if actor:
        headers["Authorization"] = "Bearer " + actors[actor][1]
    return requests.request(method, url + "/rest/v1/" + path, json=data, headers=headers, timeout=30)


def rpc(actor, name, data=None):
    return call(actor, "POST", "rpc/" + name, data or {})


def check(name, condition):
    results.append(bool(condition))
    print(("OK " if condition else "ÉCHEC ") + name)


def contact(actor):
    r = rpc(actor, "profile_contacts", {"_ids": [owner]})
    assert r.status_code == 200, "Lecture de coordonnées en erreur"
    return r.json()


def consent(enabled):
    r = call("owner", "PATCH", f"profiles?id=eq.{owner}&select=id,representative_contact_consent", {"representative_contact_consent": enabled})
    assert r.status_code == 200 and len(r.json()) == 1, "Changement d’accord non enregistré"


def pro():
    r = rpc("owner", "is_professional", {"_user_id": owner})
    assert r.status_code == 200, "Statut professionnel en erreur"
    return r.json()


def codes():
    r = rpc("owner", "my_permission_codes")
    assert r.status_code == 200, "Droits effectifs en erreur"
    return {row["code"] for row in r.json()}


def permission_rules():
    permissions = call("bureau", "GET", "permissions?select=id,code").json()
    permission = next(p for p in permissions if p["code"] == "members.validate")
    path = f"user_permission_overrides?user_id=eq.{owner}&permission_id=eq.{permission['id']}"
    try:
        r = call("bureau", "POST", "user_permission_overrides", {"user_id": owner, "permission_id": permission["id"], "effect": "GRANT", "reason": "Recette lot1 temporaire"})
        check("le Bureau accorde un droit au compte fictif", r.status_code == 201)
        check("le droit accordé est effectif", "members.validate" in codes())
        r = call("bureau", "PATCH", path, {"effect": "REVOKE"})
        check("le Bureau retire ce droit", r.status_code == 200)
        check("le retrait individuel est effectif", "members.validate" not in codes())
        r = call("owner", "PATCH", path, {"effect": "GRANT"})
        check("un membre ne rétablit pas ses propres droits", r.status_code >= 400 or r.json() == [])
        check("le droit reste retiré", "members.validate" not in codes())
        r = call("bureau", "POST", "user_permission_overrides", {"user_id": bureau, "permission_id": permission["id"], "effect": "GRANT"})
        check("le Bureau ne modifie pas ses propres exceptions", r.status_code >= 400)
    finally:
        call("bureau", "DELETE", path)
    baseline = codes()
    if not baseline:
        raise AssertionError("Rôle particulier et droits initiaux attendus")
    inherited = next(p for p in permissions if p["code"] in baseline)
    path = f"user_permission_overrides?user_id=eq.{owner}&permission_id=eq.{inherited['id']}"
    try:
        call("bureau", "POST", "user_permission_overrides", {"user_id": owner, "permission_id": inherited["id"], "effect": "REVOKE", "reason": "Recette lot1 temporaire"})
        check("un retrait prime sur un droit hérité du rôle", inherited["code"] not in codes())
    finally:
        call("bureau", "DELETE", path)


if phase == "initial":
    r = call("owner", "GET", f"profiles?id=eq.{owner}&select=representative_contact_consent")
    check("accord désactivé par défaut", r.status_code == 200 and r.json() == [{"representative_contact_consent": False}])
    check("sans accord, aucune coordonnée pour le représentant", contact("representative") == [])
    consent(True)
    contacts = contact("representative")
    check("avec accord, uniquement id, e-mail et téléphone", len(contacts) == 1 and set(contacts[0]) == {"id", "email", "phone"} and contacts[0]["phone"] == "+33600000000")
    r = call("bureau", "PATCH", f"profiles?id=eq.{owner}&select=id,representative_contact_consent", {"representative_contact_consent": False})
    check("le Bureau ne retire pas l’accord à la place du membre", r.status_code >= 400)
    r = rpc(None, "profile_contacts", {"_ids": [owner]})
    check("aucune coordonnée accessible anonymement", r.status_code >= 400)
    consent(False)
    check("retrait de l’accord immédiatement effectif", contact("representative") == [])
    functions = call("bureau", "GET", f"member_functions?user_id=eq.{representative}&select=id").json()
    assert len(functions) == 1
    path = f"member_functions?id=eq.{functions[0]['id']}"
    consent(True)
    call("bureau", "PATCH", path, {"function_type": "REPRESENTANT_PRO"})
    check("un représentant pro ne lit pas un particulier non pro", contact("representative") == [])
    call("bureau", "PATCH", path, {"function_type": "REPRESENTANT_PARTICULIER", "end_date": "2000-01-01"})
    check("un mandat expiré n’ouvre aucun accès", contact("representative") == [])
    call("bureau", "PATCH", path, {"end_date": None})
    consent(False)
    check("particulier non professionnel avant décision", pro() is False)
    r = call("owner", "POST", "pro_details", {"profile_id": owner, "company_name": "Essai", "pro_status": "VALIDATED"})
    check("auto-validation professionnelle refusée", r.status_code >= 400)
    permission_rules()
elif phase == "validated":
    check("qualité professionnelle reconnue après décision Bureau", pro() is True)
    r = call("owner", "GET", f"profiles?id=eq.{owner}&select=membership_type,membership_status")
    check("adhésion particulier active inchangée", r.json() == [{"membership_type": "PARTICULIER", "membership_status": "ACTIVE"}])
    picker = rpc("owner", "picker_people").json()
    mine = [row for row in picker if row["id"] == owner]
    check("qualités particulier et pro cumulées dans le sélecteur", len(mine) == 1 and {"PARTICULIER", "PRO"} <= set(mine[0]["qualities"]))
    check("cumul sans rôle Bureau", rpc("owner", "is_bureau", {"_user_id": owner}).json() is False)
    r = call("owner", "PATCH", f"pro_details?profile_id=eq.{owner}", {"pro_status": "SUSPENDED"})
    check("le pro ne change pas sa validation", r.status_code >= 400)
    r = call("owner", "PATCH", f"pro_details?profile_id=eq.{owner}", {"can_grant_stamps": True})
    check("le pro ne s’accorde pas les réglages Bureau", r.status_code >= 400)
    consent(True)
    functions = call("bureau", "GET", f"member_functions?user_id=eq.{representative}&select=id").json()
    path = f"member_functions?id=eq.{functions[0]['id']}"
    call("bureau", "PATCH", path, {"function_type": "REPRESENTANT_PRO"})
    check("le représentant pro lit le double profil consentant", len(contact("representative")) == 1)
    r = rpc("bureau", "decide_professional_quality", {"_profile_id": owner, "_status": "SUSPENDED", "_note": "Recette temporaire : suspension"})
    check("suspension par le Bureau enregistrée", r.status_code in (200, 204))
    check("suspension retire la qualité pro", pro() is False)
    check("suspension ferme l’accès du représentant pro", contact("representative") == [])
    r = rpc("bureau", "decide_professional_quality", {"_profile_id": owner, "_status": "VALIDATED"})
    check("réactivation par le Bureau enregistrée", r.status_code in (200, 204) and pro() is True)
    call("bureau", "PATCH", path, {"function_type": "REPRESENTANT_PARTICULIER"})
    consent(False)
else:
    raise SystemExit("Phase inconnue")
print(f"{sum(results)}/{len(results)} contrôles réussis")
sys.exit(0 if all(results) else 1)