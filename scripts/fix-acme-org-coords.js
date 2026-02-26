const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixAcmeOrg() {
  try {
    const orgsSnapshot = await db.collection('organizations')
      .where('name', '==', 'ACME-ORG')
      .get();
    
    if (orgsSnapshot.empty) {
      console.log('ACME-ORG not found');
      process.exit(1);
    }
    
    const orgDoc = orgsSnapshot.docs[0];
    console.log(`Found ACME-ORG: ${orgDoc.id}`);
    console.log('Current data:', orgDoc.data());
    
    // Update with valid Austin, TX coordinates
    await orgDoc.ref.update({
      latitude: 30.2672,
      longitude: -97.7431
    });
    
    console.log('\n✓ Updated ACME-ORG with Austin, TX coordinates');
    console.log('  Latitude: 30.2672');
    console.log('  Longitude: -97.7431');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAcmeOrg();
