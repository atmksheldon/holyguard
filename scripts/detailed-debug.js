const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function detailedDebug() {
  try {
    const uid = 'y6PIfyaZCzdyzvQCNl4ocyGYIVi1';
    
    console.log('=== User Document (Raw) ===');
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    console.log(JSON.stringify(userData, null, 2));
    
    console.log('\n=== Field Check ===');
    console.log('Has organization_id:', 'organization_id' in userData);
    console.log('Has organizationId:', 'organizationId' in userData);
    console.log('organization_id value:', userData.organization_id);
    console.log('organizationId value:', userData.organizationId);
    
    const orgId = userData.organizationId || userData.organization_id;
    
    console.log('\n=== Channel Query Test ===');
    console.log(`Querying channels with organizationId == "${orgId}"`);
    
    const channelsSnapshot = await db.collection('channels')
      .where('organizationId', '==', orgId)
      .get();
    
    console.log(`Found ${channelsSnapshot.size} channel(s)`);
    
    if (channelsSnapshot.empty) {
      console.log('\n⚠️  NO CHANNELS FOUND WITH THIS QUERY');
      
      // Try to find ANY channels
      console.log('\nSearching for ALL channels...');
      const allChannels = await db.collection('channels').get();
      console.log(`Total channels in database: ${allChannels.size}`);
      
      allChannels.docs.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${doc.id}: organizationId="${data.organizationId}", name="${data.name}"`);
      });
    } else {
      channelsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`  ✓ ${data.name} (${doc.id})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

detailedDebug();
