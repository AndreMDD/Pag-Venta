from flask import Flask, request, render_template, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db
from datetime import datetime, timedelta
from bson.objectid import ObjectId
import os


app = Flask(__name__)
app.secret_key = os.urandom(24) # Clave aleatoria: invalida sesiones al reiniciar la app
app.permanent_session_lifetime = timedelta(minutes=30) # La sesión expira tras 30 min de inactividad

# Ruta principal para cargar la aplicación (index.html)
@app.route('/')
def home():
    return render_template('index.html')

# Renovar sesión en cada petición para que cuente como "inactividad"
@app.before_request
def make_session_permanent():
    session.permanent = True

# --- RUTAS DE VISTAS (Faltaban estas) ---
@app.route('/profile')
def profile():
    # Renderiza la página de perfil
    return render_template('profile.html')

@app.route('/admin')
def admin():
    # Protección de ruta: Si no es admin, redirigir al inicio
    if session.get('rol') != 'admin':
        return redirect(url_for('home'))
    return render_template('admin.html')

# --- API: PRODUCTOS (Mongo) ---
@app.route('/api/products', methods=['GET'])
def get_products():
    db = get_db()
    
    # Parámetros de paginación
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 3)) # Límite bajo para probar paginación
    except ValueError:
        page = 1
        limit = 3
        
    skip = (page - 1) * limit

    # Verificar si hay productos, si no, crear defaults
    if db.products.count_documents({}) == 0:
        defaults = [
            {'name':'Compresas Suaves','price':1000,'desc':'Paquete de 20 compresas ultra suaves.','image':'https://images.unsplash.com/photo-1592928306923-7a1b9b2fec1b?auto=format&fit=crop&w=800&q=60'},
            {'name':'Protectores Diarios','price':1000,'desc':'Protectores discretos para el día a día.','image':'https://images.unsplash.com/photo-1542831371-d531d36971e6?auto=format&fit=crop&w=800&q=60'},
            {'name':'Copas Menstruales','price':1000,'desc':'Reutilizable, ecológica y cómoda.','image':'https://images.unsplash.com/photo-1603575448362-7b6d2d7f9d76?auto=format&fit=crop&w=800&q=60'},
            {'name':'Toallitas Íntimas','price':1000,'desc':'Frescor y cuidado íntimo.','image':'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=60'}
        ]
        db.products.insert_many(defaults)

    # Obtener total y productos de la página actual
    total_products = db.products.count_documents({})
    products_list = list(db.products.find().skip(skip).limit(limit))

    # Convertir ObjectId a string
    for p in products_list:
        p['_id'] = str(p['_id'])
        
    return jsonify({
        'products': products_list,
        'total': total_products,
        'page': page,
        'pages': (total_products + limit - 1) // limit, # División entera redondeada hacia arriba
        'has_next': (skip + limit) < total_products,
        'has_prev': page > 1
    })

# --- API: ACTUALIZAR PERFIL ---
@app.route('/api/profile', methods=['PUT'])
def update_profile():
    db = get_db()
    data = request.get_json()
    
    user_id = data.get('_id')
    if not user_id:
        return jsonify({'ok': False, 'msg': 'ID de usuario no proporcionado'}), 400

    db.users.update_one({'_id': ObjectId(user_id)}, {'$set': {'nombre': data.get('name'), 'email': data.get('email')}})
    return jsonify({'ok': True, 'msg': 'Perfil actualizado correctamente'})

# --- RUTA PARA REGISTRO (API) ---
@app.route('/registro', methods=['POST'])
def registrar_usuario():
    db = get_db()
    users_collection = db.users

    # 1. Recibir datos: Soporta JSON (fetch) o Formulario normal
    data = request.get_json(silent=True) if request.is_json else None
    if data:
        nombre = data.get('name')
        email = data.get('email')
        password_plana = data.get('password')
    else:
        nombre = request.form.get('name')
        email = request.form.get('email')
        password_plana = request.form.get('password')

    # Validar datos
    if not email or not password_plana:
        return jsonify({'ok': False, 'msg': 'Faltan datos obligatorios'}), 400

    # Verificar si ya existe
    if users_collection.find_one({'email': email}):
        return jsonify({'ok': False, 'msg': 'El correo ya está registrado'}), 400

    # 2. Hashear contraseña y guardar
    password_segura = generate_password_hash(password_plana)
    # Asignar rol admin si es el correo específico, sino cliente
    rol = "admin" if email == "admin@bloomcare.com" else "cliente"
    nuevo_usuario = {
        "nombre": nombre,
        "email": email,
        "password": password_segura,
        "rol": rol,
        "fecha_registro": datetime.now().strftime("%Y-%m-%d")
    }
    users_collection.insert_one(nuevo_usuario)
    
    return jsonify({'ok': True, 'msg': 'Usuario registrado con éxito'})

