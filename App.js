// ===== BUYTRIP PRO - APP.JS =====
// Claude OCR + Supabase + Bilingual ES/EN

// ============================
// CONFIG — FILL YOUR KEYS HERE
// ============================
const CONFIG = {
SUPABASE_URL: ‘YOUR_SUPABASE_URL’,       // e.g. https://xyzxyz.supabase.co
SUPABASE_ANON_KEY: ‘YOUR_SUPABASE_ANON_KEY’,
CLAUDE_API_KEY: ‘YOUR_CLAUDE_API_KEY’,   // Anthropic API key
};

// ============================
// STATE
// ============================
let state = {
lang: ‘es’,
user: null,          // { name, team }
visits: [],
suppliers: [],
products: [],
activeVisit: null,
currentSupplier: null,
currentProduct: null,
currentProductPhoto: null,    // base64
currentSupplierCardPhoto: null, // base64
pendingSupplierIdForProduct: null,
isRecording: false,
mediaRecorder: null,
audioChunks: [],
voiceBlob: null,
supabase: null,
syncing: false,
};

// ============================
// INIT
// ============================
window.addEventListener(‘DOMContentLoaded’, async () => {
// Load local state
loadLocalState();

// Init Supabase if configured
if (CONFIG.SUPABASE_URL !== ‘YOUR_SUPABASE_URL’) {
initSupabase();
}

// Wait for splash
setTimeout(() => {
document.getElementById(‘splash’).classList.add(‘hidden’);
// Check login
if (state.user) {
showApp();
} else {
document.getElementById(‘screen-login’).classList.remove(‘hidden’);
}
applyLang();
}, 1500);
});

function loadLocalState() {
try {
const saved = localStorage.getItem(‘buytrip_state’);
if (saved) {
const parsed = JSON.parse(saved);
state.user = parsed.user || null;
state.visits = parsed.visits || [];
state.suppliers = parsed.suppliers || [];
state.products = parsed.products || [];
state.activeVisit = parsed.activeVisit || null;
state.lang = parsed.lang || ‘es’;
}
} catch(e) { console.error(‘Load state error’, e); }
}

function saveLocalState() {
try {
localStorage.setItem(‘buytrip_state’, JSON.stringify({
user: state.user,
visits: state.visits,
suppliers: state.suppliers,
products: state.products,
activeVisit: state.activeVisit,
lang: state.lang,
}));
} catch(e) { console.error(‘Save state error’, e); }
}

// ============================
// SUPABASE
// ============================
function initSupabase() {
// Supabase JS is loaded via CDN in a real setup
// For now, we use REST API directly
console.log(‘Supabase initialized’);
}

async function syncData() {
if (state.syncing) return;
if (CONFIG.SUPABASE_URL === ‘YOUR_SUPABASE_URL’) {
showToast(‘⚠️ Configura Supabase en CONFIG’, ‘error’);
return;
}
state.syncing = true;
document.getElementById(‘sync-btn’).classList.add(‘syncing’);
showToast(‘Sincronizando…’);

try {
// Push local data to Supabase
await pushToSupabase(‘visits’, state.visits);
await pushToSupabase(‘suppliers’, state.suppliers);
await pushToSupabase(‘products’, state.products);

```
// Pull from Supabase (team data)
await pullFromSupabase();

saveLocalState();
showToast('✓ Sincronizado', 'success');
```

} catch(e) {
showToast(‘Error de sincronización’, ‘error’);
} finally {
state.syncing = false;
document.getElementById(‘sync-btn’).classList.remove(‘syncing’);
}
}

async function pushToSupabase(table, records) {
if (!records.length) return;
const filtered = records.filter(r => r.team === state.user.team);
if (!filtered.length) return;

const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
method: ‘POST’,
headers: {
‘apikey’: CONFIG.SUPABASE_ANON_KEY,
‘Authorization’: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
‘Content-Type’: ‘application/json’,
‘Prefer’: ‘resolution=merge-duplicates’,
},
body: JSON.stringify(filtered.map(r => ({…r, image: undefined}))), // don’t push images to DB
});
if (!res.ok) throw new Error(`Supabase push error: ${res.status}`);
}

async function pullFromSupabase() {
const tables = [‘visits’, ‘suppliers’, ‘products’];
for (const table of tables) {
const res = await fetch(
`${CONFIG.SUPABASE_URL}/rest/v1/${table}?team=eq.${state.user.team}&select=*`,
{
headers: {
‘apikey’: CONFIG.SUPABASE_ANON_KEY,
‘Authorization’: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
}
}
);
if (!res.ok) continue;
const remote = await res.json();

```
// Merge: keep local images, update other fields
const merged = [...state[table]];
for (const remoteItem of remote) {
  const local = merged.find(l => l.id === remoteItem.id);
  if (local) {
    Object.assign(local, {...remoteItem, image: local.image}); // keep local image
  } else {
    merged.push(remoteItem);
  }
}
state[table] = merged;
```

}
}

// ============================
// LOGIN
// ============================
function doLogin() {
const name = document.getElementById(‘login-name’).value.trim();
const team = document.getElementById(‘login-team’).value.trim().toUpperCase();

if (!name) { showToast(‘Ingresa tu nombre’, ‘error’); return; }
if (!team) { showToast(‘Ingresa el código de equipo’, ‘error’); return; }

state.user = { name, team, initials: name.substring(0,2).toUpperCase() };
saveLocalState();
document.getElementById(‘screen-login’).classList.add(‘hidden’);
showApp();
}

function showApp() {
document.getElementById(‘app’).classList.remove(‘hidden’);
document.getElementById(‘user-badge’).textContent = state.user.initials;
updateStats();
renderHome();
navigate(‘home’);
applyLang();
}

// ============================
// NAVIGATION
// ============================
const SCREEN_MAP = {
home: ‘screen-home’,
visits: ‘screen-visits’,
suppliers: ‘screen-suppliers’,
products: ‘screen-products’,
export: ‘screen-export’,
‘supplier-detail’: ‘screen-supplier-detail’,
‘product-detail’: ‘screen-product-detail’,
};

const NAV_TITLES = {
home: { es: ‘Inicio’, en: ‘Home’ },
visits: { es: ‘Visitas’, en: ‘Visits’ },
suppliers: { es: ‘Proveedores’, en: ‘Suppliers’ },
products: { es: ‘Productos’, en: ‘Products’ },
export: { es: ‘Exportar’, en: ‘Export’ },
‘supplier-detail’: { es: ‘Proveedor’, en: ‘Supplier’ },
‘product-detail’: { es: ‘Producto’, en: ‘Product’ },
};

