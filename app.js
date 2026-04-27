// ===== BUYTRIP PRO - APP.JS =====

const CONFIG = {
SUPABASE_URL: ‘YOUR_SUPABASE_URL’,
SUPABASE_ANON_KEY: ‘YOUR_SUPABASE_ANON_KEY’,
CLAUDE_API_KEY: ‘YOUR_CLAUDE_API_KEY’,
};

let state = {
lang: ‘es’, user: null, visits: [], suppliers: [], products: [],
activeVisit: null, currentSupplier: null, currentProduct: null,
currentProductPhoto: null, currentSupplierCardPhoto: null,
pendingSupplierIdForProduct: null, isRecording: false,
mediaRecorder: null, audioChunks: [], syncing: false,
};

window.addEventListener(‘DOMContentLoaded’, () => {
loadLocalState();
setTimeout(() => {
const splash = document.getElementById(‘splash’);
if (splash) splash.classList.add(‘hidden’);
if (state.user) { showApp(); }
else { document.getElementById(‘screen-login’).classList.remove(‘hidden’); }
applyLang();
}, 100);
});

function loadLocalState() {
try {
const saved = localStorage.getItem(‘buytrip_state’);
if (saved) {
const p = JSON.parse(saved);
state.user = p.user||null; state.visits = p.visits||[];
state.suppliers = p.suppliers||[]; state.products = p.products||[];
state.activeVisit = p.activeVisit||null; state.lang = p.lang||‘es’;
}
} catch(e) {}
}

function saveLocalState() {
try {
localStorage.setItem(‘buytrip_state’, JSON.stringify({
user:state.user, visits:state.visits, suppliers:state.suppliers,
products:state.products, activeVisit:state.activeVisit, lang:state.lang
}));
} catch(e) {}
}

function doLogin() {
const name = document.getElementById(‘login-name’).value.trim();
const team = document.getElementById(‘login-team’).value.trim().toUpperCase();
if (!name) { showToast(‘Ingresa tu nombre’,‘error’); return; }
if (!team) { showToast(‘Ingresa el código de equipo’,‘error’); return; }
state.user = { name, team, initials: name.substring(0,2).toUpperCase() };
saveLocalState();
document.getElementById(‘screen-login’).classList.add(‘hidden’);
showApp();
}

function showApp() {
document.getElementById(‘app’).classList.remove(‘hidden’);
document.getElementById(‘user-badge’).textContent = state.user.initials;
updateStats(); renderHome(); navigate(‘home’); applyLang();
}

const SCREEN_MAP = { home:‘screen-home’, visits:‘screen-visits’, suppliers:‘screen-suppliers’, products:‘screen-products’, export:‘screen-export’, ‘supplier-detail’:‘screen-supplier-detail’, ‘product-detail’:‘screen-product-detail’ };

function navigate(screen, options={}) {
Object.values(SCREEN_MAP).forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove(‘active’); });
const target = document.getElementById(SCREEN_MAP[screen]);
if (target) target.classList.add(‘active’);
const titles = { home:{es:‘Inicio’,en:‘Home’}, visits:{es:‘Visitas’,en:‘Visits’}, suppliers:{es:‘Proveedores’,en:‘Suppliers’}, products:{es:‘Productos’,en:‘Products’}, export:{es:‘Exportar’,en:‘Export’}, ‘supplier-detail’:{es:‘Proveedor’,en:‘Supplier’}, ‘product-detail’:{es:‘Producto’,en:‘Product’} };
document.getElementById(‘topbar-title’).textContent = (titles[screen]||{es:‘BuyTrip’})[state.lang];
document.querySelectorAll(’.nav-btn’).forEach(b => b.classList.remove(‘active’));
document.getElementById(‘nav-’+screen)?.classList.add(‘active’);
if (screen===‘home’) renderHome();
else if (screen===‘visits’) renderVisits();
else if (screen===‘suppliers’) renderSuppliers();
else if (screen===‘products’) renderProducts();
else if (screen===‘export’) renderExport();
else if (screen===‘supplier-detail’ && options.supplierId) renderSupplierDetail(options.supplierId);
else if (screen===‘product-detail’ && options.productId) renderProductDetail(options.productId);
}

