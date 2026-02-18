// Lógica frontend: productos, carrito (híbrido DB/Local) y auth

// Cache de productos en memoria
let PRODUCTS_CACHE = [];
let CART_CACHE = []; // Cache del carrito en memoria
let CURRENT_PAGE = 1;
let TOTAL_PAGES = 1;
let INVENTORY_SORT = 'desc'; // Orden por defecto
let SHOW_OFFERS = false; // Estado del filtro de ofertas
let carouselInterval; // Variable para el auto-scroll

// Variables para el temporizador de sesión
let sessionWarningTimer;
let sessionLogoutTimer;
const SESSION_LIFETIME = 30 * 60 * 1000; // 30 minutos
const WARNING_TIME = 28 * 60 * 1000;     // Avisar a los 28 minutos
let lastActivityReset = Date.now();

async function fetchProducts(page = 1, limit = 3) {
  try {
    const searchInput = $('#search-input');
    const query = searchInput ? searchInput.value : '';
    const res = await fetch(`/api/products?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}`);
    const data = await res.json();
    PRODUCTS_CACHE = data.products; // Actualizamos cache solo con los visibles
    TOTAL_PAGES = data.pages;
    return data;
  } catch (e) { console.error(e); return { products: [] }; }
}

// ---------- UTILIDADES ----------
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CL', {style: 'currency', currency: 'CLP'}).format(amount);
};

// Helper para Spinner (Global)
const toggleLoading = (btn, isLoading) => {
  if(isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Procesando...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText;
  }
};

// Helper para Toast (Notificación temporal) - Global
const showToast = (msg) => {
  let toast = $('#toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');

  const hide = () => {
    toast.classList.remove('show');
    document.removeEventListener('click', hide);
  };

  // Auto ocultar a los 2 segundos
  setTimeout(hide, 2000);
  // Ocultar al hacer clic en cualquier parte (con ligero delay para no capturar el clic actual)
  setTimeout(() => document.addEventListener('click', hide), 100);
};

// ---------- RENDER ----------
async function renderProducts(){
  const gridContainer = $('#products');
  const carouselSection = $('#carousel-section');
  const carouselTrack = $('#carousel-track');

  if(!gridContainer) return;
  
  gridContainer.innerHTML='<p class="center">Cargando productos...</p>';
  
  // Pedimos más productos (ej. 20) para poder llenar carrusel y grid
  await fetchProducts(CURRENT_PAGE, 20); 
  
  gridContainer.innerHTML='';
  if(carouselTrack) carouselTrack.innerHTML = '';

  // Ordenar todos por precio descendente
  const sortedProducts = [...PRODUCTS_CACHE].sort((a, b) => b.price - a.price);
  // Tomar los 5 más caros para el carrusel
  const highPrice = sortedProducts.slice(0, 5);
  // El resto para la cuadrícula
  let lowPrice = sortedProducts.slice(5);

  // Filtrar si el modo "Solo Ofertas" está activo
  if (SHOW_OFFERS) {
    lowPrice = lowPrice.filter(p => p.discount && p.discount > 0);
  }

  // Ordenar el inventario según la selección del usuario
  lowPrice.sort((a, b) => {
    if (INVENTORY_SORT === 'asc') return a.price - b.price;
    return b.price - a.price;
  });

  // 1. Renderizar Carrusel (Top caros)
  if(carouselSection && carouselTrack) {
    if(highPrice.length > 0) {
      carouselSection.classList.remove('hidden');
      highPrice.forEach(p => {
        const li = document.createElement('li');
        // Badge de descuento si existe y es mayor a 0
        const discountBadge = (p.discount && p.discount > 0) ? `<span class="discount-badge" data-price="${p.price}" data-discount="${p.discount}" title="¡Clic para ver precio final!">-${p.discount}% OFF</span>` : '';
        
        // Lógica de visualización de precio (Oferta vs Normal)
        let priceHtml;
        if (p.discount && p.discount > 0) {
          const finalPrice = p.price - (p.price * p.discount / 100);
          priceHtml = `
            <div class="price-block">
              <span class="old-price">${formatCurrency(p.price)}</span>
              <span class="new-price-tag">${formatCurrency(finalPrice)}</span>
              <span class="limited-time-badge">⚡ Tiempo limitado</span>
            </div>`;
        } else {
          priceHtml = `<strong>${formatCurrency(p.price)}</strong>`;
        }

        li.className = 'carousel-slide product-card'; // Reutilizamos estilo de tarjeta
        li.innerHTML = `
          ${discountBadge}
          < <h4>${p.name}</h4>
          </div>v class="card-actions">
            ${priceHtml}button class="btn primary" data-id="${p._id}">🛒 Agregar</button>
          </div>`;
        carouselTrack.appendChild(li);
      });
      startCarouselAutoScroll(); // Iniciar movimiento automático
    } else {
      carouselSection.classList.add('hidden');
    }
  }

  // 2. Renderizar Grid (<= 1500)
  lowPrice.forEach(p=>{
    // Lógica de visualización de precio (Oferta vs Normal) para la Grid
    let priceHtml;
    if (p.discount && p.discount > 0) {
      const finalPrice = p.price - (p.price * p.discount / 100);
      priceHtml = `
        <div class="price-block">
          <span class="old-price">${formatCurrency(p.price)}</span>
          <span class="new-price-tag">${formatCurrency(finalPrice)}</span>
          <span class="limited-time-badge">⚡ Tiempo limitado</span>
        </div>`;
    } else {
      priceHtml = `<strong>${formatCurrency(p.price)}</strong>`;
    }

    const card = document.createElement('article');
    card.className='product-card';
    card.innerHTML = `
      <div class="product-trigger" data-id="${p._id}" style="cursor:pointer;">
        <img src="${p.image}" alt="${p.name}">
        <h4>${p.name}</h4>
      </div>
      <p>${p.desc}</p>
      <div class="card-actions">
        ${priceHtml}
        <button class="btn primary" data-id="${p._id}">🛒 Agregar</button>
      </div>`;
    gridContainer.appendChild(card);
  });

  renderPaginationControls();
}

