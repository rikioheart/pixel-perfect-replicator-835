# Tests d'accès réels (API) des deux comptes d'essai bêta : chacun n'accède qu'aux fonctions de son profil.
# Lecture seule : les écritures tentées doivent être refusées ; si l'une passait, elle est annulée et signalée.
#
# Usage :
#   lovable auth-session --json --user <id particulier>  puis copier ~/.cache/lovable-auth/session.json vers un fichier
#   lovable auth-session --json --user <id pro>          idem
#   LVDC_PARTICULIER_SESSION=/chemin/particulier.json LVDC_PRO_SESSION=/chemin/pro.json python3 scripts/rls/beta-accounts-access.py
# Comptes : associationlavoixduchien+essai-particulier@gmail.com et associationlavoixduchien+essai-pro@gmail.com
import json, os, re, sys, uuid, requests

ENV = open(os.path.join(os.path.dirname(__file__), "..", "..", ".env")).read()
URL = re.search(r'VITE_SUPABASE_URL="?([^"\n]+)', ENV).group(1)
KEY = re.search(r'VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\n]+)', ENV).group(1)
PART_EMAIL = "associationlavoixduchien+essai-particulier@gmail.com"
PRO_EMAIL = "associationlavoixduchien+essai-pro@gmail.com"

def session(var):
    s = json.load(open(os.environ[var]))["session"]
    return s["access_token"], s["user"]["id"], s["user"]["email"]

def H(tok, extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    h.update(extra or {}); return h
def rpc(tok, fn, args=None): return requests.post(f"{URL}/rest/v1/rpc/{fn}", json=args or {}, headers=H(tok))
def sel(tok, q): return requests.get(f"{URL}/rest/v1/{q}", headers=H(tok))
def ins(tok, table, row): return requests.post(f"{URL}/rest/v1/{table}", json=row, headers=H(tok, {"Prefer": "return=representation"}))
def patch(tok, q, body): return requests.patch(f"{URL}/rest/v1/{q}", json=body, headers=H(tok, {"Prefer": "return=representation"}))
def delete(tok, q): return requests.delete(f"{URL}/rest/v1/{q}", headers=H(tok))

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("OK    " if cond else "ÉCHEC "), name, "" if cond else str(detail)[:300])

def body(r):
    try: return r.json()
    except Exception: return r.text

def denied(r):
    """Refus = erreur HTTP, ou réponse vide / nulle / fausse (la RLS filtre sans erreur)."""
    if r.status_code >= 400: return True
    b = body(r)
    if b in (None, [], {}, False, "", "null"): return True
    if isinstance(b, dict) and (b.get("ok") is False or b.get("allowed") is False): return True
    return False

def rows(r): b = body(r); return b if isinstance(b, list) else []

P_TOK, P, p_mail = session("LVDC_PARTICULIER_SESSION")
R_TOK, R, r_mail = session("LVDC_PRO_SESSION")
if p_mail != PART_EMAIL or r_mail != PRO_EMAIL:
    sys.exit(f"Sessions inattendues ({p_mail}, {r_mail}) : ce script ne s'exécute qu'avec les comptes d'essai.")