function renderHome() {
const hour = new Date().getHours();
const greet = hour<12?‘Buenos días,’:hour<18?‘Buenas tardes,’:‘Buenas noches,’;
const greetEl = document.getElementById(‘home-greeting’);
if (greetEl) greetEl.textContent = `${greet} ${state.user?.name||''}`;
const dateEl = document.getElementById(‘home-date’);
if (dateEl) dateEl.textContent = new Date().toLocaleDateString(‘es-ES’,{weekday:‘long’,year:‘numeric’,month:‘long’,day:‘numeric’}).toUpperCase();
updateStats();
const recent = […state.products].filter(p=>p.team===state.user?.team).sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
const container = document.getElementById(‘recent-products-list’);
if (container) container.innerHTML = recent.length ? recent.map(p=>productCardHTML(p)).join(’’) : ‘<div class="empty-state"><div class="empty-icon">📦</div><div>Sin productos aún</div></div>’;
}

function updateStats() {
const t = state.user?.team;
document.getElementById(‘stat-visits’).textContent = state.visits.filter(v=>v.team===t).length;
document.getElementById(‘stat-suppliers’).textContent = state.suppliers.filter(s=>s.team===t).length;
document.getElementById(‘stat-products’).textContent = state.products.filter(p=>p.team===t).length;
}

function renderVisits() {
const list = document.getElementById(‘visits-list’);
const items = state.visits.filter(v=>v.team===state.user.team).sort((a,b)=>b.createdAt-a.createdAt);
if (!items.length) { list.innerHTML=’<div class="empty-state"><div class="empty-icon">📋</div><div>No hay visitas</div></div>’; return; }
list.innerHTML = items.map(v => {
const sc=state.suppliers.filter(s=>s.visitId===v.id).length, pc=state.products.filter(p=>p.visitId===v.id).length, isActive=state.activeVisit===v.id;
return `<div class="visit-item ${isActive?'active-visit':''}" onclick="selectVisit('${v.id}')"><div class="item-icon">📋</div><div class="item-info"><div class="item-name">${escHtml(v.name)}${isActive?'<span class="visit-badge">ACTIVA</span>':''}</div><div class="item-sub">📍 ${escHtml(v.city)}</div><div class="item-meta">${new Date(v.createdAt).toLocaleDateString()} · ${sc} proveedores · ${pc} productos</div></div><div class="item-arrow">›</div></div>`;
}).join(’’);
}

function showNewVisitModal() { document.getElementById(‘modal-visit’).classList.remove(‘hidden’); }

function createVisit() {
const name = document.getElementById(‘v-name’).value.trim();
if (!name) { showToast(‘Ingresa un nombre’,‘error’); return; }
const visit = { id:genId(), team:state.user.team, createdBy:state.user.name, name, city:document.getElementById(‘v-city’).value, market:document.getElementById(‘v-market’).value.trim(), notes:document.getElementById(‘v-notes’).value.trim(), date:new Date().toISOString().split(‘T’)[0], createdAt:Date.now() };
state.visits.push(visit); state.activeVisit = visit.id; saveLocalState();
closeModal(‘modal-visit’); showToast(‘✓ Visita creada’,‘success’);
renderVisits(); updateStats(); renderHome();
[‘v-name’,‘v-market’,‘v-notes’].forEach(id=>{ document.getElementById(id).value=’’; });
}

function selectVisit(id) { state.activeVisit=id; saveLocalState(); renderVisits(); renderHome(); showToast(‘✓ Visita activada’,‘success’); }

function renderSuppliers(filter=’’) {
const list = document.getElementById(‘suppliers-list’);
let items = state.suppliers.filter(s=>s.team===state.user.team);
if (filter) { const f=filter.toLowerCase(); items=items.filter(s=>(s.name||’’).toLowerCase().includes(f)||(s.booth||’’).toLowerCase().includes(f)); }
items.sort((a,b)=>b.createdAt-a.createdAt);
if (!items.length) { list.innerHTML=’<div class="empty-state"><div class="empty-icon">🏪</div><div>Sin proveedores</div></div>’; return; }
list.innerHTML = items.map(s => {
const pc=state.products.filter(p=>p.supplierId===s.id).length;
return `<div class="supplier-item" onclick="openSupplierDetail('${s.id}')">${s.image?`<div style="width:48px;height:48px;overflow:hidden;border-radius:8px;flex-shrink:0"><img src="${s.image}" style="width:100%;height:100%;object-fit:cover"></div>`:'<div class="item-icon">🏪</div>'}<div class="item-info"><div class="item-name">${escHtml(s.name||'Sin nombre')}</div><div class="item-sub">${escHtml(s.booth||'')} ${s.category?'· '+escHtml(s.category):''}</div></div><div class="item-count">${pc}</div><div class="item-arrow">›</div></div>`;
}).join(’’);
}

