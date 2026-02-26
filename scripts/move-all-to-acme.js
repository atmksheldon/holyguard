const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function moveAllToAcme() {
  try {
    console.log('=== Moving All Users to ACME-ORG ===\n');
    
    // Get ACME-ORG
    const orgsSnapshot = await db.collection('organizations')
      .where('name', '==', 'ACME-ORG')
      .limit(1)
      .get();
    
    if (orgsSnapshot.empty) {
      console.log('ERROR: ACME-ORG not found');
      return;
    }
    
    const acmeOrgId = orgsSnapshot.docs[0].id;
    console.log(`ACME-ORG ID: ${acmeOrgId}`);
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`\nFound ${usersSnapshot.size} users\n`);
    
    let movedCount = 0;
    let alreadyInOrg = 0;
    
    const batch = db.batch();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const currentOrgId = userData.organizationId || userData.organization_id;
      
      if (currentOrgId === acmeOrgId) {
        console.log(`✓ ${userData.name || userData.email} - already in ACME-ORG`);
        alreadyInOrg++;
      } else {
        console.log(`→ Moving ${userData.name || userData.email} to ACME-ORG`);
        batch.update(userDoc.ref, {
          organizationId: acmeOrgId,
          organization_id: acmeOrgId,
        });
        movedCount++;
      }
    }
    
    if (movedCount > 0) {
      await batch.commit();
      console.log(`\n✓ Moved ${movedCount} user(s) to ACME-ORG`);
    }
    
    console.log(`✓ ${alreadyInOrg} user(s) already in ACME-ORG`);
    console.log('\n=== Summary ===');
    console.log(`Total users: ${usersSnapshot.size}`);
    console.log(`Moved: ${movedCount}`);
    console.log(`Already in org: ${alreadyInOrg}`);
    console.log('\nAll users are now in ACME-ORG and can message each other!');
    console.log('They need to log out and back in to see the changes.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

moveAllToAcme();
