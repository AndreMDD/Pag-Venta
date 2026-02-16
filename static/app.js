// Lógica simple de frontend: productos, carrito y auth en localStorage

// Helper para generar IDs tipo MongoDB (ObjectId simulado)
const generateObjectId = () => {
  const timestamp = (new Date().getTime() / 1000 | 0).toString(16);
  return timestamp + 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, () => (Math.random() * 16 | 0).toString(16)).toLowerCase();
};

const DEFAULT_PRODUCTS = [
  {_id:'65d4f1a1e1b2c3d4e5f6a001',name:'Compresas Suaves',price:1000,desc:'Paquete de 20 compresas ultra suaves.',image:'https://images.unsplash.com/photo-1592928306923-7a1b9b2fec1b?auto=format&fit=crop&w=800&q=60'},
  {_id:'65d4f1a1e1b2c3d4e5f6a002',name:'Protectores Diarios',price:1000,desc:'Protectores discretos para el día a día.',image:'https://images.unsplash.com/photo-1542831371-d531d36971e6?auto=format&fit=crop&w=800&q=60'},
  {_id:'65d4f1a1e1b2c3d4e5f6a003',name:'Copas Menstruales',price:1000,desc:'Reutilizable, ecológica y cómoda.',image:'https://images.unsplash.com/photo-1603575448362-7b6d2d7f9d76?auto=format&fit=crop&w=800&q=60'},
  {_id:'65d4f1a1e1b2c3d4e5f6a004',name:'Toallitas Íntimas',price:1000,desc:'Frescor y cuidado íntimo.',image:'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=60'}
];

// Cargar productos de localStorage o usar los por defecto
function getProductsData() {
  const stored = localStorage.getItem('products');
  if (stored) {
    const data = JSON.parse(stored);
    // Migración: Si los datos viejos no tienen _id, reseteamos para evitar errores
    if(data.length > 0 && !data[0]._id) {
      localStorage.setItem('products', JSON.stringify(DEFAULT_PRODUCTS));
      return DEFAULT_PRODUCTS;
    }
    return data;
  }
  // Si es la primera vez, guardamos los default
  localStorage.setItem('products', JSON.stringify(DEFAULT_PRODUCTS));
  return DEFAULT_PRODUCTS;
}

// ---------- UTILIDADES ----------
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CL', {style: 'currency', currency: 'CLP'}).format(amount);
};