function filterSuppliers(val) { renderSuppliers(val); }

function showNewSupplierModal() {
[‘s-name’,‘s-booth’,‘s-contact’,‘s-wechat’,‘s-category’,‘s-notes’].forEach(id=>{document.getElementById(id).value=’’;});
document.getElementById(‘s-rating-val’).value=‘0’; updateStarUI(0);
document.getElementById(‘supplier-card-preview’).innerHTML=’<div class="photo-icon">📷</div><div>Foto de tarjeta del proveedor</div><small>La IA llenará los campos</small>’;
state.currentSupplierCardPhoto=null;
document.getElementById(‘modal-supplier’).classList.remove(‘hidden’);
}

function captureSupplierCard() { document.getElementById(‘file-supplier-card’).click(); }

async function handleSupplierCardFile(input) {
const file=input.files[0]; if(!file) return;
const base64=await fileToBase64(file); state.currentSupplierCardPhoto=base64;
document.getElementById(‘supplier-card-preview’).innerHTML=`<img src="${base64}" style="max-height:160px;object-fit:contain;width:100%">`;
await runSupplierCardOCR(base64); input.value=’’;
}

async function runSupplierCardOCR(base64) {
const statusEl=document.getElementById(‘supplier-ocr-status’); statusEl.classList.remove(‘hidden’);
try {
const result=await callClaudeOCR(base64,‘Analyze this business card from a Chinese wholesale market. Return ONLY JSON: {“name”:“company”,“booth”:“booth number”,“contact”:“person”,“wechat”:“wechat/phone”,“category”:“product type”,“website”:””}. Use “” for missing.’);
if(result) { if(result.name) document.getElementById(‘s-name’).value=result.name; if(result.booth) document.getElementById(‘s-booth’).value=result.booth; if(result.contact) document.getElementById(‘s-contact’).value=result.contact; if(result.wechat) document.getElementById(‘s-wechat’).value=result.wechat; if(result.category) document.getElementById(‘s-category’).value=result.category; showToast(‘✓ Tarjeta analizada’,‘success’); }
} catch(e) { showToast(‘Completa los campos manualmente’,‘error’); }
finally { statusEl.classList.add(‘hidden’); }
}

function createSupplier() {
const name=document.getElementById(‘s-name’).value.trim();
if(!name) { showToast(‘Ingresa el nombre’,‘error’); return; }
const supplier={ id:genId(), team:state.user.team, visitId:state.activeVisit, createdBy:state.user.name, name, booth:document.getElementById(‘s-booth’).value.trim(), contact:document.getElementById(‘s-contact’).value.trim(), wechat:document.getElementById(‘s-wechat’).value.trim(), category:document.getElementById(‘s-category’).value.trim(), notes:document.getElementById(‘s-notes’).value.trim(), rating:parseInt(document.getElementById(‘s-rating-val’).value)||0, image:state.currentSupplierCardPhoto||null, createdAt:Date.now() };
state.suppliers.push(supplier); state.currentSupplierCardPhoto=null; saveLocalState();
closeModal(‘modal-supplier’); showToast(‘✓ Proveedor creado’,‘success’);
navigate(‘supplier-detail’,{supplierId:supplier.id}); updateStats();
}

function openSupplierDetail(id) { state.currentSupplier=id; navigate(‘supplier-detail’,{supplierId:id}); }

