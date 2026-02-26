const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function moveToAcmeOrg() {
  try {
    const uid = 'y6PIfyaZCzdyzvQCNl4ocyGYIVi1';
    
    // Get ACME-ORG ID
    const orgsSnapshot = await db.collection('organizations')
      .where('name', '==', 'ACME-ORG')
      .limit(1)
      .get();
    
    if (orgsSnapshot.empty) {
      console.log('ERROR: ACME-ORG not found');
      return;
    }
    
    const acmeOrgDocId = orgsSnapshot.docs[0].id;
    const acmeOrgData = orgsSnapshot.docs[0].data();
    // Use the id field if it exists, otherwise use the document ID
    const acmeOrgId = acmeOrgData.id || acmeOrgDocId;
    
    console.log(`Found ACME-ORG:`);
    console.log(`  Document ID: ${acmeOrgDocId}`);
    console.log(`  Organization ID field: ${acmeOrgData.id}`);
    console.log(`  Using organizationId: ${acmeOrgId}`);
    
    // Check for channels in ACME-ORG (try both the ID field and document ID)
    let channelsSnapshot = await db.collection('channels')
      .where('organizationId', '==', acmeOrgId)
      .get();
    
    // If no channels found with id field, try with document ID
    if (channelsSnapshot.empty && acmeOrgData.id) {
      console.log('  Trying with document ID...');
      channelsSnapshot = await db.collection('channels')
        .where('organizationId', '==', acmeOrgDocId)
        .get();
    }
    
    console.log(`\nChannels in ACME-ORG: ${channelsSnapshot.size}`);
    channelsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - #${data.name} (${doc.id})`);
    });
    
    // Update user document
    console.log(`\nUpdating user to ACME-ORG...`);
    await db.collection('users').doc(uid).update({
      organization_id: acmeOrgId,
      organizationId: acmeOrgId,
    });
    
    console.log('✓ User moved to ACME-ORG');
    console.log('\nYou should now see channels in ACME-ORG after logging out and back in.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

moveToAcmeOrg();
