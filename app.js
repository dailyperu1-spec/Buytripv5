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
if (!team) { showToast(‘Ingresa el codigo de equipo’,‘error’); return; }
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

const SCREEN_MAP = {
home:‘screen-home’, visits:‘screen-visits’, suppliers:‘screen-suppliers’,
products:‘screen-products’, export:‘screen-export’,
‘supplier-detail’:‘screen-supplier-detail’, ‘product-detail’:‘screen-product-detail’
};

function navigate(screen, options) {
options = options || {};
Object.values(SCREEN_MAP).forEach(function(id) { var el=document.getElementById(id); if(el) el.classList.remove(‘active’); });
var target = document.getElementById(SCREEN_MAP[screen]);
if (target) target.classList.add(‘active’);
var titles = { home:‘Inicio’, visits:‘Visitas’, suppliers:‘Proveedores’, products:‘Productos’, export:‘Exportar’, ‘supplier-detail’:‘Proveedor’, ‘product-detail’:‘Producto’ };
document.getElementById(‘topbar-title’).textContent = titles[screen] || ‘BuyTrip’;
document.querySelectorAll(’.nav-btn’).forEach(function(b) { b.classList.remove(‘active’); });
var navEl = document.getElementById(‘nav-’+screen);
if (navEl) navEl.classList.add(‘active’);
if (screen===‘home’) renderHome();
else if (screen===‘visits’) renderVisits();
else if (screen===‘suppliers’) renderSuppliers();
else if (screen===‘products’) renderProducts();
else if (screen===‘export’) renderExport();
else if (screen===‘supplier-detail’ && options.supplierId) renderSupplierDetail(options.supplierId);
else if (screen===‘product-detail’ && options.productId) renderProductDetail(options.productId);
}

function renderHome() {
var hour = new Date().getHours();
var greet = hour<12 ? ‘Buenos dias,’ : hour<18 ? ‘Buenas tardes,’ : ‘Buenas noches,’;
var greetEl = document.getElementById(‘home-greeting’);
if (greetEl) greetEl.textContent = greet + ’ ’ + (state.user ? state.user.name : ‘’);
var dateEl = document.getElementById(‘home-date’);
if (dateEl) dateEl.textContent = new Date().toLocaleDateString(‘es-ES’,{weekday:‘long’,year:‘numeric’,month:‘long’,day:‘numeric’}).toUpperCase();
updateStats();
var team = state.user ? state.user.team : ‘’;
var recent = state.products.filter(function(p){return p.team===team;}).sort(function(a,b){return b.createdAt-a.createdAt;}).slice(0,5);
var container = document.getElementById(‘recent-products-list’);
if (container) container.innerHTML = recent.length ? recent.map(productCardHTML).join(’’) : ‘<div class="empty-state"><div class="empty-icon">📦</div><div>Sin productos aun</div></div>’;
}

function updateStats() {
var t = state.user ? state.user.team : ‘’;
document.getElementById(‘stat-visits’).textContent = state.visits.filter(function(v){return v.team===t;}).length;
document.getElementById(‘stat-suppliers’).textContent = state.suppliers.filter(function(s){return s.team===t;}).length;
document.getElementById(‘stat-products’).textContent = state.products.filter(function(p){return p.team===t;}).length;
}

function renderVisits() {
var list = document.getElementById(‘visits-list’);
var items = state.visits.filter(function(v){return v.team===state.user.team;}).sort(function(a,b){return b.createdAt-a.createdAt;});
if (!items.length) { list.innerHTML=’<div class="empty-state"><div class="empty-icon">📋</div><div>No hay visitas</div></div>’; return; }
list.innerHTML = items.map(function(v) {
var sc=state.suppliers.filter(function(s){return s.visitId===v.id;}).length;
var pc=state.products.filter(function(p){return p.visitId===v.id;}).length;
var isActive=state.activeVisit===v.id;
return ‘<div class="visit-item '+(isActive?'active-visit':'')+'" onclick="selectVisit(\''+v.id+'\')">’
+’<div class="item-icon">📋</div>’
+’<div class="item-info">’
+’<div class="item-name">’+escHtml(v.name)+(isActive?’<span class="visit-badge">ACTIVA</span>’:’’)+’</div>’
+’<div class="item-sub">📍 ‘+escHtml(v.city)+’</div>’
+’<div class="item-meta">’+new Date(v.createdAt).toLocaleDateString()+’ · ‘+sc+’ proveedores · ‘+pc+’ productos</div>’
+’</div><div class="item-arrow">›</div></div>’;
}).join(’’);
}