function renderSupplierDetail(supplierId) {
const supplier=state.suppliers.find(s=>s.id===supplierId); if(!supplier) return;
state.currentSupplier=supplierId;
document.getElementById(‘supplier-detail-title’).textContent=supplier.name||‘Proveedor’;
const products=state.products.filter(p=>p.supplierId===supplierId).sort((a,b)=>b.createdAt-a.createdAt);
document.getElementById(‘supplier-detail-content’).innerHTML=` <div class="supplier-header-card"> <div class="supplier-photo" onclick="changeSupplierPhoto('${supplierId}')">${supplier.image?`<img src="${supplier.image}" alt="supplier">`:'🏪'}</div> <div class="supplier-info-grid"> <div class="supplier-info-item"><label>Stand</label><span>${escHtml(supplier.booth||'—')}</span></div> <div class="supplier-info-item"><label>Contacto</label><span>${escHtml(supplier.contact||'—')}</span></div> <div class="supplier-info-item"><label>WeChat</label><span>${escHtml(supplier.wechat||'—')}</span></div> <div class="supplier-info-item"><label>Categoría</label><span>${escHtml(supplier.category||'—')}</span></div> ${supplier.notes?`<div class="supplier-info-item" style="grid-column:1/-1"><label>Notas</label><span>${escHtml(supplier.notes)}</span></div>`:''} </div> </div> <div class="supplier-products-header"><h3>Productos (${products.length})</h3><button class="add-btn" onclick="addProductToCurrentSupplier()">📷</button></div> <div style="display:flex;flex-direction:column;gap:10px">${products.length?products.map(p=>productCardHTML(p)).join(''):'<div class="empty-state"><div class="empty-icon">📦</div><div>Sin productos</div><p>Toca 📷 para agregar</p></div>'}</div>`;
}

function addProductToCurrentSupplier() { state.pendingSupplierIdForProduct=state.currentSupplier; showProductCapture(); }

function productCardHTML(product) {
const sL={pending:‘Pendiente’,approved:‘Aprobado’,discarded:‘Descartado’}, pL={high:‘Alta’,medium:‘Media’,low:‘Baja’};
return `<div class="product-card status-${product.status||'pending'} priority-${product.priority||'medium'}" onclick="openProductDetail('${product.id}')"><div class="product-thumb">${product.image?`<img src="${product.image}" alt="product">`:'📦'}</div><div class="product-info"><div class="product-name">${escHtml(product.description||'Sin descripción')}</div>${product.model?`<div class="product-model">${escHtml(product.model)}</div>`:''}<div class="product-price">¥${product.priceNegotiated||product.price||'—'}</div><div class="product-tags"><span class="tag tag-${product.status||'pending'}">${sL[product.status||'pending']}</span><span class="tag tag-${product.priority||'medium'}">${pL[product.priority||'medium']}</span>${product.moq?`<span class="tag" style="background:var(--bg3);color:var(--text2)">MOQ ${product.moq}</span>`:''}</div></div></div>`;
}

function renderProducts(filter=‘all’) {
const list=document.getElementById(‘products-list’);
let items=state.products.filter(p=>p.team===state.user.team);
if(filter===‘approved’) items=items.filter(p=>p.status===‘approved’);
else if(filter===‘pending’) items=items.filter(p=>p.status===‘pending’);
else if(filter===‘high’) items=items.filter(p=>p.priority===‘high’);
else if(filter===‘discarded’) items=items.filter(p=>p.status===‘discarded’);
items.sort((a,b)=>b.createdAt-a.createdAt);
list.innerHTML=items.length?items.map(p=>productCardHTML(p)).join(’’):’<div class="empty-state"><div class="empty-icon">📦</div><div>Sin productos</div></div>’;
}

function filterProducts(val) { renderProducts(val); }

function showProductCapture() {
const sel=document.getElementById(‘p-supplier-select’);
const suppliers=state.suppliers.filter(s=>s.team===state.user.team);
sel.innerHTML=suppliers.map(s=>`<option value="${s.id}" ${s.id===state.pendingSupplierIdForProduct?'selected':''}>${escHtml(s.name)}</option>`).join(’’)||’<option value="">Crea un proveedor primero</option>’;
document.getElementById(‘product-photo-preview’).innerHTML=’<div class="photo-icon big">📷</div><div>Toca para tomar foto</div>’;
state.currentProductPhoto=null;
document.getElementById(‘product-ocr-status’).classList.add(‘hidden’);
document.getElementById(‘modal-capture’).classList.remove(‘hidden’);
}

function captureProductPhoto() { document.getElementById(‘file-product-photo’).click(); }

async function handleProductPhotoFile(input) {
const file=input.files[0]; if(!file) return;
const base64=await fileToBase64(file); state.currentProductPhoto=base64;
document.getElementById(‘product-photo-preview’).innerHTML=`<img src="${base64}" class="photo-preview-img">`;
input.value=’’;
}