def common_denials(label, tok, me, other):
    """Ce qu'aucun des deux comptes ne doit pouvoir faire : tout ce qui relève du Bureau ou d'autrui."""
    check(f"{label} : n'est pas Bureau", rpc(tok, "is_bureau", {"_user_id": me}).json() is False)
    for fn, args in [("bureau_console_summary", {}), ("bureau_statistics", {"_from": "2026-01-01", "_to": "2026-12-31"}),
                     ("bureau_dogs", {})]:
        check(f"{label} : console Bureau refusée ({fn})", denied(rpc(tok, fn, args)), body(rpc(tok, fn, args)))
    # « Équipe du Bureau » de l'annuaire : visible par les membres, mais seulement les noms.
    r = rpc(tok, "list_bureau_members")
    check(f"{label} : l'équipe du Bureau n'expose que les noms", r.status_code == 200 and all(set(x) <= {"id", "name"} for x in rows(r)), body(r))
    for table in ["audit_logs", "accounting", "finance_entries", "governance_records", "professional_internal_details",
                  "member_imports", "integration_events", "user_permission_overrides", "delegations"]:
        r = sel(tok, f"{table}?select=id&limit=5")
        check(f"{label} : aucune ligne lisible dans {table}", denied(r), body(r))
    r = sel(tok, f"in_app_notifications?select=id&recipient_id=neq.{me}&limit=5")
    check(f"{label} : ne lit pas les notifications des autres", denied(r), body(r))
    r = sel(tok, f"reimbursements?select=id,requester_id&limit=50")
    check(f"{label} : ne voit que ses propres remboursements", all(x.get("requester_id") == me for x in rows(r)), body(r))
    r = sel(tok, f"user_roles?select=user_id&user_id=neq.{me}&limit=5")
    check(f"{label} : ne lit pas les rôles des autres", denied(r), body(r))
    for fn in ["profile_details", "profile_contacts"]:
        r = rpc(tok, fn, {"_ids": [other]})
        check(f"{label} : coordonnées et détails privés de l'autre compte refusés ({fn})", denied(r), body(r))

    # Tentatives d'écriture qui doivent toutes échouer
    roles = rows(sel(tok, "roles?select=id,code"))
    admin = next((x["id"] for x in roles if x["code"] == "ADMIN_BUREAU"), None)
    if admin:
        r = ins(tok, "user_roles", {"user_id": me, "role_id": admin})
        ok = r.status_code >= 400
        if not ok: delete(tok, f"user_roles?user_id=eq.{me}&role_id=eq.{admin}")
        check(f"{label} : ne peut pas s'attribuer le rôle Bureau", ok, body(r))
    r = ins(tok, "member_functions", {"user_id": me, "function_type": "PRESIDENT"})
    ok = r.status_code >= 400
    if not ok:
        for x in rows(r): delete(tok, f"member_functions?id=eq.{x['id']}")
    check(f"{label} : ne peut pas s'attribuer une fonction du Bureau", ok, body(r))
    r = patch(tok, f"profiles?id=eq.{me}", {"membership_status": "PENDING"})
    check(f"{label} : ne peut pas modifier son statut d'adhésion", r.status_code >= 400 or not rows(r) or rows(r)[0].get("membership_status") == "ACTIVE", body(r))
    r = rpc(tok, "decide_membership", {"_profile_id": other, "_decision": "ACTIVE"})
    check(f"{label} : ne peut pas valider une adhésion", r.status_code >= 400, body(r))
    r = rpc(tok, "create_delegation", {"_delegate": other, "_code": "members.validate", "_scope_type": "GLOBAL",
                                       "_scope_id": None, "_reason": "essai", "_ends_at": "2026-12-31T00:00:00Z"})
    check(f"{label} : ne peut pas déléguer un droit qu'il n'a pas", r.status_code >= 400, body(r))
    r = rpc(tok, "set_pass_validator", {"_user_id": me, "_enabled": True})
    check(f"{label} : ne peut pas se nommer validateur de pass Bureau", r.status_code >= 400, body(r))
    r = rpc(tok, "bureau_close_account", {"_profile_id": other, "_reason": "essai", "_confirm": "essai"})
    check(f"{label} : ne peut pas radier un membre", r.status_code >= 400, body(r))
    r = ins(tok, "governance_records", {"kind": "BUREAU", "title": "essai-acces"})
    ok = r.status_code >= 400
    if not ok:
        for x in rows(r): delete(tok, f"governance_records?id=eq.{x['id']}")
    check(f"{label} : ne peut pas écrire au registre de gouvernance", ok, body(r))