function showNewVisitModal() { document.getElementById(‘modal-visit’).classList.remove(‘hidden’); }

function createVisit() {
var name = document.getElementById(‘v-name’).value.trim();
if (!name) { showToast(‘Ingresa un nombre’,‘error’); return; }
var visit = { id:genId(), team:state.user.team, createdBy:state.user.name, name:name,
city:document.getElementById(‘v-city’).value,
market:document.getElementById(‘v-market’).value.trim(),
notes:document.getElementById(‘v-notes’).value.trim(),
date:new Date().toISOString().split(‘T’)[0], createdAt:Date.now() };
state.visits.push(visit); state.activeVisit = visit.id; saveLocalState();
closeModal(‘modal-visit’); showToast(‘Visita creada’,‘success’);
renderVisits(); updateStats(); renderHome();
[‘v-name’,‘v-market’,‘v-notes’].forEach(function(id){ document.getElementById(id).value=’’; });
}

function selectVisit(id) { state.activeVisit=id; saveLocalState(); renderVisits(); renderHome(); showToast(‘Visita activada’,‘success’); }

function renderSuppliers(filter) {
filter = filter || ‘’;
var list = document.getElementById(‘suppliers-list’);
var items = state.suppliers.filter(function(s){return s.team===state.user.team;});
if (filter) { var f=filter.toLowerCase(); items=items.filter(function(s){return (s.name||’’).toLowerCase().indexOf(f)>=0||(s.booth||’’).toLowerCase().indexOf(f)>=0;}); }
items.sort(function(a,b){return b.createdAt-a.createdAt;});
if (!items.length) { list.innerHTML=’<div class="empty-state"><div class="empty-icon">🏪</div><div>Sin proveedores</div></div>’; return; }
list.innerHTML = items.map(function(s) {
var pc=state.products.filter(function(p){return p.supplierId===s.id;}).length;
return ‘<div class="supplier-item" onclick="openSupplierDetail(\''+s.id+'\')">’
+(s.image?’<div style="width:48px;height:48px;overflow:hidden;border-radius:8px;flex-shrink:0"><img src="'+s.image+'" style="width:100%;height:100%;object-fit:cover"></div>’:’<div class="item-icon">🏪</div>’)
+’<div class="item-info"><div class="item-name">’+escHtml(s.name||‘Sin nombre’)+’</div>’
+’<div class="item-sub">’+escHtml(s.booth||’’)+’ ‘+(s.category?’· ‘+escHtml(s.category):’’)+’</div></div>’
+’<div class="item-count">’+pc+’</div><div class="item-arrow">›</div></div>’;
}).join(’’);
}

function filterSuppliers(val) { renderSuppliers(val); }

function showNewSupplierModal() {
[‘s-name’,‘s-booth’,‘s-contact’,‘s-wechat’,‘s-category’,‘s-notes’].forEach(function(id){document.getElementById(id).value=’’;});
document.getElementById(‘s-rating-val’).value=‘0’; updateStarUI(0);
document.getElementById(‘supplier-card-preview’).innerHTML=’<div class="photo-icon">📷</div><div>Foto de tarjeta del proveedor</div><small>La IA llenara los campos</small>’;
state.currentSupplierCardPhoto=null;
document.getElementById(‘modal-supplier’).classList.remove(‘hidden’);
}

function captureSupplierCard() { document.getElementById(‘file-supplier-card’).click(); }

function handleSupplierCardFile(input) {
var file=input.files[0]; if(!file) return;
fileToBase64(file).then(function(base64) {
state.currentSupplierCardPhoto=base64;
document.getElementById(‘supplier-card-preview’).innerHTML=’<img src="'+base64+'" style="max-height:160px;object-fit:contain;width:100%">’;
runSupplierCardOCR(base64);
});
input.value=’’;
}