// Función para el auto-scroll del carrusel
function startCarouselAutoScroll() {
  const trackContainer = $('#carousel-container');
  if (!trackContainer) return;
  
  if (carouselInterval) clearInterval(carouselInterval);
  
  carouselInterval = setInterval(() => {
    const slide = trackContainer.querySelector('.carousel-slide');
    if(!slide) return;
    
    const scrollAmount = slide.offsetWidth + 16; // Ancho card + gap (16px)
    const maxScroll = trackContainer.scrollWidth - trackContainer.clientWidth;

    // Si llegamos al final (con un pequeño margen de error), volver al inicio
    if (trackContainer.scrollLeft >= maxScroll - 10) {
      trackContainer.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      trackContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }, 4000); // Cada 4 segundos
}

function renderPaginationControls() {
  // Buscar o crear contenedor de paginación
  let paginationDiv = $('#pagination-controls');
  if (!paginationDiv) {
    paginationDiv = document.createElement('div');
    paginationDiv.id = 'pagination-controls';
    paginationDiv.className = 'center';
    paginationDiv.style.marginTop = '20px';
    paginationDiv.style.paddingBottom = '20px';
    // Insertar después de la sección de productos
    const productsSection = $('#products');
    productsSection.parentNode.insertBefore(paginationDiv, productsSection.nextSibling);
  }

  paginationDiv.innerHTML = `
    <button class="btn" id="prev-page" ${CURRENT_PAGE === 1 ? 'disabled' : ''} style="margin-right:10px;">Anterior</button>
    <span>Página ${CURRENT_PAGE} de ${TOTAL_PAGES}</span>
    <button class="btn" id="next-page" ${CURRENT_PAGE >= TOTAL_PAGES ? 'disabled' : ''} style="margin-left:10px;">Siguiente</button>
  `;

  $('#prev-page').onclick = () => {
    if (CURRENT_PAGE > 1) { CURRENT_PAGE--; renderProducts(); }
  };
  $('#next-page').onclick = () => {
    if (CURRENT_PAGE < TOTAL_PAGES) { CURRENT_PAGE++; renderProducts(); }
  };
}

// ---------- CARRITO ----------
// Cargar carrito inicial (decide si usar API o LocalStorage)
async function loadCart() {
  const user = getCurrentUser();
  if (user) {
    // Si hay usuario, intentamos cargar de la BD
    try {
      const res = await fetch('/api/cart');
      const data = await res.json();
      if (data.ok) CART_CACHE = data.items;
      else CART_CACHE = [];
    } catch (e) { console.error(e); CART_CACHE = []; }
  } else {
    // Si no, usamos localStorage
    CART_CACHE = JSON.parse(localStorage.getItem('cart') || '[]');
  }
  renderCart();
}

// Guardar carrito (decide dónde guardar)
async function saveCart(items) {
  CART_CACHE = items; // Actualizar memoria
  const user = getCurrentUser();
  
  if (user) {
    // Guardar en BD
    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items })
      });
    } catch (e) { console.error("Error guardando carrito en BD", e); }
  } else {
    // Guardar en LocalStorage
    localStorage.setItem('cart', JSON.stringify(items));
  }
  renderCart();
}

function addToCart(id){
  const product = PRODUCTS_CACHE.find(p=>p._id===id);
  if(!product) return;
  // Usamos la cache en memoria (que ya se cargó al inicio)
  const cart = [...CART_CACHE]; 
  const item = cart.find(i=>i._id===id);
  if(item) item.qty+=1; else cart.push({_id:product._id,name:product.name,price:product.price,qty:1});
  saveCart(cart);
}
function removeFromCart(id){
  let cart = CART_CACHE.filter(i=>i._id!==id);
  saveCart(cart);
}
function renderCart(){
  const list = $('#cart-items');
  const count = $('#cart-count');
  const totalEl = $('#cart-total');
  
  // Verificación de seguridad: Si no existen los elementos (ej. en perfil), salir sin error
  if(!list || !count || !totalEl) return;

  list.innerHTML='';
  let total=0, qty=0;
  CART_CACHE.forEach(i=>{
    const li = document.createElement('li');
    li.innerHTML = `${i.name} x ${i.qty} - ${formatCurrency(i.price*i.qty)} <button class="btn" data-remove="${i._id}">Eliminar</button>`;
    list.appendChild(li);
    total += i.price*i.qty; qty += i.qty;
  });
  totalEl.textContent = formatCurrency(total);
  count.textContent = qty;
}

// ---------- MODAL DE PRODUCTO (Quick View) ----------
async function openProductModal(productId) {
  const product = PRODUCTS_CACHE.find(p => p._id === productId);
  if(!product) return;

  const modal = $('#product-detail-modal');
  if(!modal) return;

  // 1. Rellenar datos del producto
  $('#pm-image').src = product.image;
  $('#pm-title').textContent = product.name;
  $('#pm-desc').textContent = product.desc;
  
  // Precio
  const priceContainer = $('#pm-price-container');
  if(product.discount && product.discount > 0) {
    const final = product.price - (product.price * product.discount / 100);
    priceContainer.innerHTML = `
      <span style="text-decoration: line-through; color: #999; font-size: 1rem;">${formatCurrency(product.price)}</span>
      <span style="color: var(--color-accent); font-size: 1.5rem; font-weight:800;">${formatCurrency(final)}</span>
    `;
  } else {
    priceContainer.innerHTML = `<span style="color: var(--color-accent); font-size: 1.5rem; font-weight:800;">${formatCurrency(product.price)}</span>`;
  }

  // Botón agregar
  const addBtn = $('#pm-add-cart');
  addBtn.onclick = () => {
    addToCart(product._id);
    showToast('Producto agregado al carrito');
  };

  // 2. Cargar Reseñas
  const list = $('#pm-reviews-list');
  list.innerHTML = '<li class="muted small">Cargando opiniones...</li>';
  
  try {
    const res = await fetch(`/api/reviews/${product._id}`);
    const data = await res.json();
    list.innerHTML = '';
    if(data.ok && data.reviews.length > 0) {
      data.reviews.forEach(r => {
        const li = document.createElement('li');
        li.className = 'review-card';
        li.innerHTML = `
          <div style="display:flex; justify-content:space-between;">
            <strong>${r.name}</strong>
            <span style="color:#ffc107;">${'★'.repeat(r.rating)}</span>
          </div>
          <p style="margin:4px 0;">${r.comment}</p>
        `;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = '<li class="muted small">No hay opiniones aún.</li>';
    }
  } catch(e) { list.innerHTML = '<li class="error-msg">Error al cargar reseñas.</li>'; }

  // 3. Configurar formulario de reseña
  const form = $('#pm-review-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#pm-review-name').value;
    const rating = $('#pm-review-rating').value;
    const comment = $('#pm-review-comment').value;
    
    // Reutilizamos la API existente
    await fetch('/api/reviews', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ product_id: product._id, name, rating, comment })
    });
    showToast('Opinión enviada');
    openProductModal(product._id); // Recargar modal para ver la reseña
  };

  modal.classList.remove('hidden');
}

