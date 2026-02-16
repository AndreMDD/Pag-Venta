from flask import Flask, request, render_template, redirect, url_for
from pymongo import MongoClient
# 1. IMPORTANTE: Importar la función de hashing aquí arriba
from werkzeug.security import generate_password_hash

app = Flask(__name__)

# Configuración de MongoDB (la que ya vimos)
client = MongoClient("tu_string_de_conexion_de_mongo_atlas")
db = client.tienda_bloomcare
users_collection = db.users

# --- RUTA PARA MOSTRAR EL FORMULARIO DE REGISTRO ---
@app.route('/registro', methods=['GET'])
def mostrar_registro():
    return render_template('registro.html') # Tu archivo HTML del formulario

# --- RUTA PARA PROCESAR LOS DATOS (EL PASO 1) ---
@app.route('/registro', methods=['POST'])
def registrar_usuario():
    # A. Recibir datos del formulario HTML
    nombre = request.form['nombre']
    email = request.form['email']
    password_plana = request.form['password'] # La que escribió el usuario (ej: "hola123")

    # B. AQUÍ ES DONDE OCURRE LA MAGIA DEL HASH
    password_segura = generate_password_hash(password_plana)

    # C. Crear el objeto para guardar
    nuevo_usuario = {
        "nombre": nombre,
        "email": email,
        "password": password_segura, # Guardamos la encriptada
        "rol": "cliente" # Por defecto siempre es cliente
    }

    # D. Guardar en MongoDB
    users_collection.insert_one(nuevo_usuario)

    return "¡Usuario registrado con éxito!"

if __name__ == '__main__':
    app.run(debug=True)