function runSupplierCardOCR(base64) {
var statusEl=document.getElementById(‘supplier-ocr-status’); statusEl.classList.remove(‘hidden’);
callClaudeOCR(base64,‘Analyze this business card from a Chinese wholesale market. Return ONLY JSON no markdown: {“name”:“company”,“booth”:“booth number”,“contact”:“person”,“wechat”:“wechat or phone”,“category”:“product type”}. Use empty string for missing fields.’)
.then(function(result) {
if(result) {
if(result.name) document.getElementById(‘s-name’).value=result.name;
if(result.booth) document.getElementById(‘s-booth’).value=result.booth;
if(result.contact) document.getElementById(‘s-contact’).value=result.contact;
if(result.wechat) document.getElementById(‘s-wechat’).value=result.wechat;
if(result.category) document.getElementById(‘s-category’).value=result.category;
showToast(‘Tarjeta analizada’,‘success’);
}
}).catch(function() { showToast(‘Completa los campos manualmente’,‘error’); })
.finally(function() { statusEl.classList.add(‘hidden’); });
}

function createSupplier() {
var name=document.getElementById(‘s-name’).value.trim();
if(!name) { showToast(‘Ingresa el nombre’,‘error’); return; }
var supplier={ id:genId(), team:state.user.team, visitId:state.activeVisit, createdBy:state.user.name, name:name,
booth:document.getElementById(‘s-booth’).value.trim(),
contact:document.getElementById(‘s-contact’).value.trim(),
wechat:document.getElementById(‘s-wechat’).value.trim(),
category:document.getElementById(‘s-category’).value.trim(),
notes:document.getElementById(‘s-notes’).value.trim(),
rating:parseInt(document.getElementById(‘s-rating-val’).value)||0,
image:state.currentSupplierCardPhoto||null, createdAt:Date.now() };
state.suppliers.push(supplier); state.currentSupplierCardPhoto=null; saveLocalState();
closeModal(‘modal-supplier’); showToast(‘Proveedor creado’,‘success’);
navigate(‘supplier-detail’,{supplierId:supplier.id}); updateStats();
}

function openSupplierDetail(id) { state.currentSupplier=id; navigate(‘supplier-detail’,{supplierId:id}); }

function renderSupplierDetail(supplierId) {
var supplier=state.suppliers.find(function(s){return s.id===supplierId;}); if(!supplier) return;
state.currentSupplier=supplierId;
document.getElementById(‘supplier-detail-title’).textContent=supplier.name||‘Proveedor’;
var products=state.products.filter(function(p){return p.supplierId===supplierId;}).sort(function(a,b){return b.createdAt-a.createdAt;});
document.getElementById(‘supplier-detail-content’).innerHTML=
‘<div class="supplier-header-card">’
+’<div class="supplier-photo" onclick="changeSupplierPhoto(\''+supplierId+'\')">’+(supplier.image?’<img src="'+supplier.image+'" alt="supplier">’:‘🏪’)+’</div>’
+’<div class="supplier-info-grid">’
+’<div class="supplier-info-item"><label>Stand</label><span>’+escHtml(supplier.booth||’—’)+’</span></div>’
+’<div class="supplier-info-item"><label>Contacto</label><span>’+escHtml(supplier.contact||’—’)+’</span></div>’
+’<div class="supplier-info-item"><label>WeChat</label><span>’+escHtml(supplier.wechat||’—’)+’</span></div>’
+’<div class="supplier-info-item"><label>Categoria</label><span>’+escHtml(supplier.category||’—’)+’</span></div>’
+(supplier.notes?’<div class="supplier-info-item" style="grid-column:1/-1"><label>Notas</label><span>’+escHtml(supplier.notes)+’</span></div>’:’’)
+’</div></div>’
+’<div class="supplier-products-header"><h3>Productos (’+products.length+’)</h3><button class="add-btn" onclick="addProductToCurrentSupplier()">📷</button></div>’
+’<div style="display:flex;flex-direction:column;gap:10px">’
+(products.length ? products.map(productCardHTML).join(’’) : ‘<div class="empty-state"><div class="empty-icon">📦</div><div>Sin productos</div><p>Toca la camara para agregar</p></div>’)
+’</div>’;
}

function addProductToCurrentSupplier() { state.pendingSupplierIdForProduct=state.currentSupplier; showProductCapture(); }