function navigate(screen, options={}) {
// Hide all
Object.values(SCREEN_MAP).forEach(id => {
document.getElementById(id)?.classList.remove(‘active’);
});

// Show target
const target = document.getElementById(SCREEN_MAP[screen]);
if (target) target.classList.add(‘active’);

// Update topbar
const titles = NAV_TITLES[screen] || {es:‘BuyTrip’,en:‘BuyTrip’};
document.getElementById(‘topbar-title’).textContent = titles[state.lang];

// Update bottom nav
document.querySelectorAll(’.nav-btn’).forEach(b => b.classList.remove(‘active’));
const navId = `nav-${screen}`;
document.getElementById(navId)?.classList.add(‘active’);

// Screen-specific renders
if (screen === ‘home’) renderHome();
else if (screen === ‘visits’) renderVisits();
else if (screen === ‘suppliers’) renderSuppliers();
else if (screen === ‘products’) renderProducts();
else if (screen === ‘export’) renderExport();
else if (screen === ‘supplier-detail’ && options.supplierId) {
renderSupplierDetail(options.supplierId);
} else if (screen === ‘product-detail’ && options.productId) {
renderProductDetail(options.productId);
}
}

// ============================
// HOME
// ============================
function renderHome() {
// Greeting
const hour = new Date().getHours();
const greetings = {
es: hour < 12 ? ‘Buenos días,’ : hour < 18 ? ‘Buenas tardes,’ : ‘Buenas noches,’,
en: hour < 12 ? ‘Good morning,’ : hour < 18 ? ‘Good afternoon,’ : ‘Good evening,’,
};
document.getElementById(‘home-greeting’).textContent = `${greetings[state.lang]} ${state.user?.name || ''}`;

// Date
const now = new Date();
document.getElementById(‘home-date’).textContent = now.toLocaleDateString(
state.lang === ‘es’ ? ‘es-ES’ : ‘en-US’,
{ weekday:‘long’, year:‘numeric’, month:‘long’, day:‘numeric’ }
).toUpperCase();

updateStats();

// Active visit card
const avCard = document.getElementById(‘active-visit-card’);
if (state.activeVisit) {
const visit = state.visits.find(v => v.id === state.activeVisit);
if (visit) {
const suppCount = state.suppliers.filter(s => s.visitId === visit.id).length;
const prodCount = state.products.filter(p => p.visitId === visit.id).length;
avCard.outerHTML = `<div class="active-visit-card" id="active-visit-card" onclick="navigate('visits')"> <div style="display:flex;justify-content:space-between;align-items:start"> <div> <div style="font-family:var(--font-display);font-size:17px;font-weight:700">${escHtml(visit.name)}</div> <div style="font-size:12px;color:var(--text2);margin-top:2px">📍 ${escHtml(visit.city)}</div> </div> <span class="visit-badge">ACTIVA</span> </div> <div style="display:flex;gap:16px;margin-top:12px"> <div style="font-family:var(--font-mono);font-size:12px;color:var(--text2)">🏪 <b style="color:var(--accent)">${suppCount}</b> proveedores</div> <div style="font-family:var(--font-mono);font-size:12px;color:var(--text2)">📦 <b style="color:var(--accent)">${prodCount}</b> productos</div> </div> </div>`;
}
}

// Recent products
const recent = […state.products].sort((a,b) => b.createdAt - a.createdAt).slice(0,5);
const container = document.getElementById(‘recent-products-list’);
if (!container) return;
if (!recent.length) {
container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div>${state.lang==='es'?'Sin productos aún':'No products yet'}</div></div>`;
return;
}
container.innerHTML = recent.map(p => productCardHTML(p)).join(’’);
}

function updateStats() {
const myVisits = state.visits.filter(v => v.team === state.user?.team);
const mySuppliers = state.suppliers.filter(s => s.team === state.user?.team);
const myProducts = state.products.filter(p => p.team === state.user?.team);
document.getElementById(‘stat-visits’).textContent = myVisits.length;
document.getElementById(‘stat-suppliers’).textContent = mySuppliers.length;
document.getElementById(‘stat-products’).textContent = myProducts.length;
}

// ============================
// VISITS
// ============================
function renderVisits() {
const list = document.getElementById(‘visits-list’);
const myVisits = state.visits.filter(v => v.team === state.user.team)
.sort((a,b) => b.createdAt - a.createdAt);

if (!myVisits.length) {
list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div> <div>${state.lang==='es'?'No hay visitas':'No visits yet'}</div> <p>${state.lang==='es'?'Crea tu primera visita':'Create your first visit'}</p></div>`;
return;
}

list.innerHTML = myVisits.map(v => {
const sCount = state.suppliers.filter(s => s.visitId === v.id).length;
const pCount = state.products.filter(p => p.visitId === v.id).length;
const isActive = state.activeVisit === v.id;
return `<div class="visit-item ${isActive ? 'active-visit' : ''}" onclick="selectVisit('${v.id}')"> <div class="item-icon">📋</div> <div class="item-info"> <div class="item-name">${escHtml(v.name)}${isActive ? '<span class="visit-badge">ACTIVA</span>' : ''}</div> <div class="item-sub">📍 ${escHtml(v.city)} · ${escHtml(v.market||'')}</div> <div class="item-meta">${new Date(v.createdAt).toLocaleDateString()} · ${sCount} proveedores · ${pCount} productos</div> </div> <div class="item-arrow">›</div> </div>`;
}).join(’’);
}

function showNewVisitModal() {
document.getElementById(‘modal-visit’).classList.remove(‘hidden’);
}

function createVisit() {
const name = document.getElementById(‘v-name’).value.trim();
if (!name) { showToast(‘Ingresa un nombre’, ‘error’); return; }

const visit = {
id: genId(),
team: state.user.team,
createdBy: state.user.name,
name,
city: document.getElementById(‘v-city’).value,
market: document.getElementById(‘v-market’).value.trim(),
notes: document.getElementById(‘v-notes’).value.trim(),
date: new Date().toISOString().split(‘T’)[0],
createdAt: Date.now(),
};

state.visits.push(visit);
state.activeVisit = visit.id;
saveLocalState();
closeModal(‘modal-visit’);
showToast(‘✓ Visita creada’, ‘success’);
renderVisits();
updateStats();
renderHome();

// Clear form
[‘v-name’,‘v-market’,‘v-notes’].forEach(id => { document.getElementById(id).value = ‘’; });
}

function selectVisit(id) {
state.activeVisit = id;
saveLocalState();
renderVisits();
renderHome();
showToast(‘✓ Visita activada’, ‘success’);
}

