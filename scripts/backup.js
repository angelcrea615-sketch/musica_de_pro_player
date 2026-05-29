const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function runBackup() {
  const coleccion = 'canciones_listado'; // <--- CAMBIA ESTO POR EL NOMBRE REAL
  const snapshot = await db.collection(coleccion).get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  if (!fs.existsSync('data')) fs.mkdirSync('data');
  fs.writeFileSync(`data/${coleccion}.json`, JSON.stringify(data, null, 2));
}

runBackup();