function productCardHTML(product) {
var sL={pending:‘Pendiente’,approved:‘Aprobado’,discarded:‘Descartado’};
var pL={high:‘Alta’,medium:‘Media’,low:‘Baja’};
return ‘<div class="product-card status-'+(product.status||'pending')+' priority-'+(product.priority||'medium')+'" onclick="openProductDetail(\''+product.id+'\')">’
+’<div class="product-thumb">’+(product.image?’<img src="'+product.image+'" alt="product">’:‘📦’)+’</div>’
+’<div class="product-info">’
+’<div class="product-name">’+escHtml(product.description||‘Sin descripcion’)+’</div>’
+(product.model?’<div class="product-model">’+escHtml(product.model)+’</div>’:’’)
+’<div class="product-price">Y’+(product.priceNegotiated||product.price||’—’)+’</div>’
+’<div class="product-tags">’
+’<span class="tag tag-'+(product.status||'pending')+'">’+(sL[product.status||‘pending’])+’</span>’
+’<span class="tag tag-'+(product.priority||'medium')+'">’+(pL[product.priority||‘medium’])+’</span>’
+(product.moq?’<span class="tag" style="background:var(--bg3);color:var(--text2)">MOQ ‘+product.moq+’</span>’:’’)
+’</div></div></div>’;
}

function renderProducts(filter) {
filter = filter || ‘all’;
var list=document.getElementById(‘products-list’);
var items=state.products.filter(function(p){return p.team===state.user.team;});
if(filter===‘approved’) items=items.filter(function(p){return p.status===‘approved’;});
else if(filter===‘pending’) items=items.filter(function(p){return p.status===‘pending’;});
else if(filter===‘high’) items=items.filter(function(p){return p.priority===‘high’;});
else if(filter===‘discarded’) items=items.filter(function(p){return p.status===‘discarded’;});
items.sort(function(a,b){return b.createdAt-a.createdAt;});
list.innerHTML=items.length ? items.map(productCardHTML).join(’’) : ‘<div class="empty-state"><div class="empty-icon">📦</div><div>Sin productos</div></div>’;
}

function filterProducts(val) { renderProducts(val); }

function showProductCapture() {
var sel=document.getElementById(‘p-supplier-select’);
var suppliers=state.suppliers.filter(function(s){return s.team===state.user.team;});
sel.innerHTML=suppliers.map(function(s){
return ‘<option value=”’+s.id+’”’+(s.id===state.pendingSupplierIdForProduct?’ selected’:’’)+’>’+escHtml(s.name)+’</option>’;
}).join(’’)||’<option value="">Crea un proveedor primero</option>’;
document.getElementById(‘product-photo-preview’).innerHTML=’<div class="photo-icon big">📷</div><div>Toca para tomar foto</div>’;
state.currentProductPhoto=null;
document.getElementById(‘product-ocr-status’).classList.add(‘hidden’);
document.getElementById(‘modal-capture’).classList.remove(‘hidden’);
}

function captureProductPhoto() { document.getElementById(‘file-product-photo’).click(); }

function handleProductPhotoFile(input) {
var file=input.files[0]; if(!file) return;
fileToBase64(file).then(function(base64) {
state.currentProductPhoto=base64;
document.getElementById(‘product-photo-preview’).innerHTML=’<img src="'+base64+'" class="photo-preview-img">’;
});
input.value=’’;
}

function analyzeAndCreate() {
if(!state.currentProductPhoto) { showToast(‘Toma una foto primero’,‘error’); return; }
var supplierId=document.getElementById(‘p-supplier-select’).value;
if(!supplierId) { showToast(‘Selecciona un proveedor’,‘error’); return; }
var statusEl=document.getElementById(‘product-ocr-status’);
var btn=document.getElementById(‘btn-analyze’);
statusEl.classList.remove(‘hidden’); btn.disabled=true;
runProductOCR(state.currentProductPhoto).then(function(data) {
var supplier=state.suppliers.find(function(s){return s.id===supplierId;});
var product={ id:genId(), team:state.user.team, visitId:state.activeVisit, supplierId:supplierId,
supplierName:supplier?supplier.name:’’, createdBy:state.user.name,
image:state.currentProductPhoto, status:‘pending’, priority:‘medium’, createdAt:Date.now(),
description:data.description||’’, model:data.model||’’, price:data.price||’’,
priceNegotiated:data.price||’’, moq:data.moq||’’, pcsPerBox:data.pcsPerBox||’’,
weight:data.weight||’’, dimensions:data.dimensions||’’, cbm:data.cbm||’’,
colors:data.colors||’’, notes:’’, voiceNote:null, suggestedOrder:’’ };
state.products.push(product); state.currentProductPhoto=null; state.pendingSupplierIdForProduct=null;
saveLocalState(); closeModal(‘modal-capture’); showToast(‘Producto capturado’,‘success’); updateStats();
openProductDetail(product.id);
}).catch(function() {
showToast(‘Error al analizar’,‘error’);
}).finally(function() {
statusEl.classList.add(‘hidden’); btn.disabled=false;
});
}