// ============================
// SUPPLIERS
// ============================
function renderSuppliers(filter=’’) {
const list = document.getElementById(‘suppliers-list’);
let suppliers = state.suppliers.filter(s => s.team === state.user.team);
if (filter) {
const f = filter.toLowerCase();
suppliers = suppliers.filter(s =>
s.name.toLowerCase().includes(f) ||
(s.booth||’’).toLowerCase().includes(f) ||
(s.category||’’).toLowerCase().includes(f)
);
}
suppliers.sort((a,b) => b.createdAt - a.createdAt);

if (!suppliers.length) {
list.innerHTML = `<div class="empty-state"><div class="empty-icon">🏪</div> <div>${state.lang==='es'?'Sin proveedores':'No suppliers yet'}</div> <p>${state.lang==='es'?'Agrega tu primer proveedor':'Add your first supplier'}</p></div>`;
return;
}

list.innerHTML = suppliers.map(s => {
const pCount = state.products.filter(p => p.supplierId === s.id).length;
const stars = ‘⭐’.repeat(s.rating||0);
return `<div class="supplier-item" onclick="openSupplierDetail('${s.id}')"> ${s.image ? `<div class="item-icon" style="width:48px;height:48px;overflow:hidden;border-radius:8px;flex-shrink:0">
<img src="${s.image}" style="width:100%;height:100%;object-fit:cover"></div>`:`<div class="item-icon">🏪</div>`} <div class="item-info"> <div class="item-name">${escHtml(s.name||'Sin nombre')}</div> <div class="item-sub">${escHtml(s.booth||'')} ${s.category ? '· '+escHtml(s.category) : ''}</div> <div class="item-meta">${stars || '·'} ${escHtml(s.contact||'')} ${s.wechat ? '· WeChat: '+escHtml(s.wechat) : ''}</div> </div> <div class="item-count">${pCount}</div> <div class="item-arrow">›</div> </div>`;
}).join(’’);
}

function filterSuppliers(val) { renderSuppliers(val); }

function showNewSupplierModal() {
// Reset form
[‘s-name’,‘s-booth’,‘s-contact’,‘s-wechat’,‘s-category’,‘s-notes’].forEach(id => {
document.getElementById(id).value = ‘’;
});
document.getElementById(‘s-rating-val’).value = ‘0’;
updateStarUI(0);
document.getElementById(‘supplier-card-preview’).innerHTML = `<div class="photo-icon">📷</div> <div>${state.lang==='es'?'Foto de tarjeta del proveedor':'Photo of supplier business card'}</div> <small>${state.lang==='es'?'La IA llenará los campos automáticamente':'AI will auto-fill the fields'}</small>`;
state.currentSupplierCardPhoto = null;
document.getElementById(‘modal-supplier’).classList.remove(‘hidden’);
}

function captureSupplierCard() {
document.getElementById(‘file-supplier-card’).click();
}

async function handleSupplierCardFile(input) {
const file = input.files[0];
if (!file) return;

const base64 = await fileToBase64(file);
state.currentSupplierCardPhoto = base64;

// Show preview
document.getElementById(‘supplier-card-preview’).innerHTML =
`<img src="${base64}" class="photo-preview-img" style="max-height:160px;object-fit:contain">`;

// Run OCR
await runSupplierCardOCR(base64);
input.value = ‘’;
}

async function runSupplierCardOCR(base64) {
const statusEl = document.getElementById(‘supplier-ocr-status’);
statusEl.classList.remove(‘hidden’);

try {
const prompt = `Analyze this business card or supplier signage image from a Chinese wholesale market (Futian/Yiwu). Extract the following information and return ONLY a JSON object (no markdown, no explanation): { "name": "company or supplier name", "booth": "booth/stand number or location", "contact": "person name if visible", "wechat": "WeChat ID, phone number, or WhatsApp", "category": "product category or type of goods", "website": "website if visible" } If a field is not visible, use empty string "". Be very accurate with numbers and IDs.`;

```
const result = await callClaudeOCR(base64, prompt);

if (result) {
  if (result.name) document.getElementById('s-name').value = result.name;
  if (result.booth) document.getElementById('s-booth').value = result.booth;
  if (result.contact) document.getElementById('s-contact').value = result.contact;
  if (result.wechat) document.getElementById('s-wechat').value = result.wechat;
  if (result.category) document.getElementById('s-category').value = result.category;
  showToast('✓ Tarjeta analizada', 'success');
}
```

} catch(e) {
console.error(‘Supplier OCR error’, e);
showToast(‘OCR manual - revisa campos’, ‘error’);
} finally {
statusEl.classList.add(‘hidden’);
}
}

function createSupplier() {
const name = document.getElementById(‘s-name’).value.trim();
if (!name) { showToast(‘Ingresa el nombre del proveedor’, ‘error’); return; }

const supplier = {
id: genId(),
team: state.user.team,
visitId: state.activeVisit,
createdBy: state.user.name,
name,
booth: document.getElementById(‘s-booth’).value.trim(),
contact: document.getElementById(‘s-contact’).value.trim(),
wechat: document.getElementById(‘s-wechat’).value.trim(),
category: document.getElementById(‘s-category’).value.trim(),
notes: document.getElementById(‘s-notes’).value.trim(),
rating: parseInt(document.getElementById(‘s-rating-val’).value)||0,
image: state.currentSupplierCardPhoto || null,
createdAt: Date.now(),
};

state.suppliers.push(supplier);
state.currentSupplierCardPhoto = null;
saveLocalState();
closeModal(‘modal-supplier’);
showToast(‘✓ Proveedor creado’, ‘success’);

// Navigate to supplier detail
navigate(‘supplier-detail’, { supplierId: supplier.id });
updateStats();
}

function openSupplierDetail(id) {
state.currentSupplier = id;
navigate(‘supplier-detail’, { supplierId: id });
}

