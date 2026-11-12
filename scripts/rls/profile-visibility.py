# Tests d accès réels (API) du profil : visibilité par champ, annuaire, photos, anonyme.
# Usage : LVDC_MEMBRE_PASSWORD=... LVDC_BUREAU_PASSWORD=... python3 scripts/rls/profile-visibility.py
# Le second membre (non Bureau) est la session de ~/.cache/lovable-auth/session.json. L état du compte membre est restauré à la fin.
import json, os, re, requests, sys
ENV=open('/dev-server/.env').read()
URL=re.search(r'VITE_SUPABASE_URL="?([^"\n]+)',ENV).group(1); KEY=re.search(r'VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\n]+)',ENV).group(1)
def login(email,pw):
    r=requests.post(f"{URL}/auth/v1/token?grant_type=password",json={"email":email,"password":pw},headers={"apikey":KEY}); r.raise_for_status(); j=r.json(); return j["access_token"], j["user"]["id"]
def H(tok=None,extra=None):
    h={"apikey":KEY,"Content-Type":"application/json"}
    if tok: h["Authorization"]=f"Bearer {tok}"
    h.update(extra or {}); return h
def rpc(tok,fn,args): return requests.post(f"{URL}/rest/v1/rpc/{fn}",json=args,headers=H(tok))
def sel(tok,q): return requests.get(f"{URL}/rest/v1/{q}",headers=H(tok))
def patch(tok,uid,body): return requests.patch(f"{URL}/rest/v1/profiles?id=eq.{uid}",json=body,headers=H(tok,{"Prefer":"return=minimal"}))
results=[]
def check(name,cond,detail=""):
    results.append((name,bool(cond))); print(("OK  " if cond else "ÉCHEC"),name,("" if cond else detail))