async function analyzeAndCreate() {
if(!state.currentProductPhoto) { showToast(‘Toma una foto primero’,‘error’); return; }
const supplierId=document.getElementById(‘p-supplier-select’).value;
if(!supplierId) { showToast(‘Selecciona un proveedor’,‘error’); return; }
const statusEl=document.getElementById(‘product-ocr-status’), btn=document.getElementById(‘btn-analyze’);
statusEl.classList.remove(‘hidden’); btn.disabled=true;
let data={};
try { data=await runProductOCR(state.currentProductPhoto); } catch(e) {}
finally { statusEl.classList.add(‘hidden’); btn.disabled=false; }
const supplier=state.suppliers.find(s=>s.id===supplierId);
const product={ id:genId(), team:state.user.team, visitId:state.activeVisit, supplierId, supplierName:supplier?.name||’’, createdBy:state.user.name, image:state.currentProductPhoto, status:‘pending’, priority:‘medium’, createdAt:Date.now(), description:data.description||’’, model:data.model||’’, price:data.price||’’, priceNegotiated:data.price||’’, moq:data.moq||’’, pcsPerBox:data.pcsPerBox||’’, weight:data.weight||’’, dimensions:data.dimensions||’’, cbm:data.cbm||’’, colors:data.colors||’’, notes:’’, voiceNote:null, suggestedOrder:’’ };
state.products.push(product); state.currentProductPhoto=null; state.pendingSupplierIdForProduct=null;
saveLocalState(); closeModal(‘modal-capture’); showToast(‘✓ Producto capturado’,‘success’); updateStats();
openProductDetail(product.id,true);
}

async function runProductOCR(base64) {
return await callClaudeOCR(base64,‘Analyze this product photo from a Chinese wholesale market. Return ONLY JSON: {“description”:“product description”,“model”:“model code”,“price”:“RMB price number only”,“moq”:“min order number only”,“pcsPerBox”:“pieces per box number only”,“weight”:“weight with units”,“dimensions”:“dimensions”,“cbm”:“cubic meters number only”,“colors”:“colors”}. Use “” for missing. Example input: “DM5-083 ¥0.7 x864 18.2g 600g/box 24pcs/box 0.12m³”’);
}

