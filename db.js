// db.js
const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017'; // cambia a tu URI si usas Atlas u otro puerto
const client = new MongoClient(uri);

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('gestionp'); // nombre de tu base de datos
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
  }
}

function getDB() {
  if (!db) {
    throw new Error('❌ Debes conectarte a la base de datos primero.');
  }
  return db;
}

module.exports = { connectDB, getDB };