# --- RUTA PARA LOGIN (API) ---
@app.route('/login', methods=['POST'])
def login():
    db = get_db()
    users_collection = db.users
    
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = users_collection.find_one({'email': email})
    
    if user and check_password_hash(user['password'], password):
        rol = user.get('rol', 'cliente')

        # Guardar datos en la sesión del servidor
        session['user_id'] = str(user['_id'])
        session['rol'] = rol
        
        return jsonify({
            'ok': True, 
            'user': {'name': user['nombre'], 'email': user['email'], '_id': str(user['_id']), 'rol': rol}
        })
    
    return jsonify({'ok': False, 'msg': 'Credenciales inválidas'}), 401

# --- RUTA PARA LOGOUT ---
@app.route('/logout')
def logout():
    session.clear() # Borra la sesión del servidor
    return jsonify({'ok': True})

# --- RUTA PARA VERIFICAR SESIÓN ---
@app.route('/api/session')
def check_session():
    if 'user_id' in session:
        return jsonify({'ok': True})
    return jsonify({'ok': False})

# --- RUTA PARA CREAR ADMIN (Solo Admins) ---
@app.route('/api/admin/create-admin', methods=['POST'])
def create_admin():
    # Seguridad: Verificar que quien pide esto sea admin
    if session.get('rol') != 'admin':
        return jsonify({'ok': False, 'msg': 'Acceso denegado. Se requieren permisos de administrador.'}), 403

    db = get_db()
    data = request.get_json()
    
    nombre = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not nombre or not email or not password:
        return jsonify({'ok': False, 'msg': 'Faltan datos'}), 400

    if db.users.find_one({'email': email}):
        return jsonify({'ok': False, 'msg': 'El correo ya está registrado'}), 400

    hashed_pw = generate_password_hash(password)
    new_admin = {
        "nombre": nombre, "email": email, "password": hashed_pw,
        "rol": "admin", "fecha_registro": datetime.now().strftime("%Y-%m-%d")
    }
    db.users.insert_one(new_admin)
    return jsonify({'ok': True, 'msg': 'Administrador creado exitosamente'})

# --- RUTA PARA LISTAR ADMINS (Solo Admins) ---
@app.route('/api/admin/users', methods=['GET'])
def get_admins():
    if session.get('rol') != 'admin':
        return jsonify({'ok': False, 'msg': 'Acceso denegado'}), 403
    
    db = get_db()
    # Buscar usuarios con rol='admin'
    admins = list(db.users.find({'rol': 'admin'}))
    
    # Convertir ObjectId a string y limpiar datos sensibles
    result = []
    for a in admins:
        result.append({
            '_id': str(a['_id']),
            'nombre': a.get('nombre', 'Sin nombre'),
            'email': a.get('email')
        })
    
    return jsonify({'ok': True, 'admins': result})

# --- RUTA PARA ELIMINAR ADMIN (Solo Admins) ---
@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
def delete_admin(user_id):
    if session.get('rol') != 'admin':
        return jsonify({'ok': False, 'msg': 'Acceso denegado'}), 403

    # Evitar auto-eliminación
    if session.get('user_id') == user_id:
        return jsonify({'ok': False, 'msg': 'No puedes eliminar tu propia cuenta'}), 400

    db = get_db()
    result = db.users.delete_one({'_id': ObjectId(user_id), 'rol': 'admin'})
    
    if result.deleted_count > 0:
        return jsonify({'ok': True, 'msg': 'Administrador eliminado'})
    return jsonify({'ok': False, 'msg': 'Usuario no encontrado'}), 404

if __name__ == '__main__':
    app.run(debug=True)