(() => {
  const read = k => {try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
  const el = id => document.getElementById(id);
  const text = (tag,value) => {const e=document.createElement(tag);e.textContent=value;return e};
  const home=read('lvdc.public.home');
  if(home){
    el('saved').textContent='Copie sauvegardée le '+new Date(home.savedAt).toLocaleString('fr-FR');
    const now=new Date();
    const items=(home.activities||[]).filter(a=>{const d=new Date(a.date);return d>=now&&d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()});
    el('activities-empty').hidden=items.length>0;
    for(const a of items){const card=document.createElement('article');card.append(text('h3',a.title),text('p',new Date(a.date).toLocaleDateString('fr-FR')),text('p',a.location||''));el('activities').append(card)}
    try{const u=new URL(home.website);if(['http:','https:'].includes(u.protocol)){el('website').href=u.href;el('website').hidden=false}}catch{}
  }
  const pros=read('lvdc.public.pros')||[];
  el('partners-section').hidden=!pros.length;
  for(const p of pros){const c=document.createElement('article');c.append(text('h3',p.display_name),text('p',(p.specialties||[]).join(' · ')),text('p',p.public_city||''));el('partners').append(c)}
  // Session identifies the local account only. It NEVER authorizes a server action.
  const authKey=Object.keys(localStorage).find(k=>/^sb-.*-auth-token$/.test(k));
  const session=read(authKey);const owner=session?.user?.id;
  const pass=read('lvdc.offline.pass');
  if(owner&&pass?.owner===owner){el('pass-section').hidden=false;el('show-pass').onclick=()=>{el('pass').replaceChildren();const qr=document.createElement('img');qr.src=pass.qr;qr.alt='QR code de mon pass';qr.width=220;qr.height=220;el('pass').append(text('p',pass.name),qr,text('p',`${pass.total} tampon(s) confirmés lors de la sauvegarde`),text('p','Dernière mise à jour : '+new Date(pass.savedAt).toLocaleString('fr-FR')));el('pass').hidden=false}}
  const options=owner&&read(`lvdc.offline.options.${owner}`);const queueKey=`lvdc.offline.stamps.${owner}`;
  const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(options){el('stamp-section').hidden=false;el('sync-link').hidden=false;
    for(const [id,items] of [['member',options.members],['bureau',options.bureau]]){el(id).append(new Option('Choisir…',''));for(const i of items)el(id).append(new Option(i.name,i.id))}
    const status=()=>{el('queue-status').textContent=`${(read(queueKey)||[]).length} demande(s) en attente de validation serveur.`};status();
    el('stamp-form').onsubmit=e=>{e.preventDefault();const q=read(queueKey)||[];const member=el('member').value;if(q.some(i=>i.member===member&&i.day===day())){el('queue-status').textContent='Une demande existe déjà pour cette personne aujourd’hui.';return}try{q.push({id:crypto.randomUUID(),owner,member,bureau:el('bureau').value,reason:el('reason').value.trim(),day:day(),state:'pending'});localStorage.setItem(queueKey,JSON.stringify(q));el('reason').value='';status()}catch{el('queue-status').textContent='Sauvegarde impossible sur ce téléphone. La demande n’est pas enregistrée.'}};
  }
  el('clear').onclick=()=>{if(!confirm('Effacer le pass et les demandes locales non synchronisées ? Les tampons confirmés sur le serveur sont conservés.'))return;for(const k of Object.keys(localStorage))if(k.startsWith('lvdc.offline.'))localStorage.removeItem(k);location.reload()};
})();