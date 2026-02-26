const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function comprehensiveCheck() {
  try {
    const email = 'john@jhnwckdevops.com';
    
    console.log('=== COMPREHENSIVE CHECK ===\n');
    
    // 1. Get auth user
    const authUser = await auth.getUserByEmail(email);
    console.log('1. Auth User:');
    console.log(`   UID: ${authUser.uid}`);
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Email Verified: ${authUser.emailVerified}`);
    
    // 2. Get user document
    console.log('\n2. Firestore User Document:');
    const userDoc = await db.collection('users').doc(authUser.uid).get();
    
    if (!userDoc.exists) {
      console.log('   ❌ USER DOCUMENT DOES NOT EXIST!');
      return;
    }
    
    const userData = userDoc.data();
    console.log('   ✓ Document exists');
    console.log(`   name: ${userData.name}`);
    console.log(`   email: ${userData.email}`);
    console.log(`   role: ${userData.role}`);
    console.log(`   organization_id: ${userData.organization_id}`);
    console.log(`   organizationId: ${userData.organizationId}`);
    
    const orgId = userData.organizationId || userData.organization_id;
    
    if (!orgId) {
      console.log('\n   ❌ NO ORGANIZATION ID FOUND!');
      return;
    }
    
    // 3. Check organization
    console.log(`\n3. Organization (looking for orgId: ${orgId}):`);
    
    // Try to find by document ID
    let orgDoc = await db.collection('organizations').doc(orgId).get();
    
    if (!orgDoc.exists) {
      // Try to find by id field
      console.log('   Not found by doc ID, trying id field...');
      const orgQuery = await db.collection('organizations')
        .where('id', '==', orgId)
        .limit(1)
        .get();
      
      if (!orgQuery.empty) {
        orgDoc = orgQuery.docs[0];
      }
    }
    
    if (!orgDoc.exists) {
      console.log('   ❌ ORGANIZATION NOT FOUND!');
      console.log('\n   Listing all organizations:');
      const allOrgs = await db.collection('organizations').limit(10).get();
      allOrgs.docs.forEach(doc => {
        const data = doc.data();
        console.log(`     - ${doc.id}: ${data.name} (id field: ${data.id})`);
      });
      return;
    }
    
    const orgData = orgDoc.data();
    console.log('   ✓ Organization found');
    console.log(`   Document ID: ${orgDoc.id}`);
    console.log(`   Name: ${orgData.name}`);
    console.log(`   ID field: ${orgData.id}`);
    
    // 4. Check channels
    console.log(`\n4. Channels (querying organizationId == "${orgId}"):`);
    const channelsQuery = await db.collection('channels')
      .where('organizationId', '==', orgId)
      .get();
    
    console.log(`   Found ${channelsQuery.size} channel(s)`);
    
    if (channelsQuery.empty) {
      console.log('   ❌ NO CHANNELS FOUND!');
      console.log('\n   Trying with document ID instead...');
      const channelsQuery2 = await db.collection('channels')
        .where('organizationId', '==', orgDoc.id)
        .get();
      console.log(`   Found ${channelsQuery2.size} channel(s) with doc ID`);
      
      if (channelsQuery2.size > 0) {
        console.log('\n   ⚠️  MISMATCH: Channels use document ID, but user has id field!');
        console.log(`   User organizationId: ${orgId}`);
        console.log(`   Organization doc ID: ${orgDoc.id}`);
        console.log('\n   Need to update user document to use: ' + orgDoc.id);
      }
    } else {
      channelsQuery.docs.forEach(doc => {
        const data = doc.data();
        console.log(`   ✓ #${data.name} (${doc.id}) ${data.isDefault ? '[DEFAULT]' : ''}`);
      });
    }
    
    console.log('\n=== END CHECK ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

comprehensiveCheck();
