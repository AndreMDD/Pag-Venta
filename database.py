
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = "mongodb+srv://admin:DoDrD71Kh8RZCOX2@clusterbloomcare.gyeiata.mongodb.net/?appName=ClusterBloomCare"

# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

def get_db():
    # Retorna la base de datos 'bloomcare'
    return client.bloomcare

# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)