// ---------- AUTH (demo localStorage) ----------
async function initAuth(){
  // Verificar si la sesión del servidor sigue activa (por si se reinició la app)
  try {
    const res = await fetch('/api/session');
    const data = await res.json();
    if(!data.ok){
      localStorage.removeItem('currentUser');
      renderAuthState(); // Actualizar UI para mostrar "Iniciar sesión"
    } else {
      await loadCart(); // Cargar carrito de la BD si la sesión es válida
      startSessionTimers(); // La sesión es válida, iniciar conteo
    }
  } catch(e) {}
}

async function registerUser(name,email,password){
  try {
    const response = await fetch('/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await response.json();
    if(data.ok){
      // Auto-login tras registro exitoso (opcional, aquí solo guardamos sesión frontend)
      setCurrentUser({name, email}); 
    }
    return data;
  } catch (error) {
    console.error(error);
    return {ok:false, msg: 'Error de conexión con el servidor'};
  }
}

async function loginUser(email,password){
  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if(data.ok) {
      setCurrentUser(data.user);
      await loadCart(); // Cargar carrito de la BD al entrar
      startSessionTimers(); // Iniciar conteo al entrar
    }
    return data;
  } catch (error) {
    return {ok:false, msg: 'Error de conexión'};
  }
}
function setCurrentUser(u){ localStorage.setItem('currentUser',JSON.stringify(u)); renderAuthState(); }
function getCurrentUser(){ return JSON.parse(localStorage.getItem('currentUser')||'null'); }
async function logout(){ 
  clearSessionTimers(); // Detener conteo al salir
  try { await fetch('/logout'); } catch(e){} // Avisar al servidor
  localStorage.removeItem('currentUser'); 
  CART_CACHE = []; // Limpiar carrito en memoria
  renderCart(); // Limpiar UI
  renderAuthState(); 
}

// ---------- GESTIÓN DE TIEMPO DE SESIÓN ----------
function startSessionTimers() {
  clearSessionTimers();
  
  // Si el usuario volvió a estar activo, aseguramos que el modal de advertencia se oculte
  const modal = $('#session-warning-modal');
  if(modal) modal.classList.add('hidden');

  // 1. Temporizador para mostrar la advertencia (a los 28 min)
  sessionWarningTimer = setTimeout(() => {
    const modal = $('#session-warning-modal');
    if(modal) modal.classList.remove('hidden');
  }, WARNING_TIME);

  // 2. Temporizador para cerrar forzosamente (a los 30 min)
  sessionLogoutTimer = setTimeout(() => {
    const modal = $('#session-warning-modal');
    if(modal) modal.classList.add('hidden');
    logout();
    alert('Tu sesión ha expirado por inactividad.');
    window.location.href = '/';
  }, SESSION_LIFETIME);
}

function clearSessionTimers() {
  if (sessionWarningTimer) clearTimeout(sessionWarningTimer);
  if (sessionLogoutTimer) clearTimeout(sessionLogoutTimer);
}

function setupActivityTracking() {
  // Eventos que consideramos "actividad"
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  
  const resetActivity = () => {
    const now = Date.now();
    // Throttle: Solo reiniciar si ha pasado más de 1 minuto desde el último reset
    // Esto evita reiniciar el timer miles de veces por segundo al mover el mouse
    if (now - lastActivityReset > 60000) { 
      lastActivityReset = now;
      const user = getCurrentUser();
      if(user) {
        startSessionTimers(); // Reinicia el conteo local
        fetch('/api/session').catch(()=>{}); // Mantiene viva la sesión en servidor
      }
    }
  };

  events.forEach(evt => document.addEventListener(evt, resetActivity, { passive: true }));
}

function renderAuthState(){
  const user = getCurrentUser();
  const btn = $('#btn-auth');
  if(!btn) return; // Si no existe el botón (ej. página diferente), salir

  // Limpiar botones extra si existen (como el de admin)
  const adminBtn = $('#btn-admin-panel');
  if(adminBtn) adminBtn.remove();

  if(user){
    btn.textContent = `Hola, ${user.name}`;
    btn.onclick = ()=>{
      // En lugar de alert, vamos al perfil
      window.location.href = '/profile';
    }
    // Si es admin (por email o rol), agregar botón de panel
    if(user.email === 'admin@bloomcare.com' || user.rol === 'admin') {
      const adminLink = document.createElement('a');
      adminLink.id = 'btn-admin-panel';
      adminLink.href = '/admin';
      adminLink.className = 'nav-btn';
      adminLink.textContent = 'Panel Admin';
      // Estilos inline para destacar
      adminLink.style.cssText = 'text-decoration:none; color:var(--color-accent); border-color:var(--color-accent); margin-right: 8px;';
      
      // Insertar antes del botón de perfil para que quede ordenado
      btn.parentNode.insertBefore(adminLink, btn);
    }
  } else {
    btn.textContent = 'Iniciar sesión / Registro';
    btn.onclick = ()=>{ $('#auth-modal').classList.remove('hidden'); }
  }
}

