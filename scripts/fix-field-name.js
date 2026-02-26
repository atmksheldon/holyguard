const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixFieldName() {
  try {
    const uid = 'y6PIfyaZCzdyzvQCNl4ocyGYIVi1';
    
    console.log('Updating user document field name...');
    
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    
    console.log('Current data:', userData);
    
    // Update to use organizationId (camelCase) instead of organization_id
    await db.collection('users').doc(uid).update({
      organizationId: userData.organization_id,
    });
    
    console.log('\n✓ Updated organizationId field');
    console.log(`  Value: ${userData.organization_id}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

fixFieldName();