print("— Compte d'essai particulier —")
r = sel(P_TOK, f"profiles?id=eq.{P}&select=id,membership_type,membership_status")
check("Particulier : lit son propre profil (particulier actif)", rows(r) == [{"id": P, "membership_type": "PARTICULIER", "membership_status": "ACTIVE"}], body(r))
check("Particulier : n'est pas professionnel", rpc(P_TOK, "is_professional", {"_user_id": P}).json() is False)
check("Particulier : n'est pas validateur de pass", rpc(P_TOK, "is_pass_validator", {"_user_id": P}).json() is False)
r = sel(P_TOK, "loyalty_cards?select=member_id")
check("Particulier : ne voit que sa propre carte de fidélité", all(x["member_id"] == P for x in rows(r)), body(r))
r = rpc(P_TOK, "get_pro_dogs")
check("Particulier : aucun accès à l'espace des chiens suivis par les pros", denied(r), body(r))
r = rpc(P_TOK, "award_manual_stamp", {"_member_id": R, "_bureau_id": None, "_activity_id": None, "_event_id": None, "_reason": "essai"})
check("Particulier : ne peut pas attribuer de tampon", r.status_code >= 400 or denied(r), body(r))
r = rpc(P_TOK, "list_particuliers")
check("Particulier : ne peut pas lister les autres particuliers", denied(r), body(r))
r = ins(P_TOK, "forms", {"title": "essai-acces", "purpose": "essai", "data_usage": "essai", "created_by": P})
ok = r.status_code >= 400
if not ok:
    for x in rows(r): delete(P_TOK, f"forms?id=eq.{x['id']}")
check("Particulier : ne peut pas créer de formulaire", ok, body(r))
r = ins(P_TOK, "pro_details", {"profile_id": P, "company_name": "essai-acces"})
ok = r.status_code >= 400
if not ok:
    print("      ⚠ ligne d'essai créée dans pro_details (suppression réservée au Bureau) : à retirer", [x["id"] for x in rows(r)])
check("Particulier : ne peut pas se créer une fiche professionnelle", ok, body(r))
r = patch(R_TOK, f"pro_details?profile_id=eq.{R}", {"can_grant_stamps": True})
ok = r.status_code >= 400 or not rows(r) or rows(r)[0].get("can_grant_stamps") is False
if not ok: patch(R_TOK, f"pro_details?profile_id=eq.{R}", {"can_grant_stamps": False})
check("Pro : ne peut pas s'accorder lui-même le droit de délivrer des tampons", ok, body(r))
common_denials("Particulier", P_TOK, P, R)

print("— Compte d'essai professionnel —")
r = sel(R_TOK, f"profiles?id=eq.{R}&select=id,membership_type,membership_status")
check("Pro : lit son propre profil (professionnel actif)", rows(r) == [{"id": R, "membership_type": "PROFESSIONNEL", "membership_status": "ACTIVE"}], body(r))
check("Pro : est reconnu professionnel", rpc(R_TOK, "is_professional", {"_user_id": R}).json() is True)
check("Pro : peut valider des pass (pro actif)", rpc(R_TOK, "is_pass_validator", {"_user_id": R}).json() is True)
r = rpc(R_TOK, "get_pro_dogs")
check("Pro : ouvre son espace des chiens suivis", r.status_code == 200, body(r))
r = sel(R_TOK, f"pro_details?select=profile_id,company_name&profile_id=eq.{R}")
check("Pro : lit sa propre fiche professionnelle", len(rows(r)) == 1 and rows(r)[0]["company_name"] == "Structure d'essai (bêta)", body(r))
r = sel(R_TOK, f"dogs?select=id&owner_id=neq.{R}&limit=5")
check("Pro : ne lit aucun chien d'autrui en direct", denied(r), body(r))
r = sel(R_TOK, f"loyalty_cards?select=member_id&member_id=neq.{R}&limit=5")
check("Pro : ne lit pas les cartes de fidélité des membres", denied(r), body(r))
r = ins(R_TOK, "forms", {"title": "essai-acces", "purpose": "essai", "data_usage": "essai", "created_by": R})
ok = r.status_code >= 400
if not ok:
    for x in rows(r): delete(R_TOK, f"forms?id=eq.{x['id']}")
check("Pro actif : peut préparer un formulaire (brouillon supprimé aussitôt)", not ok and rows(r)[0]["status"] == "DRAFT", body(r))
r = patch(R_TOK, f"professional_public_profile?profile_id=eq.{R}", {"status": "ACTIVE"})
check("Pro : ne peut pas valider lui-même sa fiche publique", r.status_code >= 400 or not rows(r), body(r))
common_denials("Pro", R_TOK, R, P)

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} vérifications réussies")
sys.exit(1 if failed else 0)