function runProductOCR(base64) {
return callClaudeOCR(base64,‘Analyze this product photo from a Chinese wholesale market. Return ONLY JSON no markdown: {“description”:“product description”,“model”:“model code”,“price”:“RMB price number only”,“moq”:“min order number only”,“pcsPerBox”:“pieces per box number only”,“weight”:“weight with units”,“dimensions”:“dimensions”,“cbm”:“cubic meters number only”,“colors”:“colors”}. Use empty string for missing. Example: DM5-083 Y0.7 x864 18.2g 600g/box 24pcs/box 0.12m3’);
}

function callClaudeOCR(base64, prompt) {
if(CONFIG.CLAUDE_API_KEY===‘YOUR_CLAUDE_API_KEY’) {
return Promise.resolve({description:‘Producto demo’,model:‘MOD-001’,price:‘1.50’,moq:‘100’,pcsPerBox:‘24’,weight:‘50g’,dimensions:‘10cm’,cbm:‘0.05’,colors:‘Varios’});
}
var mimeMatch=base64.match(/^data:([^;]+);base64,/);
var mediaType=mimeMatch?mimeMatch[1]:‘image/jpeg’;
var imageData=base64.replace(/^data:[^;]+;base64,/,’’);
return fetch(‘https://api.anthropic.com/v1/messages’,{
method:‘POST’,
headers:{‘Content-Type’:‘application/json’,‘x-api-key’:CONFIG.CLAUDE_API_KEY,‘anthropic-version’:‘2023-06-01’},
body:JSON.stringify({model:‘claude-opus-4-5’,max_tokens:1000,messages:[{role:‘user’,content:[{type:‘image’,source:{type:‘base64’,media_type:mediaType,data:imageData}},{type:‘text’,text:prompt}]}]})
}).then(function(r){return r.json();}).then(function(d){
var text=(d.content&&d.content[0]?d.content[0].text:null)||’{}’;
text=text.replace(/`json/g,'').replace(/`/g,’’).trim();
try{return JSON.parse(text);}catch(e){return {};}
});
}

function openProductDetail(id) { state.currentProduct=id; navigate(‘product-detail’,{productId:id}); }

