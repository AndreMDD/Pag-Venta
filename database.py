from pymongo import MongoClient
import os

# Configuración de conexión a MongoDB
# Puedes cambiar 'localhost' por la URL de MongoDB Atlas si lo subes a la nube
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/bloomcare')

def get_db():
    """
    Establece la conexión y retorna la instancia de la base de datos.
    """
    client = MongoClient(MONGO_URI)
    db = client.get_database()
    return db

# Bloque de prueba para verificar conexión al ejecutar este archivo
if __name__ == "__main__":
    db = get_db()
    print(f"Conectado exitosamente a la base de datos: {db.name}")