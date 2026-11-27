"""Read-only real API regression checks using explicitly identified beta sessions."""
import json
import os
import re
from pathlib import Path
import requests

root = Path(__file__).resolve().parents[2]
config = (root / '.env').read_text()
url_match = re.search(r'VITE_SUPABASE_URL="?([^"\n]+)', config)
key_match = re.search(r'VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\n]+)', config)
assert url_match and key_match
url, key = url_match.group(1), key_match.group(1)
identities = [
    ('LVDC_PARTICULIER_SESSION', 'b13acd7b-83e8-4dae-9fa9-ede27d7c9049', 'associationlavoixduchien+essai-particulier@gmail.com'),
    ('LVDC_PRO_SESSION', '0cd07ca1-1d78-4576-87cf-995eb07fda38', 'associationlavoixduchien+essai-pro@gmail.com'),
]
checks = 0
for variable, me, email in identities:
    session = json.loads(Path(os.environ[variable]).read_text())['session']
    assert session['user']['id'] == me and session['user']['email'] == email, 'Beta accounts only'
    headers = {'apikey': key, 'Authorization': 'Bearer ' + session['access_token']}
    other = identities[1 if variable == 'LVDC_PARTICULIER_SESSION' else 0][1]
    for name in ['can_manage_dog', 'can_view_dog_operational']:
        response = requests.post(url + '/rest/v1/rpc/' + name, headers=headers,
                                 json={'_user_id': other, '_dog_id': '11111111-1111-4111-8111-111111111111'}, timeout=30)
        assert response.status_code == 200 and response.json() is False, name
        checks += 1
    response = requests.post(url + '/rest/v1/rpc/can_receive_stamps', headers=headers, json={'_user_id': other}, timeout=30)
    assert response.status_code == 200
    assert response.json() is (variable == 'LVDC_PRO_SESSION'), 'Only a validator may check another member'
    checks += 1
    response = requests.post(url + '/rest/v1/rpc/add_task_rex', headers=headers,
                             json={'_task_id': '11111111-1111-4111-8111-111111111111', '_field': 'rex_successes; DELETE', '_note': 'security note'}, timeout=30)
    assert response.status_code >= 400, 'Reject command-shaped field'
    checks += 1
    response = requests.post(url + '/storage/v1/object/list/blog-media', headers=headers,
                             json={'prefix': '', 'limit': 100}, timeout=30)
    assert response.status_code == 200 and response.json() == [], 'No foreign files listed'
    checks += 1
    print('PASS: beta profile helper, pass, return and storage checks')
print(f'{checks}/{checks} selected read-only API checks passed')