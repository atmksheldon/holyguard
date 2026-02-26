const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function debugAccount() {
  try {
    const email = 'john@jhnwckdevops.com';
    console.log(`Checking account: ${email}\n`);
    
    // 1. Check Firebase Auth
    console.log('=== Firebase Auth ===');
    try {
      const authUser = await auth.getUserByEmail(email);
      console.log(`✓ Auth user exists`);
      console.log(`  UID: ${authUser.uid}`);
      console.log(`  Email verified: ${authUser.emailVerified}`);
      console.log(`  Created: ${authUser.metadata.creationTime}`);
      
      // 2. Check Firestore user document
      console.log('\n=== Firestore User Document ===');
      const userDoc = await db.collection('users').doc(authUser.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log(`✓ User document exists`);
        console.log(`  Name: ${userData.name}`);
        console.log(`  Role: ${userData.role}`);
        console.log(`  Organization ID: ${userData.organization_id || userData.organizationId}`);
        
        const orgId = userData.organization_id || userData.organizationId;
        
        // 3. Check organization
        if (orgId) {
          console.log('\n=== Organization ===');
          const orgsSnapshot = await db.collection('organizations')
            .where('id', '==', orgId)
            .limit(1)
            .get();
          
          if (!orgsSnapshot.empty) {
            const orgData = orgsSnapshot.docs[0].data();
            console.log(`✓ Organization found`);
            console.log(`  ID: ${orgsSnapshot.docs[0].id}`);
            console.log(`  Name: ${orgData.name}`);
            console.log(`  Address: ${orgData.address}`);
            
            // 4. Check channels
            console.log('\n=== Channels ===');
            const channelsSnapshot = await db.collection('channels')
              .where('organizationId', '==', orgId)
              .get();
            
            if (channelsSnapshot.empty) {
              console.log(`✗ NO CHANNELS FOUND for org ${orgId}`);
              console.log(`\nCreating #general channel...`);
              
              const channelRef = await db.collection('channels').add({
                name: 'general',
                organizationId: orgId,
                createdBy: authUser.uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isDefault: true,
              });
              
              console.log(`✓ Created #general channel (${channelRef.id})`);
            } else {
              console.log(`✓ Found ${channelsSnapshot.size} channel(s):`);
              channelsSnapshot.docs.forEach(doc => {
                const channelData = doc.data();
                console.log(`  - #${channelData.name} (${doc.id}) ${channelData.isDefault ? '[DEFAULT]' : ''}`);
              });
            }
          } else {
            console.log(`✗ Organization not found with ID: ${orgId}`);
          }
        } else {
          console.log(`✗ User has no organization ID`);
        }
      } else {
        console.log(`✗ User document does not exist in Firestore`);
      }
    } catch (authError) {
      console.log(`✗ Auth user not found`);
      console.log(`  Error: ${authError.message}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

debugAccount();
