const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkOrganizations() {
  try {
    const orgsSnapshot = await db.collection('organizations').get();
    
    console.log(`\nTotal organizations: ${orgsSnapshot.size}\n`);
    
    const coords = {};
    
    orgsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`${data.name}:`);
      console.log(`  Address: ${data.address || 'N/A'}`);
      console.log(`  Latitude: ${data.latitude}`);
      console.log(`  Longitude: ${data.longitude}`);
      
      const key = `${data.latitude},${data.longitude}`;
      if (coords[key]) {
        coords[key].push(data.name);
      } else {
        coords[key] = [data.name];
      }
      console.log('');
    });
    
    console.log('\n=== DUPLICATE COORDINATES ===');
    Object.entries(coords).forEach(([coord, names]) => {
      if (names.length > 1) {
        console.log(`${coord}: ${names.join(', ')}`);
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOrganizations();
