const api = {
  list: () => fetch('/api/requirements').then(r => r.json()),
  get: id => fetch(`/api/requirements/${id}`).then(r => r.json()),
  create: data => fetch('/api/requirements', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)}).then(r => r.json()),
  update: (id, data) => fetch(`/api/requirements/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)}).then(r => r.json()),
  remove: id => fetch(`/api/requirements/${id}`, { method: 'DELETE' }).then(r => r.json())
};

const els = {
  items: document.getElementById('items'),
  title: document.getElementById('title'),
  description: document.getElementById('description'),
  assignee: document.getElementById('assignee'),
  status: document.getElementById('status'),
  save: document.getElementById('save'),
  cancel: document.getElementById('cancel'),
  reqId: document.getElementById('req-id'),
  formTitle: document.getElementById('form-title')
};

function renderList(items){
  els.items.innerHTML = '';
  if(!items || items.length === 0){ els.items.innerHTML = '<p>No requirements yet.</p>'; return; }
  items.forEach(it => {
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <h3>${escapeHtml(it.title)}</h3>
      <p class="meta">Status: ${escapeHtml(it.status)} — Assignee: ${escapeHtml(it.assignee||'—')}</p>
      <p>${escapeHtml(it.description||'')}</p>
      <div class="actions">
        <button data-id="${it.id}" class="edit">Edit</button>
        <button data-id="${it.id}" class="delete">Delete</button>
      </div>
    `;
    els.items.appendChild(card);
  });
}

function load(){
  api.list().then(renderList).catch(err=>{ els.items.innerHTML = '<p>Error loading list.</p>' });
}

function clearForm(){
  els.reqId.value = '';
  els.title.value = '';
  els.description.value = '';
  els.assignee.value = '';
  els.status.value = 'Open';
  els.formTitle.textContent = 'Create Requirement';
}

els.save.addEventListener('click', ()=>{
  const payload = { title: els.title.value.trim(), description: els.description.value.trim(), assignee: els.assignee.value.trim(), status: els.status.value };
  const id = els.reqId.value;
  if(!payload.title){ alert('Title required'); return; }
  if(id){
    api.update(id, payload).then(()=>{ clearForm(); load(); });
  } else {
    api.create(payload).then(()=>{ clearForm(); load(); });
  }
});

els.cancel.addEventListener('click', clearForm);

els.items.addEventListener('click', (e)=>{
  if(e.target.classList.contains('edit')){
    const id = e.target.dataset.id;
    api.get(id).then(it=>{
      els.reqId.value = it.id;
      els.title.value = it.title;
      els.description.value = it.description || '';
      els.assignee.value = it.assignee || '';
      els.status.value = it.status || 'Open';
      els.formTitle.textContent = 'Edit Requirement';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  if(e.target.classList.contains('delete')){
    const id = e.target.dataset.id;
    if(confirm('Delete this requirement?')) api.remove(id).then(()=>load());
  }
});

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]); }

load();