function renderProductDetail(productId) {
var product=state.products.find(function(p){return p.id===productId;}); if(!product) return;
var discount=0;
if(product.price&&product.priceNegotiated) discount=Math.round((1-parseFloat(product.priceNegotiated)/parseFloat(product.price))*100);
document.getElementById(‘product-detail-content’).innerHTML=
‘<div class="product-image-header" onclick="changeProductPhoto(\''+productId+'\')">’
+(product.image?’<img src="'+product.image+'" alt="product">’:‘📦’)
+’<div class="change-photo-hint">📷 Cambiar</div></div>’
+’<div class="section-divider">Estado</div>’
+’<div class="status-selector">’
+’<button class="status-btn '+(product.status==='pending'?'active-pending':'')+'" onclick="setProductStatus(\''+productId+'\',\'pending\')">Pendiente</button>’
+’<button class="status-btn '+(product.status==='approved'?'active-approved':'')+'" onclick="setProductStatus(\''+productId+'\',\'approved\')">Aprobado</button>’
+’<button class="status-btn '+(product.status==='discarded'?'active-discarded':'')+'" onclick="setProductStatus(\''+productId+'\',\'discarded\')">Descartar</button>’
+’</div>’
+’<div class="section-divider">Prioridad</div>’
+’<div class="priority-selector">’
+’<button class="priority-btn '+(product.priority==='high'?'active-high':'')+'" onclick="setProductPriority(\''+productId+'\',\'high\')">Alta</button>’
+’<button class="priority-btn '+(product.priority==='medium'?'active-medium':'')+'" onclick="setProductPriority(\''+productId+'\',\'medium\')">Media</button>’
+’<button class="priority-btn '+(product.priority==='low'?'active-low':'')+'" onclick="setProductPriority(\''+productId+'\',\'low\')">Baja</button>’
+’</div>’
+’<div class="section-divider">Informacion</div>’
+’<div class="field-group"><label>Descripcion</label><input type="text" value="'+escAttr(product.description||'')+'" oninput="updateProductField(\''+productId+'\',\'description\',this.value)"></div>’
+’<div class="field-row">’
+’<div class="field-group"><label>Modelo</label><input type="text" value="'+escAttr(product.model||'')+'" oninput="updateProductField(\''+productId+'\',\'model\',this.value)"></div>’
+’<div class="field-group"><label>Colores</label><input type="text" value="'+escAttr(product.colors||'')+'" oninput="updateProductField(\''+productId+'\',\'colors\',this.value)"></div>’
+’</div>’
+’<div class="section-divider">Precios</div>’
+’<div class="price-block"><div class="field-row">’
+’<div class="field-group"><label>Precio Original Y</label><input type="number" value="'+escAttr(product.price||'')+'" step="0.01" oninput="updateProductField(\''+productId+'\',\'price\',this.value)"></div>’
+’<div class="field-group"><label>Precio Negociado Y</label><input type="number" value="'+escAttr(product.priceNegotiated||'')+'" step="0.01" oninput="updateProductField(\''+productId+'\',\'priceNegotiated\',this.value)"></div>’
+’</div>’+(discount>0?’<span class="discount-badge">-’+discount+’% descuento</span>’:’’)+’</div>’
+’<div class="section-divider">Especificaciones</div>’
+’<div class="field-row">’
+’<div class="field-group"><label>MOQ</label><input type="text" value="'+escAttr(product.moq||'')+'" oninput="updateProductField(\''+productId+'\',\'moq\',this.value)"></div>’
+’<div class="field-group"><label>Pcs/Caja</label><input type="text" value="'+escAttr(product.pcsPerBox||'')+'" oninput="updateProductField(\''+productId+'\',\'pcsPerBox\',this.value)"></div>’
+’</div><div class="field-row">’
+’<div class="field-group"><label>Peso</label><input type="text" value="'+escAttr(product.weight||'')+'" oninput="updateProductField(\''+productId+'\',\'weight\',this.value)"></div>’
+’<div class="field-group"><label>CBM m3</label><input type="text" value="'+escAttr(product.cbm||'')+'" oninput="updateProductField(\''+productId+'\',\'cbm\',this.value)"></div>’
+’</div>’
+’<div class="field-group"><label>Pedido Sugerido</label><input type="number" value="'+escAttr(product.suggestedOrder||'')+'" oninput="updateProductField(\''+productId+'\',\'suggestedOrder\',this.value)"></div>’
+’<div class="section-divider">Notas</div>’
+’<div class="field-group"><textarea rows="3" oninput="updateProductField(\''+productId+'\',\'notes\',this.value)">’+escHtml(product.notes||’’)+’</textarea></div>’
+’<button class="voice-btn" id="voice-btn-'+productId+'" onclick="toggleVoiceRecording(\''+productId+'\')">Nota de voz</button>’
+(product.voiceNote?’<div class="voice-player"><audio controls src="'+product.voiceNote+'"></audio></div>’:’’)
+’<div style="margin-top:24px"><button class="btn-danger" onclick="deleteProduct(\''+productId+'\')">Eliminar producto</button></div>’;
}

function updateProductField(productId,field,value) { var p=state.products.find(function(p){return p.id===productId;}); if(p) p[field]=value; }
function saveCurrentProduct() { saveLocalState(); showToast(‘Guardado’,‘success’); }
function setProductStatus(productId,status) { var p=state.products.find(function(p){return p.id===productId;}); if(p){p.status=status;saveLocalState();renderProductDetail(productId);} }
function setProductPriority(productId,priority) { var p=state.products.find(function(p){return p.id===productId;}); if(p){p.priority=priority;saveLocalState();renderProductDetail(productId);} }
function deleteProduct(productId) { if(!confirm(‘Eliminar este producto?’)) return; state.products=state.products.filter(function(p){return p.id!==productId;}); saveLocalState(); updateStats(); navigate(‘products’); showToast(‘Eliminado’); }

