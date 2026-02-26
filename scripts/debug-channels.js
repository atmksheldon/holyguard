const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debugChannels() {
  try {
    console.log('Fetching all channels...\n');
    
    const channelsSnapshot = await db.collection('channels').get();
    
    console.log(`Total channels found: ${channelsSnapshot.size}\n`);
    
    // Group by organization
    const channelsByOrg = {};
    
    channelsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const orgId = data.organizationId;
      
      if (!channelsByOrg[orgId]) {
        channelsByOrg[orgId] = [];
      }
      
      channelsByOrg[orgId].push({
        id: doc.id,
        name: data.name,
        isDefault: data.isDefault,
        createdBy: data.createdBy,
      });
    });
    
    // Get org names
    for (const orgId in channelsByOrg) {
      const orgDoc = await db.collection('organizations').doc(orgId).get();
      const orgName = orgDoc.exists ? orgDoc.data().name : 'Unknown';
      
      console.log(`\n${orgName} (${orgId}):`);
      channelsByOrg[orgId].forEach(channel => {
        console.log(`  - #${channel.name} (ID: ${channel.id}, default: ${channel.isDefault})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

debugChannels();
