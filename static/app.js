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
  if(user){
    btn.textContent = `Hola, ${user.name}`;
    btn.onclick = ()=>{
      if(confirm('¿Deseas cerrar sesión?')) logout();
    }
  } else {
    btn.textContent = 'Iniciar sesión / Registro';
    btn.onclick = ()=>{ $('#auth-modal').classList.remove('hidden'); }
  }
}

// ---------- EVENTOS ----------
function setupEvents(){
  renderProducts();
  renderCart();
  renderAuthState();
  $('#year').textContent = new Date().getFullYear();

  document.addEventListener('click',e=>{
    if(e.target.matches('[data-id]')){
      addToCart(parseInt(e.target.dataset.id));
    }
    if(e.target.matches('[data-remove]')){
      removeFromCart(parseInt(e.target.dataset.remove));
    }
  });

  $('#btn-cart').addEventListener('click',()=>{
    $('#cart').classList.toggle('hidden');
  });

  $('#btn-products').addEventListener('click',()=>{
    window.scrollTo({top:0,behavior:'smooth'});
  });

  $('#close-auth').addEventListener('click',()=>$('#auth-modal').classList.add('hidden'));
  $('#show-register').addEventListener('click',(e)=>{e.preventDefault();$('#login-form').classList.add('hidden');$('#register-form').classList.remove('hidden');});
  $('#show-login').addEventListener('click',(e)=>{e.preventDefault();$('#login-form').classList.remove('hidden');$('#register-form').classList.add('hidden');});

  // Register
  $('#register-form').addEventListener('submit',e=>{
    e.preventDefault();
    const name = $('#reg-name').value.trim();
    const email = $('#reg-email').value.trim();
    const pass = $('#reg-password').value;
    const r = registerUser(name,email,pass);
    if(!r.ok) return alert(r.msg);
    alert('Registro correcto. Sesión iniciada.');
    $('#auth-modal').classList.add('hidden');
  });

  // Login
  $('#login-form').addEventListener('submit',e=>{
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const pass = $('#login-password').value;
    const r = loginUser(email,pass);
    if(!r.ok) return alert(r.msg);
    alert('Bienvenida/o!');
    $('#auth-modal').classList.add('hidden');
  });

  // Checkout (demo)
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

// Inicialización
window.addEventListener('DOMContentLoaded',setupEvents);
