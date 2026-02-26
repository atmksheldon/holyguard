const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function recreateUser() {
  try {
    const email = 'john@jhnwckdevops.com';
    
    // Get auth user
    const authUser = await auth.getUserByEmail(email);
    console.log(`Found auth user: ${authUser.uid}`);
    
    // Check if user document exists
    const userDoc = await db.collection('users').doc(authUser.uid).get();
    console.log(`User document exists: ${userDoc.exists}`);
    
    // Get ACME-ORG
    const orgsSnapshot = await db.collection('organizations')
      .where('name', '==', 'ACME-ORG')
      .limit(1)
      .get();
    
    const acmeOrgDocId = orgsSnapshot.docs[0].id;
    console.log(`ACME-ORG document ID: ${acmeOrgDocId}`);
    
    // Check channels
    const channelsSnapshot = await db.collection('channels')
      .where('organizationId', '==', acmeOrgDocId)
      .get();
    console.log(`Channels in ACME-ORG: ${channelsSnapshot.size}`);
    
    // Create or update user document
    await db.collection('users').doc(authUser.uid).set({
      id: authUser.uid,
      name: 'John',
      email: authUser.email,
      role: 'admin', // Make them admin
      organization_id: acmeOrgDocId,
      organizationId: acmeOrgDocId,
      email_verified: authUser.emailVerified,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    
    console.log('\n✓ User document created/updated');
    console.log(`\nAccount details:`);
    console.log(`  Email: ${email}`);
    console.log(`  UID: ${authUser.uid}`);
    console.log(`  Role: admin`);
    console.log(`  Organization: ACME-ORG (${acmeOrgDocId})`);
    console.log(`  Channels: ${channelsSnapshot.size}`);
    console.log('\nLog out and back in to see the changes.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

recreateUser();