// ---------- RENDER ----------
function renderProducts(){
  const container = $('#products');
  container.innerHTML='';
  const products = getProductsData();
  products.forEach(p=>{
    const card = document.createElement('article');
    card.className='product-card';
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <h4>${p.name}</h4>
      <p>${p.desc}</p>
      <div class="card-actions">
        <strong>${formatCurrency(p.price)}</strong>
        <button class="btn primary" data-id="${p._id}">Agregar</button>
      </div>`;
    container.appendChild(card);
  });
}

// ---------- CARRITO ----------
function getCart(){
  return JSON.parse(localStorage.getItem('cart')||'[]');
}
function saveCart(items){
  localStorage.setItem('cart',JSON.stringify(items));
}
function addToCart(id){
  const products = getProductsData();
  const product = products.find(p=>p._id===id);
  if(!product) return;
  const cart = getCart();
  const item = cart.find(i=>i._id===id);
  if(item) item.qty+=1; else cart.push({_id:product._id,name:product.name,price:product.price,qty:1});
  saveCart(cart);
  renderCart();
}
function removeFromCart(id){
  let cart = getCart().filter(i=>i._id!==id);
  saveCart(cart);
  renderCart();
}
function renderCart(){
  const list = $('#cart-items');
  const count = $('#cart-count');
  const totalEl = $('#cart-total');
  const cart = getCart();
  list.innerHTML='';
  let total=0, qty=0;
  cart.forEach(i=>{
    const li = document.createElement('li');
    li.innerHTML = `${i.name} x ${i.qty} - ${formatCurrency(i.price*i.qty)} <button class="btn" data-remove="${i._id}">Eliminar</button>`;
    list.appendChild(li);
    total += i.price*i.qty; qty += i.qty;
  });
  totalEl.textContent = formatCurrency(total);
  count.textContent = qty;
}

// ---------- AUTH (demo localStorage) ----------
async function hashPassword(str) {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers(){
  return JSON.parse(localStorage.getItem('users')||'[]');
}
async function initAuth(){
  // Solo crea el admin si NO existe la clave 'users' (primera vez que se entra a la web)
  if(localStorage.getItem('users') === null){
    const hashedPassword = await hashPassword('admin');
    const defaultUsers = [{_id:generateObjectId(), name:'Administrador', email:'admin@bloomcare.com', password:hashedPassword}];
    localStorage.setItem('users',JSON.stringify(defaultUsers));
  }
}
function saveUsers(u){ localStorage.setItem('users',JSON.stringify(u)); }
async function registerUser(name,email,password){
  if(email === 'admin@bloomcare.com') return {ok:false,msg:'No se permite registrar cuenta de administrador.'};
  const users = getUsers();
  if(users.find(x=>x.email===email)) return {ok:false,msg:'Ya existe una cuenta con ese email'};
  const hashedPassword = await hashPassword(password);
  users.push({_id:generateObjectId(),name,email,password:hashedPassword});
  saveUsers(users);
  setCurrentUser({name,email});
  return {ok:true};
}
async function loginUser(email,password){
  const users = getUsers();
  const hashedPassword = await hashPassword(password);
  const user = users.find(u=>u.email===email && u.password===hashedPassword);
  if(!user) return {ok:false,msg:'Credenciales inválidas'};
  setCurrentUser({name:user.name,email:user.email});
  return {ok:true};
}
function setCurrentUser(u){ localStorage.setItem('currentUser',JSON.stringify(u)); renderAuthState(); }
function getCurrentUser(){ return JSON.parse(localStorage.getItem('currentUser')||'null'); }
function logout(){ localStorage.removeItem('currentUser'); renderAuthState(); }

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
    // Si es admin, agregar botón de panel
    if(user.email === 'admin@bloomcare.com') {
      const nav = $('nav');
      nav.insertAdjacentHTML('afterbegin', '<a href="/admin" id="btn-admin-panel" class="nav-btn" style="text-decoration:none; color:inherit; border-color: var(--color-accent); color: var(--color-accent);">Panel Admin</a>');
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
  
  if($('#btn-logout-profile')){
    $('#btn-logout-profile').addEventListener('click', ()=>{
      if(confirm('¿Seguro que quieres salir?')){
        logout();
        window.location.href = '/';
      }
    });
  }
}

function updateUserProfile(name, email){
  const currentUser = getCurrentUser();
  if(!currentUser) return;

  const users = getUsers();
  // Buscar al usuario en la lista por su email actual
  const index = users.findIndex(u => u.email === currentUser.email);
  
  if(index === -1) return alert('Error: Usuario no encontrado.');

  // Verificar si el nuevo email ya está en uso por otra persona
  if(email !== currentUser.email && users.some(u => u.email === email)){
    return alert('El correo electrónico ya está registrado por otro usuario.');
  }

  // Actualizar datos en la lista general
  users[index].name = name;
  users[index].email = email;
  saveUsers(users);
  
  // Actualizar sesión actual y UI
  setCurrentUser({...currentUser, name, email, _id: users[index]._id});
  if($('#profile-name')) $('#profile-name').textContent = name;
  alert('Perfil actualizado correctamente.');
}

// ---------- ADMIN ----------
function renderAdminPanel() {
  const user = getCurrentUser();
  // Protección simple de ruta
  if(!user || user.email !== 'admin@bloomcare.com') {
    alert('Acceso denegado. Debes ser administrador.');
    window.location.href = '/';
    return;
  }

  const form = $('#admin-product-form');
  if(form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#prod-name').value.trim();
      const desc = $('#prod-desc').value.trim();
      const price = parseFloat($('#prod-price').value);
      const image = $('#prod-image').value.trim();

      if(!name || !desc || isNaN(price) || !image) return alert('Todos los campos son obligatorios');

      const products = getProductsData();
      const newId = generateObjectId(); // Generar ID estilo Mongo
      
      products.push({ _id: newId, name, price, desc, image });
      localStorage.setItem('products', JSON.stringify(products));
      
      alert('Producto agregado correctamente');
      form.reset();
    });
  }
}

// ---------- EVENTOS ----------
function setupEvents(){
  initAuth(); // Inicialización única de usuarios base
  // Solo renderizar si existen los elementos (para evitar errores en pag perfil)
  if($('#products')) renderProducts();
  if($('#cart-items')) renderCart();
  if($('#profile-name')) renderProfile(); // Lógica específica de perfil
  if($('#admin-product-form')) renderAdminPanel(); // Lógica específica de admin
  
  renderAuthState();
  if($('#year')) $('#year').textContent = new Date().getFullYear();

  document.addEventListener('click',e=>{
    if(e.target.matches('[data-id]')){
      addToCart(e.target.dataset.id); // Ya no usamos parseInt porque _id es string
    }
    if(e.target.matches('[data-remove]')){
      removeFromCart(e.target.dataset.remove); // Ya no usamos parseInt
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

  if($('#btn-cart')){
    $('#btn-cart').addEventListener('click',()=>{
      $('#cart').classList.toggle('hidden');
    });
  }

  if($('#btn-products')){
    $('#btn-products').addEventListener('click',()=>{
      window.scrollTo({top:0,behavior:'smooth'});
    });
  }

  // Helpers para errores
  const showError = (selector, msg) => $(selector).textContent = msg;
  const clearErrors = () => $$('.error-msg').forEach(el => el.textContent = '');
  
  // Helper para Spinner
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

  const closeModal = () => {
    $('#auth-modal').classList.add('hidden');
    clearErrors();
  };

  if($('#close-auth')) $('#close-auth').addEventListener('click', closeModal);

  // Cerrar modal al hacer clic fuera (en el fondo oscuro)
  if($('#auth-modal')){
    $('#auth-modal').addEventListener('click', (e) => {
      if (e.target.id === 'auth-modal') closeModal();
    });
  }

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
  if(regForm){
    regForm.addEventListener('submit',e=>{
      e.preventDefault();
      const btn = regForm.querySelector('button[type="submit"]');
      const name = $('#reg-name').value.trim();
      const email = $('#reg-email').value.trim();
      const pass = $('#reg-password').value;
      
      clearErrors();

      // Validación de formato de email con Regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if(!emailRegex.test(email)) return showError('#register-error', 'Por favor, introduce un email válido.');

      // Validación de longitud de contraseña
      if(pass.length < 6) return showError('#register-error', 'La contraseña debe tener al menos 6 caracteres.');

      // Activar spinner
      toggleLoading(btn, true);

      // Simular retardo de red (1.5 segundos)
      setTimeout(async () => {
        const r = await registerUser(name,email,pass);
        toggleLoading(btn, false); // Desactivar spinner

        if(!r.ok) return showError('#register-error', r.msg);
        
        alert('Registro correcto. Sesión iniciada.');
        closeModal();
        // Redirigir al perfil tras registro exitoso
        window.location.href = '/profile';
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
        
        alert('Bienvenida/o!');
        closeModal();
        // Redirigir al perfil tras login
        window.location.href = '/profile';
      }, 1500);
    });
  }

  // Checkout (demo)
  if($('#checkout-btn')){
    $('#checkout-btn').addEventListener('click',()=>{
      const cart = getCart();
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

  // Toggle mostrar/ocultar contraseña
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈'; // Icono de ocultar
      } else {
        input.type = 'password';
        btn.textContent = '👁️'; // Icono de mostrar
      }
    });
  });
}

// Inicialización
window.addEventListener('DOMContentLoaded',setupEvents);