function changeProductPhoto(productId) {
var input=document.createElement(‘input’); input.type=‘file’; input.accept=‘image/*’; input.capture=‘environment’;
input.onchange=function(){
if(!input.files[0]) return;
fileToBase64(input.files[0]).then(function(base64) {
var product=state.products.find(function(p){return p.id===productId;});
if(product){
product.image=base64; showToast(‘Analizando…’);
runProductOCR(base64).then(function(data){
if(data.description) product.description=data.description;
if(data.model) product.model=data.model;
if(data.price) product.price=data.price;
if(data.moq) product.moq=data.moq;
saveLocalState(); showToast(‘Foto actualizada’,‘success’); renderProductDetail(productId);
}).catch(function(){ saveLocalState(); showToast(‘Foto actualizada’,‘success’); renderProductDetail(productId); });
}
});
};
input.click();
}

function changeSupplierPhoto(supplierId) {
var input=document.createElement(‘input’); input.type=‘file’; input.accept=‘image/*’; input.capture=‘environment’;
input.onchange=function(){
if(!input.files[0]) return;
fileToBase64(input.files[0]).then(function(base64){
var s=state.suppliers.find(function(s){return s.id===supplierId;});
if(s){s.image=base64;saveLocalState();renderSupplierDetail(supplierId);showToast(‘Foto actualizada’,‘success’);}
});
};
input.click();
}

function toggleVoiceRecording(productId) {
var btn=document.getElementById(‘voice-btn-’+productId);
if(!state.isRecording){
navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
state.mediaRecorder=new MediaRecorder(stream); state.audioChunks=[];
state.mediaRecorder.ondataavailable=function(e){state.audioChunks.push(e.data);};
state.mediaRecorder.onstop=function(){
var blob=new Blob(state.audioChunks,{type:‘audio/webm’});
var url=URL.createObjectURL(blob);
var product=state.products.find(function(p){return p.id===productId;});
if(product){product.voiceNote=url;saveLocalState();renderProductDetail(productId);}
stream.getTracks().forEach(function(t){t.stop();});
};
state.mediaRecorder.start(); state.isRecording=true;
if(btn){btn.textContent=‘Detener grabacion’;btn.classList.add(‘recording’);}
}).catch(function(){showToast(‘Microfono no disponible’,‘error’);});
} else {
if(state.mediaRecorder) state.mediaRecorder.stop();
state.isRecording=false;
if(btn){btn.textContent=‘Nota de voz’;btn.classList.remove(‘recording’);}
}
}

function renderExport() {
var t=state.user.team;
var mp=state.products.filter(function(p){return p.team===t;});
var ms=state.suppliers.filter(function(s){return s.team===t;});
document.getElementById(‘export-content’).innerHTML=
‘<div class="export-card"><h3>Resumen</h3><div class="export-summary">’
+’<div class="export-row"><span>Total productos</span><span>’+mp.length+’</span></div>’
+’<div class="export-row"><span>Aprobados</span><span>’+mp.filter(function(p){return p.status===‘approved’;}).length+’</span></div>’
+’<div class="export-row"><span>Alta prioridad</span><span>’+mp.filter(function(p){return p.priority===‘high’;}).length+’</span></div>’
+’<div class="export-row"><span>Proveedores</span><span>’+ms.length+’</span></div>’
+’</div></div>’
+’<div class="export-card"><h3>Exportar</h3><div class="export-options">’
+’<button class="export-option" onclick="exportExcel(\'all\')"><span class="opt-icon">📊</span><div class="opt-info"><div class="opt-title">Excel Completo</div><div class="opt-desc">Todos los productos</div></div><span style="color:var(--accent);font-size:20px">›</span></button>’
+’<button class="export-option" onclick="exportExcel(\'approved\')"><span class="opt-icon">✅</span><div class="opt-info"><div class="opt-title">Solo Aprobados</div><div class="opt-desc">Productos aprobados</div></div><span style="color:var(--accent);font-size:20px">›</span></button>’
+’<button class="export-option" onclick="exportExcel(\'high\')"><span class="opt-icon">🔴</span><div class="opt-info"><div class="opt-title">Alta Prioridad</div><div class="opt-desc">Solo alta prioridad</div></div><span style="color:var(--accent);font-size:20px">›</span></button>’
+’</div></div>’
+’<div id="export-progress" class="export-progress"><div id="export-progress-text" style="font-size:13px;color:var(--text2)">Generando…</div>’
+’<div class="progress-bar-track"><div class="progress-bar-fill" id="export-bar" style="width:0%"></div></div></div>’;
}

function exportExcel(filter) {
if(typeof XLSX===‘undefined’){showToast(‘Cargando libreria…’,‘error’);return;}
var progressEl=document.getElementById(‘export-progress’);
var barEl=document.getElementById(‘export-bar’);
var textEl=document.getElementById(‘export-progress-text’);
progressEl.style.display=‘block’;
var products=state.products.filter(function(p){return p.team===state.user.team;});
if(filter===‘approved’) products=products.filter(function(p){return p.status===‘approved’;});
else if(filter===‘high’) products=products.filter(function(p){return p.priority===‘high’;});
if(!products.length){showToast(‘Sin productos’,‘error’);progressEl.style.display=‘none’;return;}
products.sort(function(a,b){return (a.supplierName||’’).localeCompare(b.supplierName||’’);});
var wb=XLSX.utils.book_new();
var headers=[‘Proveedor’,‘Stand’,‘Descripcion’,‘Modelo’,‘Precio Y’,‘Precio Negociado’,‘Descuento %’,‘MOQ’,‘Pcs/Caja’,‘Peso’,‘Medidas’,‘CBM’,‘Colores’,‘Pedido Sugerido’,‘Prioridad’,‘Estado’,‘Capturado por’,‘Notas’,‘Fecha’];
var rows=[headers];
var currentSupplier=’’;
for(var i=0;i<products.length;i++){
var p=products[i];
barEl.style.width=Math.round((i/products.length)*90)+’%’;
textEl.textContent=‘Procesando ‘+(i+1)+’/’+products.length+’…’;
if(p.supplierName!==currentSupplier){
currentSupplier=p.supplierName;
rows.push([‘PROVEEDOR: ‘+currentSupplier,’’,’’,’’,’’,’’,’’,’’,’’,’’,’’,’’,’’,’’,’’,’’,’’,’’,’’]);
}
var orig=parseFloat(p.price)||0, neg=parseFloat(p.priceNegotiated)||0;
var discount=(orig&&neg&&neg<orig)?Math.round((1-neg/orig)*100)+’%’:’’;
rows.push([p.supplierName||’’,p.booth||’’,p.description||’’,p.model||’’,p.price||’’,p.priceNegotiated||’’,discount,p.moq||’’,p.pcsPerBox||’’,p.weight||’’,p.dimensions||’’,p.cbm||’’,p.colors||’’,p.suggestedOrder||’’,p.priority||’’,p.status||’’,p.createdBy||’’,p.notes||’’,new Date(p.createdAt).toLocaleDateString()]);
}
var ws=XLSX.utils.aoa_to_sheet(rows);
ws[’!cols’]=headers.map(function(){return {wch:16};});
XLSX.utils.book_append_sheet(wb,ws,‘Productos’);
barEl.style.width=‘100%’; textEl.textContent=‘Descargando…’;
XLSX.writeFile(wb,‘BuyTrip_’+state.user.team+’_’+new Date().toISOString().split(‘T’)[0]+’.xlsx’);
progressEl.style.display=‘none’; showToast(‘Excel descargado’,‘success’);
}

function syncData() { showToast(‘Configura Supabase para sincronizar’,‘error’); }

function genId() { return Date.now().toString(36)+Math.random().toString(36).substring(2,8); }

function escHtml(str) {
if(!str) return ‘’;
return String(str).replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’);
}

function escAttr(str) {
if(!str) return ‘’;
return String(str).replace(/”/g,’"’).replace(/’/g,’'’);
}

function fileToBase64(file) {
return new Promise(function(res,rej){
var r=new FileReader();
r.onload=function(e){res(e.target.result);};
r.onerror=rej;
r.readAsDataURL(file);
});
}

function showToast(msg,type) {
type = type || ‘’;
var t=document.getElementById(‘toast’);
t.textContent=msg; t.className=’toast ’+type; t.classList.remove(‘hidden’);
setTimeout(function(){t.classList.add(‘hidden’);},2500);
}

function closeModal(id) { document.getElementById(id).classList.add(‘hidden’); }

var currentRating=0;
function setRating(n) { currentRating=n; document.getElementById(‘s-rating-val’).value=n; updateStarUI(n); }
function updateStarUI(n) { document.querySelectorAll(’#s-rating span’).forEach(function(s,i){s.classList.toggle(‘active’,i<n);}); }
function setLang(lang) { state.lang=lang; saveLocalState(); applyLang(); }
function applyLang() {
document.querySelectorAll(’[data-es],[data-en]’).forEach(function(el){var txt=el.getAttribute(‘data-’+state.lang);if(txt)el.textContent=txt;});
var bes=document.getElementById(‘btn-es’); if(bes) bes.classList.toggle(‘active’,state.lang===‘es’);
var ben=document.getElementById(‘btn-en’); if(ben) ben.classList.toggle(‘active’,state.lang===‘en’);
}