function renderSupplierDetail(supplierId) {
const supplier = state.suppliers.find(s => s.id === supplierId);
if (!supplier) return;

state.currentSupplier = supplierId;
document.getElementById(‘supplier-detail-title’).textContent = supplier.name || ‘Proveedor’;

const products = state.products.filter(p => p.supplierId === supplierId)
.sort((a,b) => b.createdAt - a.createdAt);

const stars = ‘⭐’.repeat(supplier.rating||0) || ‘—’;

document.getElementById(‘supplier-detail-content’).innerHTML = `<div class="supplier-header-card"> <div class="supplier-photo" onclick="changeSupplierPhoto('${supplierId}')"> ${supplier.image  ?`<img src="${supplier.image}" alt="supplier">` : '🏪'} ${supplier.image ? '' :`<div style="font-size:13px;color:var(--text3);margin-top:8px">${state.lang===‘es’?‘Toca para agregar foto’:‘Tap to add photo’}</div>`} </div> <div class="supplier-info-grid"> <div class="supplier-info-item"> <label>${state.lang==='es'?'Stand':'Booth'}</label> <span>${escHtml(supplier.booth||'—')}</span> </div> <div class="supplier-info-item"> <label>${state.lang==='es'?'Contacto':'Contact'}</label> <span>${escHtml(supplier.contact||'—')}</span> </div> <div class="supplier-info-item"> <label>WeChat</label> <span>${escHtml(supplier.wechat||'—')}</span> </div> <div class="supplier-info-item"> <label>${state.lang==='es'?'Categoría':'Category'}</label> <span>${escHtml(supplier.category||'—')}</span> </div> <div class="supplier-info-item"> <label>${state.lang==='es'?'Calificación':'Rating'}</label> <span>${stars}</span> </div> <div class="supplier-info-item"> <label>Por</label> <span>${escHtml(supplier.createdBy||'—')}</span> </div> ${supplier.notes ? `<div class="supplier-info-item" style="grid-column:1/-1">
<label>Notas</label><span>${escHtml(supplier.notes)}</span></div>` : ‘’}
</div>
</div>

```
<div class="supplier-products-header">
  <h3>${state.lang==='es'?'Productos':'Products'} (${products.length})</h3>
  <button class="add-btn" onclick="addProductToCurrentSupplier()">📷</button>
</div>

<div style="display:flex;flex-direction:column;gap:10px">
  ${products.length 
    ? products.map(p => productCardHTML(p)).join('')
    : `<div class="empty-state"><div class="empty-icon">📦</div>
       <div>${state.lang==='es'?'Sin productos':'No products yet'}</div>
       <p>${state.lang==='es'?'Toca 📷 para agregar':'Tap 📷 to add'}</p></div>`}
</div>
```

`;
}

function addProductToCurrentSupplier() {
state.pendingSupplierIdForProduct = state.currentSupplier;
showProductCapture();
}

// ============================
// PRODUCTS
// ============================
function productCardHTML(product) {
const statusClass = `status-${product.status||'pending'}`;
const priorityClass = `priority-${product.priority||'medium'}`;
const statusLabel = { pending:‘Pendiente’, approved:‘Aprobado’, discarded:‘Descartado’ };
const priorityLabel = { high:‘Alta’, medium:‘Media’, low:‘Baja’ };

return `<div class="product-card ${statusClass} ${priorityClass}" onclick="openProductDetail('${product.id}')"> <div class="product-thumb"> ${product.image  ? `<img src="${product.image}" alt="product">`: '📦'} </div> <div class="product-info"> <div class="product-name">${escHtml(product.description||'Sin descripción')}</div> ${product.model ?`<div class="product-model">${escHtml(product.model)}</div>`: ''} <div class="product-price"> ¥${product.priceNegotiated||product.price||'—'} ${product.price && product.priceNegotiated && product.price !== product.priceNegotiated ?`<span class="original">¥${product.price}</span>`: ''} </div> <div class="product-tags"> <span class="tag tag-${product.status||'pending'}">${statusLabel[product.status||'pending']}</span> <span class="tag tag-${product.priority||'medium'}">${priorityLabel[product.priority||'medium']}</span> ${product.moq ?`<span class="tag" style="background:var(--bg3);color:var(--text2)">MOQ ${product.moq}</span>` : ‘’}
</div>
</div>

  </div>`;
}

