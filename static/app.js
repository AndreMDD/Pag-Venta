// Lógica simple de frontend: productos, carrito y auth en localStorage
const PRODUCTS = [
  {id:1,name:'Compresas Suaves',price:5.99,desc:'Paquete de 20 compresas ultra suaves.',image:'https://images.unsplash.com/photo-1592928306923-7a1b9b2fec1b?auto=format&fit=crop&w=800&q=60'},
  {id:2,name:'Protectores Diarios',price:3.49,desc:'Protectores discretos para el día a día.',image:'https://images.unsplash.com/photo-1542831371-d531d36971e6?auto=format&fit=crop&w=800&q=60'},
  {id:3,name:'Copas Menstruales',price:19.99,desc:'Reutilizable, ecológica y cómoda.',image:'https://images.unsplash.com/photo-1603575448362-7b6d2d7f9d76?auto=format&fit=crop&w=800&q=60'},
  {id:4,name:'Toallitas Íntimas',price:4.5,desc:'Frescor y cuidado íntimo.',image:'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=60'}
];

// ---------- UTILIDADES ----------
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

// ---------- RENDER ----------
function renderProducts(){
  const container = $('#products');
  container.innerHTML='';
  PRODUCTS.forEach(p=>{
    const card = document.createElement('article');
    card.className='product-card';
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <h4>${p.name}</h4>
      <p>${p.desc}</p>
      <div class="card-actions">
        <strong>$${p.price.toFixed(2)}</strong>
        <button class="btn primary" data-id="${p.id}">Agregar</button>
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
  const product = PRODUCTS.find(p=>p.id===id);
  if(!product) return;
  const cart = getCart();
  const item = cart.find(i=>i.id===id);
  if(item) item.qty+=1; else cart.push({id:product.id,name:product.name,price:product.price,qty:1});
  saveCart(cart);
  renderCart();
}
function removeFromCart(id){
  let cart = getCart().filter(i=>i.id!==id);
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
    li.innerHTML = `${i.name} x ${i.qty} - $${(i.price*i.qty).toFixed(2)} <button class="btn" data-remove="${i.id}">Eliminar</button>`;
    list.appendChild(li);
    total += i.price*i.qty; qty += i.qty;
  });
  totalEl.textContent = total.toFixed(2);
  count.textContent = qty;
}

// ---------- AUTH (demo localStorage) ----------
function getUsers(){
  return JSON.parse(localStorage.getItem('users')||'[]');
}
function saveUsers(u){ localStorage.setItem('users',JSON.stringify(u)); }
function registerUser(name,email,password){
  const users = getUsers();
  if(users.find(x=>x.email===email)) return {ok:false,msg:'Ya existe una cuenta con ese email'};
  users.push({id:Date.now(),name,email,password});
  saveUsers(users);
  setCurrentUser({name,email});
  return {ok:true};
}
function loginUser(email,password){
  const users = getUsers();
  const user = users.find(u=>u.email===email && u.password===password);
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

  if(user){
    btn.textContent = `Hola, ${user.name}`;
    btn.onclick = ()=>{
      // En lugar de alert, vamos al perfil
      window.location.href = '/profile';
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
  if($('#profile-id')) $('#profile-id').value = user.id || 'N/A';
  
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
  setCurrentUser({...currentUser, name, email, id: users[index].id});
  if($('#profile-name')) $('#profile-name').textContent = name;
  alert('Perfil actualizado correctamente.');
}

// ---------- EVENTOS ----------
function setupEvents(){
  // Solo renderizar si existen los elementos (para evitar errores en pag perfil)
  if($('#products')) renderProducts();
  if($('#cart-items')) renderCart();
  if($('#profile-name')) renderProfile(); // Lógica específica de perfil
  
  renderAuthState();
  if($('#year')) $('#year').textContent = new Date().getFullYear();

  document.addEventListener('click',e=>{
    if(e.target.matches('[data-id]')){
      addToCart(parseInt(e.target.dataset.id));
    }
    if(e.target.matches('[data-remove]')){
      removeFromCart(parseInt(e.target.dataset.remove));
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
      setTimeout(() => {
        const r = registerUser(name,email,pass);
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

      setTimeout(() => {
        const r = loginUser(email,pass);
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
      alert(`Gracias ${user.name}, tu pedido por $${cart.reduce((s,i)=>s+i.price*i.qty,0).toFixed(2)} ha sido registrado (simulado).`);
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