M_TOK,M=login("membre@lavoixduchien.fr",os.environ["LVDC_MEMBRE_PASSWORD"])
B_TOK,B=login("bureau@lavoixduchien.fr",os.environ["LVDC_BUREAU_PASSWORD"])
mint=json.load(open(os.path.expanduser("~/.cache/lovable-auth/session.json")))
V_TOK=mint["session"]["access_token"]; V=mint["session"]["user"]["id"]
orig=rpc(B_TOK,"profile_details",{"_ids":[M]}).json()[0]
orig_pv=sel(B_TOK,f"profiles?id=eq.{M}&select=public_visibility,avatar_path").json()[0]
print("état d'origine sauvegardé")
try:
    r=patch(M_TOK,M,{"public_visibility":True,"bio":"TEST-L4 présentation","city":"Testville","department":"99","skills":["test-l4"],
        "availability":["SOIR"],"collaboration_modes":["DISTANCE"],"contribution_types":["IDEE"],
        "bio_visibility":"MEMBERS","location_visibility":"PRIVATE","skills_visibility":"PRIVATE","availability_visibility":"MEMBERS"})
    check("Propriétaire : enregistre ses champs et visibilités",r.status_code==204,r.text)
    # Membre lambda (non Bureau)
    r=sel(V_TOK,f"profiles?id=eq.{M}&select=bio")
    check("Autre membre : lecture directe de la présentation refusée",r.status_code in (401,403) or "permission denied" in r.text,r.text)
    for col in ["city","skills","availability","department"]:
        r=sel(V_TOK,f"profiles?id=eq.{M}&select={col}")
        check(f"Autre membre : lecture directe de {col} refusée","permission denied" in r.text,r.text)
    r=sel(V_TOK,f"profiles?id=eq.{M}&select=display_name")
    check("Autre membre : nom affiché lisible (fiche listée)",r.status_code==200 and len(r.json())==1,r.text)
    view=rpc(V_TOK,"directory_profiles",{"_ids":[M]}).json()
    check("Annuaire (membre) : fiche présente",len(view)==1,view)
    v=view[0] if view else {}
    check("Annuaire (membre) : présentation visible (Membres)",v.get("bio")=="TEST-L4 présentation",v)
    check("Annuaire (membre) : ville et département masqués (Moi et le Bureau)",v.get("city") is None and v.get("department") is None,v)
    check("Annuaire (membre) : compétences masquées",v.get("skills")==[],v)
    check("Annuaire (membre) : disponibilités visibles",v.get("availability")==["SOIR"] and v.get("collaboration_modes")==["DISTANCE"] and v.get("contribution_types")==["IDEE"],v)
    check("Annuaire : aucun e-mail ni téléphone dans la projection","email" not in v and "phone" not in v,v)
    check("Autre membre : détails privés refusés",rpc(V_TOK,"profile_details",{"_ids":[M]}).json()==[])
    check("Autre membre : coordonnées refusées",rpc(V_TOK,"profile_contacts",{"_ids":[M]}).json()==[])
    patch(V_TOK,M,{"bio":"piratage"})
    check("Autre membre : ne peut pas modifier la fiche",rpc(B_TOK,"profile_details",{"_ids":[M]}).json()[0]["bio"]=="TEST-L4 présentation")
    peek=rpc(V_TOK,"entity_peek",{"_type":"person","_id":M}).json()
    check("Fiche contextuelle : ville masquée",isinstance(peek,dict) and peek.get("subtitle") is None,peek)
    gs=rpc(V_TOK,"global_search",{"_term":"Testville"}).json()
    check("Recherche : la ville privée ne permet pas de trouver la personne",not any(x["id"]==M for x in gs),gs)
    # Aperçu du propriétaire = vue membre
    mine=rpc(M_TOK,"directory_profiles",{"_ids":[M],"_as_member":True}).json()
    check("Aperçu du propriétaire identique à la vue d'un autre membre",mine==view,(mine,view))
    full=rpc(M_TOK,"profile_details",{"_ids":[M]}).json()
    check("Propriétaire : lit tous ses détails",full and full[0]["city"]=="Testville" and full[0]["skills"]==["test-l4"],full)
    # Bureau
    bv=rpc(B_TOK,"directory_profiles",{"_ids":[M]}).json()
    check("Bureau : annuaire complet",bv and bv[0]["city"]=="Testville" and bv[0]["skills"]==["test-l4"],bv)
    bm=rpc(B_TOK,"directory_profiles",{"_ids":[M],"_as_member":True}).json()
    check("Bureau en vue membre : mêmes masques qu'un membre",bm==view,(bm,view))
    check("Bureau : détails via profile_details",rpc(B_TOK,"profile_details",{"_ids":[M]}).json()[0]["city"]=="Testville")
    # Valeurs refusées
    r=patch(M_TOK,M,{"availability":["NUIT"]}); check("Valeur de disponibilité inconnue refusée",r.status_code>=400,r.text)
    r=patch(M_TOK,M,{"bio_visibility":"PUBLIC"}); check("Visibilité « publique » refusée (pas de lien public)",r.status_code>=400,r.text)
    r=patch(M_TOK,M,{"avatar_path":f"{B}/x.png"}); check("Photo pointant vers le dossier d'un autre refusée",r.status_code>=400,r.text)
    # Photos
    png=bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5f0000000049454e44ae426082")
    up=requests.post(f"{URL}/storage/v1/object/avatars/{M}/test-l4.png",data=png,headers={"apikey":KEY,"Authorization":f"Bearer {M_TOK}","Content-Type":"image/png"})
    check("Photo : dépôt dans son dossier",up.status_code==200,up.text)
    bad=requests.post(f"{URL}/storage/v1/object/avatars/{B}/intrus.png",data=png,headers={"apikey":KEY,"Authorization":f"Bearer {M_TOK}","Content-Type":"image/png"})
    check("Photo : dépôt dans le dossier d'un autre refusé",bad.status_code>=400,bad.text)
    sign=lambda tok: requests.post(f"{URL}/storage/v1/object/sign/avatars/{M}/test-l4.png",json={"expiresIn":60},headers={"apikey":KEY,"Authorization":f"Bearer {tok}","Content-Type":"application/json"})
    check("Photo : visible par un membre quand la fiche est listée",sign(V_TOK).status_code==200,sign(V_TOK).text)
    anon_sign=requests.post(f"{URL}/storage/v1/object/sign/avatars/{M}/test-l4.png",json={"expiresIn":60},headers={"apikey":KEY,"Content-Type":"application/json"})
    check("Photo : invisible pour un visiteur non connecté",anon_sign.status_code>=400,anon_sign.text)
    # Fiche retirée de l'annuaire
    patch(M_TOK,M,{"public_visibility":False})
    check("Retrait de l'annuaire : la fiche disparaît pour les membres",rpc(V_TOK,"directory_profiles",{"_ids":[M]}).json()==[])
    check("Retrait de l'annuaire : aperçu vide aussi",rpc(M_TOK,"directory_profiles",{"_ids":[M],"_as_member":True}).json()==[])
    check("Retrait de l'annuaire : photo invisible pour les membres",sign(V_TOK).status_code>=400,sign(V_TOK).text)
    check("Retrait de l'annuaire : photo visible par le Bureau",sign(B_TOK).status_code==200)
    check("Retrait de l'annuaire : fiche contextuelle fermée",rpc(V_TOK,"entity_peek",{"_type":"person","_id":M}).json() is None)
    # Anonyme
    check("Anonyme : annuaire refusé",rpc(None,"directory_profiles",{}).status_code in (401,403,404))
    check("Anonyme : table des profils refusée",sel(None,"profiles?select=id").status_code in (401,403))
    check("Anonyme : ancienne vue public_professionals refusée",sel(None,"public_professionals?select=id").status_code in (401,403))
    check("Membre : ancienne vue public_professionals refusée",sel(V_TOK,"public_professionals?select=id").status_code in (401,403))
    # Compatibilité « Je veux aider »
    r=patch(M_TOK,M,{"skills":["test-l4","couture"]})
    check("« Je veux aider » : enregistrement des compétences inchangé",r.status_code==204 and rpc(M_TOK,"profile_details",{"_ids":[M]}).json()[0]["skills"]==["test-l4","couture"],r.text)
finally:
    requests.delete(f"{URL}/storage/v1/object/avatars/{M}/test-l4.png",headers={"apikey":KEY,"Authorization":f"Bearer {M_TOK}"})
    restore={k:orig[k] for k in ["bio","city","department","skills","availability","collaboration_modes","contribution_types","bio_visibility","location_visibility","skills_visibility","availability_visibility"]}
    restore["public_visibility"]=orig_pv["public_visibility"]
    r=patch(M_TOK,M,restore); print("restauration:",r.status_code)
    after=rpc(B_TOK,"profile_details",{"_ids":[M]}).json()[0]
    print("restauré à l'identique:",after==orig)
print(f"\n{sum(ok for _,ok in results)}/{len(results)} contrôles réussis")