function renderProducts(filter=‘all’) {
const list = document.getElementById(‘products-list’);
let products = state.products.filter(p => p.team === state.user.team);

if (filter === ‘approved’) products = products.filter(p => p.status === ‘approved’);
else if (filter === ‘pending’) products = products.filter(p => p.status === ‘pending’);
else if (filter === ‘high’) products = products.filter(p => p.priority === ‘high’);
else if (filter === ‘discarded’) products = products.filter(p => p.status === ‘discarded’);

products.sort((a,b) => b.createdAt - a.createdAt);

if (!products.length) {
list.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div> <div>${state.lang==='es'?'Sin productos':'No products'}</div></div>`;
return;
}
list.innerHTML = products.map(p => productCardHTML(p)).join(’’);
}

function filterProducts(val) { renderProducts(val); }

function showProductCapture() {
// Fill supplier select
const sel = document.getElementById(‘p-supplier-select’);
const suppliers = state.suppliers.filter(s => s.team === state.user.team);
sel.innerHTML = suppliers.map(s =>
`<option value="${s.id}" ${s.id === state.pendingSupplierIdForProduct ? 'selected' : ''}>${escHtml(s.name)}</option>`
).join(’’) || `<option value="">${state.lang==='es'?'Sin proveedores':'No suppliers'}</option>`;

// Reset photo
document.getElementById(‘product-photo-preview’).innerHTML = `<div class="photo-icon big">📷</div> <div>${state.lang==='es'?'Toca para tomar foto':'Tap to take photo'}</div>`;
state.currentProductPhoto = null;
document.getElementById(‘product-ocr-status’).classList.add(‘hidden’);
document.getElementById(‘modal-capture’).classList.remove(‘hidden’);
}

function captureProductPhoto() {
document.getElementById(‘file-product-photo’).click();
}

async function handleProductPhotoFile(input) {
const file = input.files[0];
if (!file) return;

const base64 = await fileToBase64(file);
state.currentProductPhoto = base64;

// Show preview
document.getElementById(‘product-photo-preview’).innerHTML =
`<img src="${base64}" class="photo-preview-img">`;

input.value = ‘’;
}

async function analyzeAndCreate() {
if (!state.currentProductPhoto) {
showToast(state.lang===‘es’?‘Toma una foto primero’:‘Take a photo first’, ‘error’);
return;
}

const supplierId = document.getElementById(‘p-supplier-select’).value;
if (!supplierId) {
showToast(state.lang===‘es’?‘Selecciona un proveedor’:‘Select a supplier’, ‘error’);
return;
}

const statusEl = document.getElementById(‘product-ocr-status’);
statusEl.classList.remove(‘hidden’);
document.getElementById(‘btn-analyze’).disabled = true;

let extractedData = {};
try {
extractedData = await runProductOCR(state.currentProductPhoto);
} catch(e) {
console.error(‘Product OCR error’, e);
} finally {
statusEl.classList.add(‘hidden’);
document.getElementById(‘btn-analyze’).disabled = false;
}

// Create product
const supplier = state.suppliers.find(s => s.id === supplierId);
const product = {
id: genId(),
team: state.user.team,
visitId: state.activeVisit,
supplierId,
supplierName: supplier?.name || ‘’,
createdBy: state.user.name,
image: state.currentProductPhoto,
status: ‘pending’,
priority: ‘medium’,
createdAt: Date.now(),
// OCR fields
description: extractedData.description || ‘’,
model: extractedData.model || ‘’,
price: extractedData.price || ‘’,
priceNegotiated: extractedData.price || ‘’,
moq: extractedData.moq || ‘’,
pcsPerBox: extractedData.pcsPerBox || ‘’,
weight: extractedData.weight || ‘’,
dimensions: extractedData.dimensions || ‘’,
cbm: extractedData.cbm || ‘’,
colors: extractedData.colors || ‘’,
notes: ‘’,
voiceNote: null,
suggestedOrder: ‘’,
};

state.products.push(product);
state.currentProductPhoto = null;
state.pendingSupplierIdForProduct = null;
saveLocalState();
closeModal(‘modal-capture’);
showToast(‘✓ Producto capturado’, ‘success’);
updateStats();

// Go to product detail for editing
openProductDetail(product.id, true);
}

async function runProductOCR(base64) {
const prompt = `You are analyzing a product photo from a Chinese wholesale market (Futian/Yiwu).
The image shows a product and often has handwritten or printed text with pricing and specs nearby.

Extract ALL visible information and return ONLY a valid JSON object (no markdown, no extra text):
{
“description”: “product description in English or Spanish”,
“model”: “model code or product code (e.g. DM5-083)”,
“price”: “price in RMB as number only (e.g. 0.7)”,
“moq”: “minimum order quantity as number only”,
“pcsPerBox”: “pieces per box/carton as number only”,
“weight”: “weight (e.g. 18.2g or 600g/box)”,
“dimensions”: “dimensions if visible”,
“cbm”: “cubic meters if visible (e.g. 0.12)”,
“colors”: “available colors if visible”
}

Common formats you might see:

- “DM5-083 ¥0.7 x864 18.2g 600g/box 24pcs/box 0.12m³”
- Price usually after ¥ or RMB
- MOQ can be written as “x864” meaning 864 pieces minimum
- pcs/box, pieces/carton, or similar
- Weight in g or kg
- CBM as 0.XXm³

If a field is not visible, use empty string “”.`;

return await callClaudeOCR(base64, prompt);
}

async function callClaudeOCR(base64, prompt) {
if (CONFIG.CLAUDE_API_KEY === ‘YOUR_CLAUDE_API_KEY’) {
// Return mock data for demo
console.warn(‘Using mock OCR — add your Claude API key in CONFIG’);
return mockOCRData();
}

// Extract mime type from base64 data URL
const mimeMatch = base64.match(/^data:([^;]+);base64,/);
const mediaType = mimeMatch ? mimeMatch[1] : ‘image/jpeg’;
const imageData = base64.replace(/^data:[^;]+;base64,/, ‘’);

const response = await fetch(‘https://api.anthropic.com/v1/messages’, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘x-api-key’: CONFIG.CLAUDE_API_KEY,
‘anthropic-version’: ‘2023-06-01’,
},
body: JSON.stringify({
model: ‘claude-opus-4-5’,
max_tokens: 1000,
messages: [{
role: ‘user’,
content: [
{ type: ‘image’, source: { type: ‘base64’, media_type: mediaType, data: imageData } },
{ type: ‘text’, text: prompt }
]
}]
})
});

if (!response.ok) {
const err = await response.text();
throw new Error(`Claude API error: ${err}`);
}

const data = await response.json();
const text = data.content[0]?.text || ‘{}’;

try {
const clean = text.replace(/`json|`/g, ‘’).trim();
return JSON.parse(clean);
} catch(e) {
console.error(‘JSON parse error’, text);
return {};
}
}

function mockOCRData() {
const mocks = [
{ description: ‘Plastic pen with metal tip’, model: ‘PEN-2024-A’, price: ‘0.85’, moq: ‘500’, pcsPerBox: ‘100’, weight: ‘12g’, dimensions: ‘14cm’, cbm: ‘0.08’, colors: ‘Blue, Red, Black’ },
{ description: ‘Keychain LED flashlight’, model: ‘LED-KC-003’, price: ‘1.20’, moq: ‘200’, pcsPerBox: ‘50’, weight: ‘35g’, dimensions: ‘8cm’, cbm: ‘0.05’, colors: ‘Silver, Gold’ },
{ description: ‘USB charging cable 1m’, model: ‘USB-C1M-07’, price: ‘2.50’, moq: ‘100’, pcsPerBox: ‘24’, weight: ‘80g’, dimensions: ‘100cm’, cbm: ‘0.02’, colors: ‘White, Black’ },
];
return mocks[Math.floor(Math.random() * mocks.length)];
}

// ============================
// PRODUCT DETAIL
// ============================
function openProductDetail(id, fromCapture=false) {
state.currentProduct = id;
if (fromCapture) {
// Set back button to go to supplier detail or products
document.getElementById(‘product-back-btn’).onclick = () => {
const product = state.products.find(p => p.id === id);
if (product?.supplierId && state.currentSupplier === product.supplierId) {
navigate(‘supplier-detail’, {supplierId: product.supplierId});
} else {
navigate(‘products’);
}
};
}
navigate(‘product-detail’, { productId: id });
}

function renderProductDetail(productId) {
const product = state.products.find(p => p.id === productId);
if (!product) return;

const discount = product.price && product.priceNegotiated
? Math.round((1 - parseFloat(product.priceNegotiated) / parseFloat(product.price)) * 100)
: 0;

document.getElementById(‘product-detail-content’).innerHTML = `<!-- IMAGE --> <div class="product-image-header" onclick="changeProductPhoto('${productId}')"> ${product.image ?`<img src="${product.image}" alt="product">` : ‘📦’}
<div class="change-photo-hint">📷 ${state.lang===‘es’?‘Cambiar’:‘Change’}</div>
</div>

```
<!-- STATUS & PRIORITY -->
<div class="section-divider">${state.lang==='es'?'Estado':'Status'}</div>
<div class="status-selector" id="status-sel-${productId}">
  <button class="status-btn ${product.status==='pending'?'active-pending':''}" onclick="setProductStatus('${productId}','pending')">⏳ ${state.lang==='es'?'Pendiente':'Pending'}</button>
  <button class="status-btn ${product.status==='approved'?'active-approved':''}" onclick="setProductStatus('${productId}','approved')">✓ ${state.lang==='es'?'Aprobado':'Approved'}</button>
  <button class="status-btn ${product.status==='discarded'?'active-discarded':''}" onclick="setProductStatus('${productId}','discarded')">✕ ${state.lang==='es'?'Descartar':'Discard'}</button>
</div>

<div class="section-divider">${state.lang==='es'?'Prioridad':'Priority'}</div>
<div class="priority-selector">
  <button class="priority-btn ${product.priority==='high'?'active-high':''}" onclick="setProductPriority('${productId}','high')">🔴 ${state.lang==='es'?'Alta':'High'}</button>
  <button class="priority-btn ${product.priority==='medium'?'active-medium':''}" onclick="setProductPriority('${productId}','medium')">🟡 ${state.lang==='es'?'Media':'Medium'}</button>
  <button class="priority-btn ${product.priority==='low'?'active-low':''}" onclick="setProductPriority('${productId}','low')">⚪ ${state.lang==='es'?'Baja':'Low'}</button>
</div>

<!-- BASIC INFO -->
<div class="section-divider">${state.lang==='es'?'Información':'Information'}</div>
<div class="field-group">
  <label>${state.lang==='es'?'Descripción':'Description'}</label>
  <input type="text" id="pd-description" value="${escAttr(product.description||'')}" oninput="updateProductField('${productId}','description',this.value)">
</div>
<div class="field-row">
  <div class="field-group">
    <label>${state.lang==='es'?'Modelo / Código':'Model / Code'}</label>
    <input type="text" id="pd-model" value="${escAttr(product.model||'')}" oninput="updateProductField('${productId}','model',this.value)" style="font-family:var(--font-mono)">
  </div>
  <div class="field-group">
    <label>${state.lang==='es'?'Colores':'Colors'}</label>
    <input type="text" id="pd-colors" value="${escAttr(product.colors||'')}" oninput="updateProductField('${productId}','colors',this.value)">
  </div>
</div>

<!-- PRICING -->
<div class="section-divider">${state.lang==='es'?'Precios':'Pricing'}</div>
<div class="price-block">
  <div class="field-row">
    <div class="field-group">
      <label>${state.lang==='es'?'Precio Original (¥)':'Original Price (¥)'}</label>
      <input type="number" id="pd-price" value="${escAttr(product.price||'')}" step="0.01" 
        oninput="updateProductField('${productId}','price',this.value);recalcDiscount('${productId}')">
    </div>
    <div class="field-group">
      <label>${state.lang==='es'?'Precio Negociado (¥)':'Negotiated Price (¥)'}</label>
      <input type="number" id="pd-priceNeg" value="${escAttr(product.priceNegotiated||'')}" step="0.01"
        oninput="updateProductField('${productId}','priceNegotiated',this.value);recalcDiscount('${productId}')">
    </div>
  </div>
  <div id="discount-badge-${productId}">
    ${discount > 0 ? `<span class="discount-badge">-${discount}% descuento</span>` : ''}
  </div>
</div>

<!-- SPECS -->
<div class="section-divider">${state.lang==='es'?'Especificaciones':'Specifications'}</div>
<div class="field-row">
  <div class="field-group">
    <label>MOQ</label>
    <input type="text" id="pd-moq" value="${escAttr(product.moq||'')}" oninput="updateProductField('${productId}','moq',this.value)" style="font-family:var(--font-mono)">
  </div>
  <div class="field-group">
    <label>${state.lang==='es'?'Pcs/Caja':'Pcs/Box'}</label>
    <input type="text" id="pd-pcsPerBox" value="${escAttr(product.pcsPerBox||'')}" oninput="updateProductField('${productId}','pcsPerBox',this.value)" style="font-family:var(--font-mono)">
  </div>
</div>
<div class="field-row">
  <div class="field-group">
    <label>${state.lang==='es'?'Peso':'Weight'}</label>
    <input type="text" id="pd-weight" value="${escAttr(product.weight||'')}" oninput="updateProductField('${productId}','weight',this.value)">
  </div>
  <div class="field-group">
    <label>CBM (m³)</label>
    <input type="text" id="pd-cbm" value="${escAttr(product.cbm||'')}" oninput="updateProductField('${productId}','cbm',this.value)" style="font-family:var(--font-mono)">
  </div>
</div>
<div class="field-group">
  <label>${state.lang==='es'?'Medidas':'Dimensions'}</label>
  <input type="text" id="pd-dimensions" value="${escAttr(product.dimensions||'')}" oninput="updateProductField('${productId}','dimensions',this.value)">
</div>
<div class="field-group">
  <label>${state.lang==='es'?'Pedido Sugerido':'Suggested Order'}</label>
  <input type="number" id="pd-suggestedOrder" value="${escAttr(product.suggestedOrder||'')}" oninput="updateProductField('${productId}','suggestedOrder',this.value)">
</div>

<!-- NOTES -->
<div class="section-divider">${state.lang==='es'?'Notas':'Notes'}</div>
<div class="field-group">
  <textarea id="pd-notes" rows="3" oninput="updateProductField('${productId}','notes',this.value)">${escHtml(product.notes||'')}</textarea>
</div>

<!-- VOICE NOTE -->
<button class="voice-btn" id="voice-btn-${productId}" onclick="toggleVoiceRecording('${productId}')">
  🎤 ${state.lang==='es'?'Nota de voz':'Voice note'}
</button>
${product.voiceNote ? `<div class="voice-player"><audio controls src="${product.voiceNote}"></audio></div>` : ''}

<!-- SUPPLIER -->
<div class="section-divider">${state.lang==='es'?'Proveedor':'Supplier'}</div>
<div class="field-group">
  <select id="pd-supplier" onchange="updateProductField('${productId}','supplierId',this.value)">
    ${state.suppliers.filter(s=>s.team===state.user.team).map(s=>
      `<option value="${s.id}" ${s.id===product.supplierId?'selected':''}>${escHtml(s.name)}</option>`
    ).join('')}
  </select>
</div>
<div style="font-family:var(--font-mono);font-size:10px;color:var(--text3);margin-top:8px">
  ${state.lang==='es'?'Capturado por':'Captured by'}: ${escHtml(product.createdBy||'—')} · ${new Date(product.createdAt).toLocaleString()}
</div>

<!-- DELETE -->
<div style="margin-top:24px">
  <button class="btn-danger" onclick="deleteProduct('${productId}')">
    🗑 ${state.lang==='es'?'Eliminar producto':'Delete product'}
  </button>
</div>
```

`;
}

function updateProductField(productId, field, value) {
const product = state.products.find(p => p.id === productId);
if (product) {
product[field] = value;
// Don’t save on every keystroke — save on blur or explicit save
}
}

function saveCurrentProduct() {
saveLocalState();
showToast(‘✓ Guardado’, ‘success’);
// Re-render to update display
if (state.currentProduct) {
renderProductDetail(state.currentProduct);
}
}

function setProductStatus(productId, status) {
const product = state.products.find(p => p.id === productId);
if (product) {
product.status = status;
saveLocalState();
renderProductDetail(productId);
}
}

function setProductPriority(productId, priority) {
const product = state.products.find(p => p.id === productId);
if (product) {
product.priority = priority;
saveLocalState();
renderProductDetail(productId);
}
}

function recalcDiscount(productId) {
const product = state.products.find(p => p.id === productId);
if (!product) return;
const orig = parseFloat(document.getElementById(‘pd-price’)?.value);
const neg = parseFloat(document.getElementById(‘pd-priceNeg’)?.value);
const badge = document.getElementById(`discount-badge-${productId}`);
if (badge && orig && neg && neg < orig) {
const pct = Math.round((1 - neg/orig)*100);
badge.innerHTML = `<span class="discount-badge">-${pct}% descuento</span>`;
} else if (badge) {
badge.innerHTML = ‘’;
}
}

function deleteProduct(productId) {
if (!confirm(state.lang===‘es’?’¿Eliminar este producto?’:‘Delete this product?’)) return;
state.products = state.products.filter(p => p.id !== productId);
saveLocalState();
updateStats();
navigate(‘products’);
showToast(‘Producto eliminado’);
}

function changeProductPhoto(productId) {
// Create temp input
const input = document.createElement(‘input’);
input.type = ‘file’; input.accept = ‘image/*’; input.capture = ‘environment’;
input.onchange = async () => {
if (!input.files[0]) return;
const base64 = await fileToBase64(input.files[0]);
const product = state.products.find(p => p.id === productId);
if (product) {
product.image = base64;
saveLocalState();

```
  // Re-analyze
  const statusEl = document.getElementById('product-ocr-status') || document.createElement('div');
  showToast('Analizando nueva foto...');
  try {
    const data = await runProductOCR(base64);
    if (data.description) product.description = data.description;
    if (data.model) product.model = data.model;
    if (data.price) product.price = data.price;
    if (data.moq) product.moq = data.moq;
    if (data.pcsPerBox) product.pcsPerBox = data.pcsPerBox;
    if (data.weight) product.weight = data.weight;
    if (data.cbm) product.cbm = data.cbm;
    if (data.colors) product.colors = data.colors;
    saveLocalState();
    showToast('✓ Foto actualizada', 'success');
  } catch(e) {
    showToast('Foto actualizada (sin OCR)', 'success');
  }
  renderProductDetail(productId);
}
```

};
input.click();
}

function changeSupplierPhoto(supplierId) {
const input = document.createElement(‘input’);
input.type = ‘file’; input.accept = ‘image/*’; input.capture = ‘environment’;
input.onchange = async () => {
if (!input.files[0]) return;
const base64 = await fileToBase64(input.files[0]);
const supplier = state.suppliers.find(s => s.id === supplierId);
if (supplier) {
supplier.image = base64;
saveLocalState();
renderSupplierDetail(supplierId);
showToast(‘✓ Foto actualizada’, ‘success’);
}
};
input.click();
}

// ============================
// VOICE RECORDING
// ============================
async function toggleVoiceRecording(productId) {
const btn = document.getElementById(`voice-btn-${productId}`);

if (!state.isRecording) {
try {
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
state.mediaRecorder = new MediaRecorder(stream);
state.audioChunks = [];

```
  state.mediaRecorder.ondataavailable = e => state.audioChunks.push(e.data);
  state.mediaRecorder.onstop = async () => {
    const blob = new Blob(state.audioChunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    const product = state.products.find(p => p.id === productId);
    if (product) {
      product.voiceNote = url;
      saveLocalState();
      renderProductDetail(productId);
    }
    stream.getTracks().forEach(t => t.stop());
  };
  
  state.mediaRecorder.start();
  state.isRecording = true;
  if (btn) { btn.textContent = `⏹ ${state.lang==='es'?'Detener grabación':'Stop recording'}`;
    btn.classList.add('recording'); }
} catch(e) {
  showToast('Micrófono no disponible', 'error');
}
```

} else {
state.mediaRecorder?.stop();
state.isRecording = false;
if (btn) { btn.textContent = `🎤 ${state.lang==='es'?'Nota de voz':'Voice note'}`;
btn.classList.remove(‘recording’); }
}
}

// ============================
// EXPORT EXCEL
// ============================
function renderExport() {
const container = document.getElementById(‘export-content’);
const myProducts = state.products.filter(p => p.team === state.user.team);
const mySuppliers = state.suppliers.filter(s => s.team === state.user.team);
const approved = myProducts.filter(p => p.status === ‘approved’).length;
const high = myProducts.filter(p => p.priority === ‘high’).length;

container.innerHTML = `
<div class="export-card">
<h3>📊 ${state.lang===‘es’?‘Resumen de Exportación’:‘Export Summary’}</h3>
<div class="export-summary">
<div class="export-row"><span>${state.lang===‘es’?‘Total productos’:‘Total products’}</span><span>${myProducts.length}</span></div>
<div class="export-row"><span>${state.lang===‘es’?‘Aprobados’:‘Approved’}</span><span>${approved}</span></div>
<div class="export-row"><span>${state.lang===‘es’?‘Alta prioridad’:‘High priority’}</span><span>${high}</span></div>
<div class="export-row"><span>${state.lang===‘es’?‘Proveedores’:‘Suppliers’}</span><span>${mySuppliers.length}</span></div>
</div>
</div>

```
<div class="export-card">
  <h3>📁 ${state.lang==='es'?'Opciones de Exportación':'Export Options'}</h3>
  <div class="export-options">
    <button class="export-option" onclick="exportExcel('all')">
      <span class="opt-icon">📊</span>
      <div class="opt-info">
        <div class="opt-title">${state.lang==='es'?'Excel Completo':'Full Excel'}</div>
        <div class="opt-desc">${state.lang==='es'?'Todos los productos con imágenes':'All products with images'}</div>
      </div>
      <span style="color:var(--accent);font-size:20px">›</span>
    </button>
    <button class="export-option" onclick="exportExcel('approved')">
      <span class="opt-icon">✅</span>
      <div class="opt-info">
        <div class="opt-title">${state.lang==='es'?'Solo Aprobados':'Approved Only'}</div>
        <div class="opt-desc">${state.lang==='es'?'Productos con estado Aprobado':'Products with Approved status'}</div>
      </div>
      <span style="color:var(--accent);font-size:20px">›</span>
    </button>
    <button class="export-option" onclick="exportExcel('high')">
      <span class="opt-icon">🔴</span>
      <div class="opt-info">
        <div class="opt-title">${state.lang==='es'?'Alta Prioridad':'High Priority'}</div>
        <div class="opt-desc">${state.lang==='es'?'Solo productos de alta prioridad':'High priority products only'}</div>
      </div>
      <span style="color:var(--accent);font-size:20px">›</span>
    </button>
  </div>
</div>

<div id="export-progress" class="export-progress">
  <div style="font-size:13px;color:var(--text2)" id="export-progress-text">Generando Excel...</div>
  <div class="progress-bar-track"><div class="progress-bar-fill" id="export-bar" style="width:0%"></div></div>
</div>
```

`;
}

async function exportExcel(filter) {
if (typeof XLSX === ‘undefined’) {
showToast(‘XLSX library loading…’, ‘error’);
return;
}

const progressEl = document.getElementById(‘export-progress’);
const barEl = document.getElementById(‘export-bar’);
const textEl = document.getElementById(‘export-progress-text’);

progressEl.style.display = ‘block’;

let products = state.products.filter(p => p.team === state.user.team);
if (filter === ‘approved’) products = products.filter(p => p.status === ‘approved’);
else if (filter === ‘high’) products = products.filter(p => p.priority === ‘high’);

if (!products.length) {
showToast(state.lang===‘es’?‘Sin productos para exportar’:‘No products to export’, ‘error’);
progressEl.style.display = ‘none’;
return;
}

// Sort by supplier
products.sort((a,b) => (a.supplierName||’’).localeCompare(b.supplierName||’’));

const wb = XLSX.utils.book_new();

// –– MAIN SHEET ––
const headers = [
‘Proveedor’, ‘Stand/Booth’, ‘Descripción’, ‘Modelo’,
‘Precio RMB (¥)’, ‘Precio Negociado’, ‘Descuento %’,
‘MOQ’, ‘Pcs/Caja’, ‘Peso’, ‘Medidas’, ‘CBM’,
‘Colores’, ‘Pedido Sugerido’, ‘Prioridad’, ‘Estado’,
‘Capturado por’, ‘Notas’, ‘Fecha’
];

const rows = [headers];

let currentSupplier = ‘’;

for (let i = 0; i < products.length; i++) {
const p = products[i];
barEl.style.width = `${Math.round((i/products.length)*80)}%`;
textEl.textContent = `${state.lang==='es'?'Procesando':'Processing'} ${i+1}/${products.length}...`;

```
// Supplier separator row
if (p.supplierName !== currentSupplier) {
  currentSupplier = p.supplierName;
  rows.push([`▶ PROVEEDOR: ${currentSupplier}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
}

const orig = parseFloat(p.price)||0;
const neg = parseFloat(p.priceNegotiated)||0;
const discount = (orig && neg && neg < orig) ? `${Math.round((1-neg/orig)*100)}%` : '';

const priorityMap = { high:'Alta / High', medium:'Media / Medium', low:'Baja / Low' };
const statusMap = { pending:'Pendiente / Pending', approved:'Aprobado / Approved', discarded:'Descartado / Discarded' };

rows.push([
  p.supplierName || '',
  p.booth || (state.suppliers.find(s=>s.id===p.supplierId)?.booth||''),
  p.description || '',
  p.model || '',
  p.price || '',
  p.priceNegotiated || '',
  discount,
  p.moq || '',
  p.pcsPerBox || '',
  p.weight || '',
  p.dimensions || '',
  p.cbm || '',
  p.colors || '',
  p.suggestedOrder || '',
  priorityMap[p.priority]||p.priority||'',
  statusMap[p.status]||p.status||'',
  p.createdBy || '',
  p.notes || '',
  new Date(p.createdAt).toLocaleDateString(),
]);

// Small delay to not block UI
if (i % 10 === 0) await sleep(10);
```

}

const ws = XLSX.utils.aoa_to_sheet(rows);

// Style header row
ws[’!cols’] = [
{wch:22},{wch:12},{wch:30},{wch:14},{wch:12},{wch:14},{wch:10},
{wch:8},{wch:8},{wch:10},{wch:12},{wch:8},{wch:14},{wch:12},
{wch:10},{wch:12},{wch:14},{wch:25},{wch:12}
];

XLSX.utils.book_append_sheet(wb, ws, ‘Productos’);

// –– SUPPLIERS SHEET ––
const suppHeaders = [‘Nombre’, ‘Stand/Booth’, ‘Contacto’, ‘WeChat’, ‘Categoría’, ‘Calificación’, ‘Notas’, ‘Visita’];
const suppRows = [suppHeaders, …state.suppliers
.filter(s => s.team === state.user.team)
.map(s => [s.name, s.booth, s.contact, s.wechat, s.category, ‘⭐’.repeat(s.rating||0), s.notes, s.visitId])
];
const ws2 = XLSX.utils.aoa_to_sheet(suppRows);
ws2[’!cols’] = [{wch:22},{wch:12},{wch:16},{wch:16},{wch:14},{wch:10},{wch:30},{wch:20}];
XLSX.utils.book_append_sheet(wb, ws2, ‘Proveedores’);

barEl.style.width = ‘100%’;
textEl.textContent = state.lang===‘es’?‘Descargando…’:‘Downloading…’;

await sleep(300);

// Generate file
const date = new Date().toISOString().split(‘T’)[0];
const filename = `BuyTrip_${state.user.team}_${date}.xlsx`;
XLSX.writeFile(wb, filename);

progressEl.style.display = ‘none’;
showToast(‘✓ Excel descargado’, ‘success’);
}

// ============================
// UTILS
// ============================
function genId() {
return Date.now().toString(36) + Math.random().toString(36).substring(2,8);
}

function escHtml(str) {
if (!str) return ‘’;
return String(str)
.replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’)
.replace(/”/g,’"’).replace(/’/g,’'’);
}

function escAttr(str) {
if (!str) return ‘’;
return String(str).replace(/”/g,’"’).replace(/’/g,’'’);
}

async function fileToBase64(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = e => resolve(e.target.result);
reader.onerror = reject;
reader.readAsDataURL(file);
});
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showToast(msg, type=’’) {
const toast = document.getElementById(‘toast’);
toast.textContent = msg;
toast.className = `toast ${type}`;
toast.classList.remove(‘hidden’);
setTimeout(() => toast.classList.add(‘hidden’), 2500);
}

function closeModal(id) {
document.getElementById(id).classList.add(‘hidden’);
}

// ============================
// STAR RATING
// ============================
let currentRating = 0;
function setRating(n) {
currentRating = n;
document.getElementById(‘s-rating-val’).value = n;
updateStarUI(n);
}
function updateStarUI(n) {
const stars = document.querySelectorAll(’#s-rating span’);
stars.forEach((s, i) => {
s.classList.toggle(‘active’, i < n);
});
}

// ============================
// LANGUAGE
// ============================
function setLang(lang) {
state.lang = lang;
saveLocalState();
applyLang();
}

function applyLang() {
document.querySelectorAll(’[data-es],[data-en]’).forEach(el => {
const txt = el.getAttribute(`data-${state.lang}`);
if (txt) el.textContent = txt;
});
document.getElementById(‘btn-es’)?.classList.toggle(‘active’, state.lang === ‘es’);
document.getElementById(‘btn-en’)?.classList.toggle(‘active’, state.lang === ‘en’);
}

// ============================
// SERVICE WORKER REGISTRATION
// ============================
if (‘serviceWorker’ in navigator) {
window.addEventListener(‘load’, () => {
navigator.serviceWorker.register(‘service-worker.js’)
.then(() => console.log(‘SW registered’))
.catch(e => console.log(‘SW error’, e));
});
}