async function callClaudeOCR(base64, prompt) {
if(CONFIG.CLAUDE_API_KEY===‘YOUR_CLAUDE_API_KEY’) return {description:‘Producto demo’,model:‘MOD-001’,price:‘1.50’,moq:‘100’,pcsPerBox:‘24’,weight:‘50g’,dimensions:‘10cm’,cbm:‘0.05’,colors:‘Varios’};
const mimeMatch=base64.match(/^data:([^;]+);base64,/), mediaType=mimeMatch?mimeMatch[1]:‘image/jpeg’, imageData=base64.replace(/^data:[^;]+;base64,/,’’);
const response=await fetch(‘https://api.anthropic.com/v1/messages’,{method:‘POST’,headers:{‘Content-Type’:‘application/json’,‘x-api-key’:CONFIG.CLAUDE_API_KEY,‘anthropic-version’:‘2023-06-01’},body:JSON.stringify({model:‘claude-opus-4-5’,max_tokens:1000,messages:[{role:‘user’,content:[{type:‘image’,source:{type:‘base64’,media_type:mediaType,data:imageData}},{type:‘text’,text:prompt}]}]})});
if(!response.ok) throw new Error(‘Claude API error’);
const d=await response.json();
try { return JSON.parse((d.content[0]?.text||’{}’).replace(/`json|`/g,’’).trim()); } catch(e) { return {}; }
}

function openProductDetail(id) { state.currentProduct=id; navigate(‘product-detail’,{productId:id}); }

function renderProductDetail(productId) {
const product=state.products.find(p=>p.id===productId); if(!product) return;
const discount=product.price&&product.priceNegotiated?Math.round((1-parseFloat(product.priceNegotiated)/parseFloat(product.price))*100):0;
document.getElementById(‘product-detail-content’).innerHTML=` <div class="product-image-header" onclick="changeProductPhoto('${productId}')">${product.image?`<img src="${product.image}" alt="product">`:'📦'}<div class="change-photo-hint">📷 Cambiar</div></div> <div class="section-divider">Estado</div> <div class="status-selector"> <button class="status-btn ${product.status==='pending'?'active-pending':''}" onclick="setProductStatus('${productId}','pending')">⏳ Pendiente</button> <button class="status-btn ${product.status==='approved'?'active-approved':''}" onclick="setProductStatus('${productId}','approved')">✓ Aprobado</button> <button class="status-btn ${product.status==='discarded'?'active-discarded':''}" onclick="setProductStatus('${productId}','discarded')">✕ Descartar</button> </div> <div class="section-divider">Prioridad</div> <div class="priority-selector"> <button class="priority-btn ${product.priority==='high'?'active-high':''}" onclick="setProductPriority('${productId}','high')">🔴 Alta</button> <button class="priority-btn ${product.priority==='medium'?'active-medium':''}" onclick="setProductPriority('${productId}','medium')">🟡 Media</button> <button class="priority-btn ${product.priority==='low'?'active-low':''}" onclick="setProductPriority('${productId}','low')">⚪ Baja</button> </div> <div class="section-divider">Información</div> <div class="field-group"><label>Descripción</label><input type="text" value="${escAttr(product.description||'')}" oninput="updateProductField('${productId}','description',this.value)"></div> <div class="field-row"> <div class="field-group"><label>Modelo</label><input type="text" value="${escAttr(product.model||'')}" oninput="updateProductField('${productId}','model',this.value)"></div> <div class="field-group"><label>Colores</label><input type="text" value="${escAttr(product.colors||'')}" oninput="updateProductField('${productId}','colors',this.value)"></div> </div> <div class="section-divider">Precios</div> <div class="price-block"> <div class="field-row"> <div class="field-group"><label>Precio Original ¥</label><input type="number" value="${escAttr(product.price||'')}" step="0.01" oninput="updateProductField('${productId}','price',this.value)"></div> <div class="field-group"><label>Precio Negociado ¥</label><input type="number" value="${escAttr(product.priceNegotiated||'')}" step="0.01" oninput="updateProductField('${productId}','priceNegotiated',this.value)"></div> </div> ${discount>0?`<span class="discount-badge">-${discount}% descuento</span>`:''} </div> <div class="section-divider">Especificaciones</div> <div class="field-row"> <div class="field-group"><label>MOQ</label><input type="text" value="${escAttr(product.moq||'')}" oninput="updateProductField('${productId}','moq',this.value)"></div> <div class="field-group"><label>Pcs/Caja</label><input type="text" value="${escAttr(product.pcsPerBox||'')}" oninput="updateProductField('${productId}','pcsPerBox',this.value)"></div> </div> <div class="field-row"> <div class="field-group"><label>Peso</label><input type="text" value="${escAttr(product.weight||'')}" oninput="updateProductField('${productId}','weight',this.value)"></div> <div class="field-group"><label>CBM m³</label><input type="text" value="${escAttr(product.cbm||'')}" oninput="updateProductField('${productId}','cbm',this.value)"></div> </div> <div class="field-group"><label>Pedido Sugerido</label><input type="number" value="${escAttr(product.suggestedOrder||'')}" oninput="updateProductField('${productId}','suggestedOrder',this.value)"></div> <div class="section-divider">Notas</div> <div class="field-group"><textarea rows="3" oninput="updateProductField('${productId}','notes',this.value)">${escHtml(product.notes||'')}</textarea></div> <button class="voice-btn" id="voice-btn-${productId}" onclick="toggleVoiceRecording('${productId}')">🎤 Nota de voz</button> ${product.voiceNote?`<div class="voice-player"><audio controls src="${product.voiceNote}"></audio></div>`:''} <div style="margin-top:24px"><button class="btn-danger" onclick="deleteProduct('${productId}')">🗑 Eliminar producto</button></div>`;
}

function updateProductField(productId,field,value) { const p=state.products.find(p=>p.id===productId); if(p) p[field]=value; }
function saveCurrentProduct() { saveLocalState(); showToast(‘✓ Guardado’,‘success’); }
function setProductStatus(productId,status) { const p=state.products.find(p=>p.id===productId); if(p){p.status=status;saveLocalState();renderProductDetail(productId);} }
function setProductPriority(productId,priority) { const p=state.products.find(p=>p.id===productId); if(p){p.priority=priority;saveLocalState();renderProductDetail(productId);} }
function deleteProduct(productId) { if(!confirm(’¿Eliminar este producto?’)) return; state.products=state.products.filter(p=>p.id!==productId); saveLocalState(); updateStats(); navigate(‘products’); showToast(‘Eliminado’); }

function changeProductPhoto(productId) {
const input=document.createElement(‘input’); input.type=‘file’; input.accept=‘image/*’; input.capture=‘environment’;
input.onchange=async()=>{ if(!input.files[0]) return; const base64=await fileToBase64(input.files[0]); const product=state.products.find(p=>p.id===productId); if(product){product.image=base64;showToast(‘Analizando…’); try{const data=await runProductOCR(base64);if(data.description)product.description=data.description;if(data.model)product.model=data.model;if(data.price)product.price=data.price;if(data.moq)product.moq=data.moq;}catch(e){}saveLocalState();showToast(‘✓ Foto actualizada’,‘success’);renderProductDetail(productId);}};
input.click();
}

function changeSupplierPhoto(supplierId) {
const input=document.createElement(‘input’); input.type=‘file’; input.accept=‘image/*’; input.capture=‘environment’;
input.onchange=async()=>{ if(!input.files[0]) return; const base64=await fileToBase64(input.files[0]); const s=state.suppliers.find(s=>s.id===supplierId); if(s){s.image=base64;saveLocalState();renderSupplierDetail(supplierId);showToast(‘✓ Foto actualizada’,‘success’);}};
input.click();
}

async function toggleVoiceRecording(productId) {
const btn=document.getElementById(‘voice-btn-’+productId);
if(!state.isRecording){
try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); state.mediaRecorder=new MediaRecorder(stream); state.audioChunks=[];
state.mediaRecorder.ondataavailable=e=>state.audioChunks.push(e.data);
state.mediaRecorder.onstop=()=>{ const blob=new Blob(state.audioChunks,{type:‘audio/webm’}); const url=URL.createObjectURL(blob); const product=state.products.find(p=>p.id===productId); if(product){product.voiceNote=url;saveLocalState();renderProductDetail(productId);} stream.getTracks().forEach(t=>t.stop()); };
state.mediaRecorder.start(); state.isRecording=true;
if(btn){btn.textContent=‘⏹ Detener grabación’;btn.classList.add(‘recording’);}
} catch(e){showToast(‘Micrófono no disponible’,‘error’);}
} else { state.mediaRecorder?.stop(); state.isRecording=false; if(btn){btn.textContent=‘🎤 Nota de voz’;btn.classList.remove(‘recording’);} }
}

function renderExport() {
const t=state.user.team, mp=state.products.filter(p=>p.team===t), ms=state.suppliers.filter(s=>s.team===t);
document.getElementById(‘export-content’).innerHTML=` <div class="export-card"><h3>📊 Resumen</h3><div class="export-summary"> <div class="export-row"><span>Total productos</span><span>${mp.length}</span></div> <div class="export-row"><span>Aprobados</span><span>${mp.filter(p=>p.status==='approved').length}</span></div> <div class="export-row"><span>Alta prioridad</span><span>${mp.filter(p=>p.priority==='high').length}</span></div> <div class="export-row"><span>Proveedores</span><span>${ms.length}</span></div> </div></div> <div class="export-card"><h3>📁 Exportar</h3><div class="export-options"> <button class="export-option" onclick="exportExcel('all')"><span class="opt-icon">📊</span><div class="opt-info"><div class="opt-title">Excel Completo</div><div class="opt-desc">Todos los productos</div></div><span style="color:var(--accent);font-size:20px">›</span></button> <button class="export-option" onclick="exportExcel('approved')"><span class="opt-icon">✅</span><div class="opt-info"><div class="opt-title">Solo Aprobados</div><div class="opt-desc">Productos aprobados</div></div><span style="color:var(--accent);font-size:20px">›</span></button> <button class="export-option" onclick="exportExcel('high')"><span class="opt-icon">🔴</span><div class="opt-info"><div class="opt-title">Alta Prioridad</div><div class="opt-desc">Solo alta prioridad</div></div><span style="color:var(--accent);font-size:20px">›</span></button> </div></div> <div id="export-progress" class="export-progress"><div id="export-progress-text" style="font-size:13px;color:var(--text2)">Generando...</div><div class="progress-bar-track"><div class="progress-bar-fill" id="export-bar" style="width:0%"></div></div></div>`;
}

async function exportExcel(filter) {
if(typeof XLSX===‘undefined’){showToast(‘Cargando librería…’,‘error’);return;}
const progressEl=document.getElementById(‘export-progress’), barEl=document.getElementById(‘export-bar’), textEl=document.getElementById(‘export-progress-text’);
progressEl.style.display=‘block’;
let products=state.products.filter(p=>p.team===state.user.team);
if(filter===‘approved’) products=products.filter(p=>p.status===‘approved’);
else if(filter===‘high’) products=products.filter(p=>p.priority===‘high’);
if(!products.length){showToast(‘Sin productos’,‘error’);progressEl.style.display=‘none’;return;}
products.sort((a,b)=>(a.supplierName||’’).localeCompare(b.supplierName||’’));
const wb=XLSX.utils.book_new(), headers=[‘Proveedor’,‘Stand’,‘Descripción’,‘Modelo’,‘Precio ¥’,‘Precio Negociado’,‘Descuento %’,‘MOQ’,‘Pcs/Caja’,‘Peso’,‘Medidas’,‘CBM’,‘Colores’,‘Pedido Sugerido’,‘Prioridad’,‘Estado’,‘Capturado por’,‘Notas’,‘Fecha’], rows=[headers];
let currentSupplier=’’;
for(let i=0;i<products.length;i++){
const p=products[i]; barEl.style.width=`${Math.round((i/products.length)*90)}%`; textEl.textContent=`Procesando ${i+1}/${products.length}...`;
if(p.supplierName!==currentSupplier){currentSupplier=p.supplierName;rows.push([`▶ PROVEEDOR: ${currentSupplier}`,…Array(18).fill(’’)]);}
const orig=parseFloat(p.price)||0, neg=parseFloat(p.priceNegotiated)||0, discount=(orig&&neg&&neg<orig)?`${Math.round((1-neg/orig)*100)}%`:’’;
rows.push([p.supplierName||’’,p.booth||’’,p.description||’’,p.model||’’,p.price||’’,p.priceNegotiated||’’,discount,p.moq||’’,p.pcsPerBox||’’,p.weight||’’,p.dimensions||’’,p.cbm||’’,p.colors||’’,p.suggestedOrder||’’,p.priority||’’,p.status||’’,p.createdBy||’’,p.notes||’’,new Date(p.createdAt).toLocaleDateString()]);
if(i%10===0) await new Promise(r=>setTimeout(r,10));
}
const ws=XLSX.utils.aoa_to_sheet(rows); ws[’!cols’]=headers.map(()=>({wch:16}));
XLSX.utils.book_append_sheet(wb,ws,‘Productos’); barEl.style.width=‘100%’; textEl.textContent=‘Descargando…’;
await new Promise(r=>setTimeout(r,300));
XLSX.writeFile(wb,`BuyTrip_${state.user.team}_${new Date().toISOString().split('T')[0]}.xlsx`);
progressEl.style.display=‘none’; showToast(‘✓ Excel descargado’,‘success’);
}

async function syncData() { showToast(‘Configura Supabase para sincronizar’,‘error’); }

function genId() { return Date.now().toString(36)+Math.random().toString(36).substring(2,8); }
function escHtml(str) { if(!str) return ‘’; return String(str).replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’); }
function escAttr(str) { if(!str) return ‘’; return String(str).replace(/”/g,’"’).replace(/’/g,’'’); }
async function fileToBase64(file) { return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(file);}); }
function showToast(msg,type=’’) { const t=document.getElementById(‘toast’); t.textContent=msg; t.className=`toast ${type}`; t.classList.remove(‘hidden’); setTimeout(()=>t.classList.add(‘hidden’),2500); }
function closeModal(id) { document.getElementById(id).classList.add(‘hidden’); }
let currentRating=0;
function setRating(n) { currentRating=n; document.getElementById(‘s-rating-val’).value=n; updateStarUI(n); }
function updateStarUI(n) { document.querySelectorAll(’#s-rating span’).forEach((s,i)=>s.classList.toggle(‘active’,i<n)); }
function setLang(lang) { state.lang=lang; saveLocalState(); applyLang(); }
function applyLang() { document.querySelectorAll(’[data-es],[data-en]’).forEach(el=>{const txt=el.getAttribute(`data-${state.lang}`);if(txt)el.textContent=txt;}); document.getElementById(‘btn-es’)?.classList.toggle(‘active’,state.lang===‘es’); document.getElementById(‘btn-en’)?.classList.toggle(‘active’,state.lang===‘en’); }
if(‘serviceWorker’ in navigator){window.addEventListener(‘load’,()=>{navigator.serviceWorker.register(‘service-worker.js’).catch(()=>{});});}