// ---------- PERFIL ----------
function renderProfile(){
  const user = getCurrentUser();
  if(!user){
    // Si no hay usuario y estamos en perfil, volver al inicio
    window.location.href = '/';
    return;
  }
  if($('#profile-name')) $('#profile-name').textContent = user.name;
  if($('#profile-name-input')) $('#profile-name-input').value = user.name;
  if($('#profile-email')) $('#profile-email').value = user.email;
  if($('#profile-id')) $('#profile-id').value = user._id || 'N/A';
}

async function updateUserProfile(name, email){
  const user = getCurrentUser();
  if(!user) return;
  const msgEl = $('#profile-msg');
  msgEl.textContent = 'Guardando...';
  msgEl.style.color = 'var(--color-muted)';

  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ _id: user._id, name, email })
    });
    const data = await res.json();
    if(data.ok) {
      msgEl.textContent = '¡Cambios guardados!';
      msgEl.style.color = 'green';
      // Actualizar sesión local
      setCurrentUser({...user, name, email});
      disableProfileInputs(); // Volver a bloquear inputs
      if($('#profile-name')) $('#profile-name').textContent = name;
    } else {
      msgEl.textContent = data.msg || 'Error al guardar';
      msgEl.style.color = 'red';
    }
  } catch (e) {
    msgEl.textContent = 'Error de conexión';
    msgEl.style.color = 'red';
  }
}

// Helper para bloquear inputs tras guardar
function disableProfileInputs() {
  const inputs = $$('.input-with-icon input');
  inputs.forEach(i => i.disabled = true);
  const saveBtn = $('#btn-save-profile');
  if(saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardar Cambios';
  }
}

// ---------- ADMIN ----------
function renderAdminPanel() {
  const user = getCurrentUser();
  // Protección simple de ruta
  if(!user || (user.email !== 'admin@bloomcare.com' && user.rol !== 'admin')) {
    alert('Acceso denegado. Debes ser administrador.');
    window.location.href = '/';
    return;
  }

  let editingId = null;
  let adminProductsCache = [];
  let productToDeleteId = null; // Variable para almacenar ID temporalmente

  // Función para cargar lista de productos en admin
  const loadAdminProducts = async () => {
    const list = $('#admin-products-list');
    if(!list) return;
    list.innerHTML = '<p class="center small muted">Cargando productos...</p>';
    
    try {
      // Pedimos productos (con un límite alto para verlos todos en el admin)
      const res = await fetch('/api/products?limit=50'); 
      const data = await res.json();
      adminProductsCache = data.products || [];
      
      if(data.products && data.products.length > 0){
        list.innerHTML = '';
        data.products.forEach(p => {
          const li = document.createElement('li');
          li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid #f0f0f0;';
          li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
              <img src="${p.image}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">
              <div>
                <strong style="display:block; font-size: 0.95rem;">${p.name}</strong>
                <span class="muted small">${formatCurrency(p.price)}</span>
              </div>
            </div>
            <div style="display:flex; gap: 5px;">
              <button class="btn" style="background:#33b5e5; color:white; border:none; padding: 4px 8px; font-size: 0.8rem;" data-edit-product="${p._id}">Editar</button>
              <button class="btn" style="background:#ff4444; color:white; border:none; padding: 4px 8px; font-size: 0.8rem;" data-delete-product="${p._id}">Eliminar</button>
            </div>
          `;
          list.appendChild(li);
        });
      } else {
        list.innerHTML = '<p class="center small muted">No hay productos.</p>';
      }
    } catch(e) {
      console.error(e);
      list.innerHTML = '<p class="error-msg small">Error al cargar productos.</p>';
    }
  };

  // Eventos de la lista (Eliminar y Editar)
  const adminProdListEl = $('#admin-products-list');
  if(adminProdListEl) {
    adminProdListEl.addEventListener('click', async (e) => {
      // --- EDITAR ---
      if(e.target.matches('[data-edit-product]')) {
        const id = e.target.dataset.editProduct;
        const p = adminProductsCache.find(x => x._id === id);
        if(p) {
          editingId = id;
          // Rellenar formulario
          $('#prod-name').value = p.name;
          $('#prod-desc').value = p.desc;
          $('#prod-price').value = p.price;
          $('#prod-discount').value = p.discount || 0;
          $('#prod-image').required = false; // Imagen opcional al editar
          
          // Actualizar UI
          $('#btn-submit-prod').textContent = 'Actualizar Producto';
          $('#btn-cancel-edit').classList.remove('hidden');
          $('#admin-product-form').scrollIntoView({behavior: 'smooth'});
        }
      }

      // --- ELIMINAR ---
      if(e.target.matches('[data-delete-product]')) {
        productToDeleteId = e.target.dataset.deleteProduct;
        const product = adminProductsCache.find(p => p._id === productToDeleteId);
        if(product) {
          const nameEl = $('#delete-product-name');
          if(nameEl) nameEl.textContent = `"${product.name}"`;
        }
        const deleteModal = $('#delete-product-modal');
        if(deleteModal) deleteModal.classList.remove('hidden');
      }
    });
  }

  // Lógica del Modal de Eliminación
  const deleteModal = $('#delete-product-modal');
  if(deleteModal) {
    // Confirmar
    $('#btn-confirm-delete').addEventListener('click', async () => {
      if(!productToDeleteId) return;
      try {
        const res = await fetch(`/api/products/${productToDeleteId}`, { method: 'DELETE' });
        const data = await res.json();
        if(data.ok) {
          showToast('Producto eliminado correctamente');
          loadAdminProducts(); 
        } else {
          alert(data.msg || 'Error al eliminar');
        }
      } catch(e) { alert('Error de conexión'); }
      
      deleteModal.classList.add('hidden');
      productToDeleteId = null;
    });

    // Cancelar / Cerrar
    const closeDeleteModal = () => {
      deleteModal.classList.add('hidden');
      productToDeleteId = null;
    };
    $('#btn-cancel-delete').addEventListener('click', closeDeleteModal);
    deleteModal.addEventListener('click', (e) => { if(e.target === deleteModal) closeDeleteModal(); });
  }

  // Cargar productos al entrar
  loadAdminProducts();

  // Botón Cancelar Edición
  const cancelBtn = $('#btn-cancel-edit');
  if(cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      editingId = null;
      $('#admin-product-form').reset();
      $('#prod-image').required = true;
      $('#btn-submit-prod').textContent = 'Guardar Producto';
      cancelBtn.classList.add('hidden');
    });
  }

  const form = $('#admin-product-form');
  if(form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#btn-submit-prod');
      const name = $('#prod-name').value.trim();
      const desc = $('#prod-desc').value.trim();
      const price = parseFloat($('#prod-price').value);
      const discount = $('#prod-discount').value;
      const imageFile = $('#prod-image').files[0];
      
      // Validación: Imagen obligatoria solo si NO estamos editando
      if(!name || !desc || isNaN(price)) return alert('Faltan campos de texto');
      if(price < 0) return alert('El precio no puede ser negativo');
      if(!editingId && !imageFile) return alert('La imagen es obligatoria para nuevos productos');

      toggleLoading(btn, true);

      // Crear FormData para enviar archivo + texto
      const formData = new FormData();
      formData.append('name', name);
      formData.append('desc', desc);
      formData.append('price', price);
      formData.append('discount', discount);
      if(imageFile) formData.append('image', imageFile);
      
      try {
        // Decidir URL y Método según si editamos o creamos
        const url = editingId ? `/api/products/${editingId}` : '/api/products';
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method: method,
          body: formData // El navegador configura automáticamente el Content-Type multipart/form-data
        });

        // Intentar leer la respuesta como JSON
        let data;
        try {
          data = await res.json();
        } catch (jsonError) {
          // Si falla al leer JSON, es probable que el servidor devolviera HTML (Error 500, 413, etc.)
          throw new Error(`Error del servidor (${res.status}). Posiblemente la imagen es muy pesada o hubo un fallo interno.`);
        }
        
        toggleLoading(btn, false);
        
        if(data.ok) { 
          showToast(editingId ? 'Producto actualizado correctamente' : 'Producto agregado correctamente'); 
          form.reset(); 
          // Resetear estado de edición
          editingId = null;
          $('#prod-image').required = true;
          $('#btn-submit-prod').textContent = 'Guardar Producto';
          if(cancelBtn) cancelBtn.classList.add('hidden');
          
          loadAdminProducts(); // Recargar lista
        }
        else { alert(data.msg || 'Error al subir producto'); }
      } catch(err) { 
        console.error(err); 
        toggleLoading(btn, false);
        alert(err.message || 'Error de conexión'); 
      }
    });
  }

  // Función para cargar lista de admins
  const loadAdmins = async () => {
    const list = $('#admin-list');
    if(!list) return;
    list.innerHTML = '<p class="center small muted">Cargando...</p>';
    
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      
      if(data.ok) {
        list.innerHTML = '';
        if(data.admins.length === 0) {
          list.innerHTML = '<p class="center small muted">No se encontraron administradores.</p>';
          return;
        }
        
        const currentUser = getCurrentUser();

        data.admins.forEach(admin => {
          const li = document.createElement('li');
          li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid #f0f0f0;';
          
          // Verificar si es el usuario actual para no mostrar botón de borrar
          const isMe = currentUser && currentUser._id === admin._id;
          
          li.innerHTML = `
            <div style="overflow: hidden;">
              <strong style="display:block; font-size: 0.95rem;">${admin.nombre}</strong>
              <span class="muted small" style="display:block; text-overflow: ellipsis; overflow: hidden;">${admin.email}</span>
            </div>
            ${!isMe ? 
              `<button class="btn" style="background:#ff4444; color:white; border:none; padding: 4px 8px; font-size: 0.8rem; margin-left: 10px;" data-delete-admin="${admin._id}">Eliminar</button>` 
              : '<span class="small muted" style="margin-left: 10px;">(Tú)</span>'}
          `;
          list.appendChild(li);
        });
      }
    } catch(e) {
      console.error(e);
      list.innerHTML = '<p class="error-msg small">Error al cargar lista.</p>';
    }
  };

  // Cargar lista inicial
  loadAdmins();

  // Evento delegado para eliminar admins
  const adminListEl = $('#admin-list');
  if(adminListEl) {
    adminListEl.addEventListener('click', async (e) => {
      if(e.target.matches('[data-delete-admin]')) {
        const id = e.target.dataset.deleteAdmin;
        if(confirm('¿Estás seguro de que deseas eliminar a este administrador? Esta acción no se puede deshacer.')) {
          try {
            const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if(data.ok) {
              alert('Administrador eliminado correctamente.');
              loadAdmins(); // Recargar lista
            } else {
              alert(data.msg || 'Error al eliminar.');
            }
          } catch(err) {
            alert('Error de conexión.');
          }
        }
      }
    });
  }

  // Lógica para crear nuevo admin
  const createAdminForm = $('#create-admin-form');
  if(createAdminForm) {
    createAdminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#admin-name').value.trim();
      const email = $('#admin-email').value.trim();
      const password = $('#admin-password').value;

      if(!name || !email || !password) return alert('Todos los campos son obligatorios');
      if(password.length < 6) return alert('La contraseña debe tener al menos 6 caracteres');

      try {
        const res = await fetch('/api/admin/create-admin', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if(data.ok) {
          alert('Nuevo administrador creado exitosamente.');
          createAdminForm.reset();
          loadAdmins(); // Recargar lista para ver el nuevo admin
        } else {
          alert(data.msg || 'Error al crear administrador.');
        }
      } catch(e) {
        console.error(e);
        alert('Error de conexión.');
      }
    });
  }
}

// ---------- EVENTOS ----------
function setupEvents(){
  initAuth(); // Inicialización única de usuarios base
  setupActivityTracking(); // Iniciar detector de actividad
  // Solo renderizar si existen los elementos (para evitar errores en pag perfil)
  if($('#products')) renderProducts();
  if($('#cart-items')) loadCart(); // Cargar carrito inicial
  if($('#profile-name')) renderProfile(); // Lógica específica de perfil
  if($('#admin-product-form')) renderAdminPanel(); // Lógica específica de admin
  
  // Lógica específica para página de Detalle de Producto
  const detailData = $('#product-detail-data');
  if(detailData) {
    // Inyectamos el producto actual en la caché para que funcione "addToCart"
    PRODUCTS_CACHE.push({
      _id: detailData.dataset.id,
      name: detailData.dataset.name,
      price: parseFloat(detailData.dataset.price),
      image: detailData.dataset.image
    });

    // Lógica para enviar reseña
    const reviewForm = $('#form-review');
    if(reviewForm) {
      reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = reviewForm.querySelector('button');
        const name = $('#review-name').value.trim();
        const rating = $('#review-rating').value;
        const comment = $('#review-comment').value.trim();
        const productId = detailData.dataset.id;

        // Validación Frontend: Evitar campos vacíos
        if (!name || !comment) {
          showToast('Por favor, completa todos los campos.');
          return;
        }
        if (comment.length < 5) {
          showToast('El comentario es muy corto.');
          return;
        }

        toggleLoading(btn, true);

        try {
          const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ product_id: productId, name, rating, comment })
          });
          const data = await res.json();
          
          if(data.ok) {
            showToast('¡Gracias por tu opinión!');
            // Recargar la página para ver el comentario (o podríamos inyectarlo con JS)
            setTimeout(() => window.location.reload(), 1000);
          } else {
            alert('Error al enviar reseña');
          }
        } catch(err) { console.error(err); alert('Error de conexión'); }
        toggleLoading(btn, false);
      });
    }

    // Botón para iniciar sesión desde la sección de reseñas (si no está logueado)
    const triggerLoginBtn = $('#btn-trigger-login');
    if(triggerLoginBtn) {
      triggerLoginBtn.addEventListener('click', () => { $('#auth-modal').classList.remove('hidden'); });
    }

    // Lógica de Filtros de Reseñas
    const btnAll = $('#btn-filter-all');
    const btn5 = $('#btn-filter-5');
    
    if(btnAll && btn5) {
      const filterReviews = (rating) => {
        const reviews = $$('.review-card');
        reviews.forEach(card => {
          const cardRating = parseInt(card.dataset.rating);
          if(rating === 'all' || cardRating === rating) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
      };

      btnAll.addEventListener('click', () => { filterReviews('all'); btnAll.classList.add('active-filter'); btn5.classList.remove('active-filter'); });
      btn5.addEventListener('click', () => { filterReviews(5); btn5.classList.add('active-filter'); btnAll.classList.remove('active-filter'); });
    }

    // Lógica de Ordenamiento de Reseñas
    const sortSelect = $('#sort-reviews-select');
    if(sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const order = e.target.value;
        const container = $('#reviews-container');
        const cards = Array.from(container.querySelectorAll('.review-card'));
        
        cards.sort((a, b) => {
          const dateA = new Date(a.dataset.date);
          const dateB = new Date(b.dataset.date);
          return order === 'newest' ? dateB - dateA : dateA - dateB;
        });
        
        // Reinsertar en el nuevo orden
        cards.forEach(card => container.appendChild(card));
      });
    }

    // Lógica del Botón Compartir
    const shareBtn = $('#btn-share');
    if(shareBtn) {
      shareBtn.addEventListener('click', () => {
        // Copiar URL actual al portapapeles
        navigator.clipboard.writeText(window.location.href).then(() => {
          showToast('¡Enlace copiado al portapapeles!');
        }).catch(err => {
          console.error('Error al copiar: ', err);
          showToast('No se pudo copiar el enlace');
        });
      });
    }
  }
  
  renderAuthState();
  
  // Eventos del modal de sesión
  if($('#btn-extend-session')){
    $('#btn-extend-session').addEventListener('click', async () => {
      // Llamar al backend para renovar la cookie de sesión
      try { await fetch('/api/session'); } catch(e){}
      $('#session-warning-modal').classList.add('hidden');
      startSessionTimers(); // Reiniciar el reloj
    });
  }
  if($('#btn-logout-session')){
    $('#btn-logout-session').addEventListener('click', async () => {
      $('#session-warning-modal').classList.add('hidden');
      await logout();
      window.location.href = '/';
    });
  }

  if($('#year')) $('#year').textContent = new Date().getFullYear();

  document.addEventListener('click',e=>{
    // Evento para calcular precio al hacer clic en el badge de descuento
    if(e.target.matches('.discount-badge')){
      e.stopPropagation(); // Evitar otros clics
      const price = parseFloat(e.target.dataset.price);
      const disc = parseFloat(e.target.dataset.discount);
      const final = price - (price * disc / 100);
      
      const modal = $('#discount-modal');
      const details = $('#discount-details');
      if(modal && details) {
        details.innerHTML = `
          <p style="font-size: 1.1rem; color: #666; text-decoration: line-through;">Precio Normal: ${formatCurrency(price)}</p>
          <p style="font-size: 1.2rem; color: #ff4444; font-weight: bold;">Descuento: ${disc}%</p>
          <hr style="border: 0; border-top: 1px dashed #ccc; margin: 15px 0;">
          <p style="font-size: 0.9rem; color: #333;">Precio Final:</p>
          <p class="price-big" style="font-size: 2rem; color: var(--color-accent); font-weight: 800; margin: 0;">${formatCurrency(final)}</p>
        `;
        modal.classList.remove('hidden');
      } else {
        // Fallback si no existe el modal
        alert(`💰 PRECIO DE OFERTA\n\nPrecio Normal: ${formatCurrency(price)}\nDescuento: ${disc}%\n------------------\nPrecio Final: ${formatCurrency(final)}`);
      }
      return;
    }

    if(e.target.matches('[data-id]')){
      addToCart(e.target.dataset.id); // Ya no usamos parseInt porque _id es string
    }
    if(e.target.matches('[data-remove]')){
      removeFromCart(e.target.dataset.remove); // Ya no usamos parseInt
    }
    // Click en imagen/título para abrir modal
    if(e.target.closest('.product-trigger')){
      const trigger = e.target.closest('.product-trigger');
      const id = trigger.dataset.id;
      openProductModal(id);
    }
  });
  
  if($('#btn-save-profile')){
    $('#btn-save-profile').addEventListener('click', () => {
      const name = $('#profile-name-input').value.trim();
      const email = $('#profile-email').value.trim();
      if(name && email) updateUserProfile(name, email);
      else alert('Por favor completa todos los campos.');
    });
  }

  // Eventos de edición en perfil (Lápiz)
  const editBtns = $$('.edit-field');
  if(editBtns.length > 0) {
    editBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Encontrar el input hermano
        const input = e.currentTarget.previousElementSibling;
        if(input) {
          input.disabled = false;
          input.focus();
          // Habilitar botón de guardar
          const saveBtn = $('#btn-save-profile');
          if(saveBtn) saveBtn.disabled = false;
        }
      });
    });
  }

  // Logout desde Perfil (Centralizado)
  if($('#btn-logout-profile')){
    $('#btn-logout-profile').addEventListener('click', async ()=>{
      if(!confirm('¿Estás seguro de que deseas cerrar sesión?')) return;
      await logout();
      localStorage.setItem('toastMessage', 'Hasta pronto'); // Guardar mensaje para mostrar tras redirección
      window.location.href = '/';
    });
  }

  // Logout desde Admin (Nuevo)
  if($('#btn-logout-admin')){
    $('#btn-logout-admin').addEventListener('click', async ()=>{
      if(!confirm('¿Estás seguro de que deseas cerrar sesión?')) return;
      await logout();
      localStorage.setItem('toastMessage', 'Hasta pronto');
      window.location.href = '/';
    });
  }

  // Botones extra de perfil (Demo)
  if($('#btn-change-pass')){
    $('#btn-change-pass').addEventListener('click', () => {
      alert('Funcionalidad de cambio de contraseña (Demo). Aquí se abriría un modal.');
    });
  }
  if($('#btn-add-payment')){
    $('#btn-add-payment').addEventListener('click', () => {
      alert('Funcionalidad de agregar método de pago (Demo). Aquí se abriría un formulario de tarjeta.');
    });
  }

  if($('#btn-cart')){
    $('#btn-cart').addEventListener('click',()=>{
      $('#cart').classList.toggle('hidden');
    });
  }

  if($('#btn-products')){
    $('#btn-products').addEventListener('click',()=>{
      // Alternar filtro de ofertas
      SHOW_OFFERS = !SHOW_OFFERS;
      renderProducts();
      showToast(SHOW_OFFERS ? 'Mostrando solo ofertas' : 'Mostrando todo el inventario');

      // Buscar el contenedor del título "Inventario" (justo antes de la grid #products)
      const inventoryHeader = $('#products')?.previousElementSibling;
      const target = inventoryHeader || $('#products');

      if(target){
        // Calcular posición restando la altura del header sticky (aprox 90px)
        const headerOffset = 90;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    });
  }

  // Botón de Contacto (Scroll al footer)
  if($('#btn-contact')){
    $('#btn-contact').addEventListener('click', () => {
      $('.site-footer')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Evento del buscador
  if($('#search-input')){
    $('#search-input').addEventListener('input', (e) => {
      CURRENT_PAGE = 1; // Resetear a página 1 al buscar
      renderProducts();
    });
  }

  // Eventos del Carrusel
  const trackContainer = $('#carousel-container');
  if(trackContainer) {
    const prevBtn = $('#carousel-prev');
    const nextBtn = $('#carousel-next');
    
    // Calcular ancho dinámicamente
    const getScrollWidth = () => {
      const slide = trackContainer.querySelector('.carousel-slide');
      return slide ? slide.offsetWidth + 16 : 226; // 210 + 16 fallback
    };

    if(prevBtn) prevBtn.onclick = () => {
      clearInterval(carouselInterval); // Pausar auto-scroll al interactuar
      trackContainer.scrollBy({ left: -getScrollWidth(), behavior: 'smooth' });
      startCarouselAutoScroll(); // Reiniciar
    };
    if(nextBtn) nextBtn.onclick = () => {
      clearInterval(carouselInterval);
      trackContainer.scrollBy({ left: getScrollWidth(), behavior: 'smooth' });
      startCarouselAutoScroll();
    };
  }

  // Evento de ordenamiento
  if($('#sort-select')){
    $('#sort-select').addEventListener('change', (e) => {
      INVENTORY_SORT = e.target.value;
      renderProducts();
    });
  }

  // Cerrar modal de descuento
  const closeDiscount = () => $('#discount-modal').classList.add('hidden');
  if($('#close-discount')) $('#close-discount').addEventListener('click', closeDiscount);
  if($('#btn-close-discount-modal')) $('#btn-close-discount-modal').addEventListener('click', closeDiscount);
  if($('#discount-modal')) $('#discount-modal').addEventListener('click', (e) => { if(e.target.id === 'discount-modal') closeDiscount(); });

  // Helpers para errores
  const showError = (selector, msg) => {
    const el = $(selector);
    if(el) el.textContent = msg;
    else alert(msg); // Fallback: si no existe el elemento visual, usa alerta
  };

  // Verificar si hay un mensaje pendiente (ej. tras logout)
  const pendingToast = localStorage.getItem('toastMessage');
  if(pendingToast) {
    showToast(pendingToast);
    localStorage.removeItem('toastMessage');
  }

  const clearErrors = () => $$('.error-msg').forEach(el => el.textContent = '');
  
  const closeModal = () => {
    $('#auth-modal').classList.add('hidden');
    clearErrors();
  };

  if($('#close-auth')) $('#close-auth').addEventListener('click', closeModal);
  
  // Cerrar modal de producto
  if($('#close-product-detail')) $('#close-product-detail').addEventListener('click', () => $('#product-detail-modal').classList.add('hidden'));
  if($('#product-detail-modal')) $('#product-detail-modal').addEventListener('click', (e) => { if(e.target.id === 'product-detail-modal') $('#product-detail-modal').classList.add('hidden'); });

  // Cerrar modal al hacer clic fuera (en el fondo oscuro)
  if($('#auth-modal')){
    $('#auth-modal').addEventListener('click', (e) => {
      if (e.target.id === 'auth-modal') closeModal();
    });
  }

  // Cerrar cualquier modal con la tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal').forEach(modal => modal.classList.add('hidden'));
    }
  });

  if($('#show-register')){
    $('#show-register').addEventListener('click',(e)=>{
      e.preventDefault(); clearErrors();
      $('#login-form').classList.add('hidden');$('#register-form').classList.remove('hidden');
    });
  }
  if($('#show-login')){
    $('#show-login').addEventListener('click',(e)=>{
      e.preventDefault(); clearErrors();
      $('#login-form').classList.remove('hidden');$('#register-form').classList.add('hidden');
    });
  }

  // Register
  const regForm = $('#register-form');
  
  // Lógica de validación en tiempo real y fortaleza de contraseña
  if(regForm) {
    const regBtn = $('#btn-register-submit');
    const passInput = $('#reg-password');
    const strengthEl = $('#password-strength');
    const allInputs = regForm.querySelectorAll('input');

    // Función para evaluar fortaleza
    const checkStrength = (val) => {
      if(!val) {
        strengthEl.textContent = '';
        return;
      }
      if(val.length < 6) {
        strengthEl.textContent = 'Débil (mínimo 6 caracteres)';
        strengthEl.style.color = '#ff4444'; // Rojo
      } else if (val.length >= 8 && /[0-9]/.test(val)) {
        strengthEl.textContent = 'Fuerte';
        strengthEl.style.color = '#00C851'; // Verde
      } else {
        strengthEl.textContent = 'Media';
        strengthEl.style.color = '#ffbb33'; // Naranja
      }
    };

    // Función para habilitar/deshabilitar botón
    const validateFormInputs = () => {
      let isValid = true;
      allInputs.forEach(input => {
        if(!input.value.trim()) isValid = false;
      });
      regBtn.disabled = !isValid;
    };

    // Event listeners para inputs
    passInput.addEventListener('input', (e) => checkStrength(e.target.value));
    
    allInputs.forEach(input => {
      input.addEventListener('input', validateFormInputs);
    });
  }

  if(regForm){
    regForm.addEventListener('submit',e=>{
      e.preventDefault();
      const btn = regForm.querySelector('button[type="submit"]');
      const name = $('#reg-name').value.trim();
      const email = $('#reg-email').value.trim();
      const pass = $('#reg-password').value;
      const passConfirm = $('#reg-password-confirm').value;
      
      clearErrors();

      // Validación de formato de email con Regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if(!emailRegex.test(email)) return showError('#register-error', 'Por favor, introduce un email válido.');

      // Validación de longitud de contraseña
      if(pass.length < 6) return showError('#register-error', 'La contraseña debe tener al menos 6 caracteres.');

      // Validación de coincidencia de contraseñas
      if(pass !== passConfirm) return showError('#register-error', 'Las contraseñas no coinciden.');

      // Activar spinner
      toggleLoading(btn, true);

      // Simular retardo de red (1.5 segundos)
      setTimeout(async () => {
        const r = await registerUser(name,email,pass);
        toggleLoading(btn, false); // Desactivar spinner

        if(!r.ok) return showError('#register-error', r.msg);
        
        closeModal();
        showToast('Registro correcto. Sesión iniciada.');
        // No recargamos la página para que se vea el mensaje
      }, 1500);
    });
  }

  // Login
  const loginForm = $('#login-form');
  if(loginForm){
    loginForm.addEventListener('submit',e=>{
      e.preventDefault();
      const btn = loginForm.querySelector('button[type="submit"]');
      const email = $('#login-email').value.trim();
      const pass = $('#login-password').value;
      
      clearErrors();
      toggleLoading(btn, true);

      setTimeout(async () => {
        const r = await loginUser(email,pass);
        toggleLoading(btn, false);

        if(!r.ok) return showError('#login-error', r.msg);
        
        closeModal();
        showToast('¡Bienvenida/o!');

        // Si estamos en una página de producto, recargar para mostrar el formulario de reseñas
        if(window.location.pathname.startsWith('/product/')) {
          setTimeout(() => window.location.reload(), 1000);
        }
        // No recargamos la página para que se vea el mensaje
      }, 1500);
    });
  }

  // Checkout (demo)
  if($('#checkout-btn')){
    $('#checkout-btn').addEventListener('click',()=>{
      const cart = CART_CACHE;
      if(cart.length===0) return alert('El carrito está vacío');
      const user = getCurrentUser();
      if(!user) return alert('Debes iniciar sesión o registrarte para pagar.');
      // Simular pago
      alert(`Gracias ${user.name}, tu pedido por ${formatCurrency(cart.reduce((s,i)=>s+i.price*i.qty,0))} ha sido registrado (simulado).`);
      saveCart([]);
      renderCart();
      $('#cart').classList.add('hidden');
    });
  }
}

// Inicialización
window.addEventListener('DOMContentLoaded',setupEvents);
