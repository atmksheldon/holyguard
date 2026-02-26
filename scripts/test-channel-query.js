const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testChannelQuery() {
  try {
    const email = 'john@jhnwckdevops.com';
    
    // Get user
    const auth = admin.auth();
    const authUser = await auth.getUserByEmail(email);
    
    const userDoc = await db.collection('users').doc(authUser.uid).get();
    const userData = userDoc.data();
    
    const orgId = userData.organizationId || userData.organization_id;
    
    console.log('Testing Channel Query');
    console.log('====================');
    console.log(`User: ${userData.name}`);
    console.log(`Org ID: ${orgId}\n`);
    
    // Test the exact query the app uses
    console.log('Running query:');
    console.log(`  where('organizationId', '==', '${orgId}')`);
    console.log(`  where('isDefault', '==', true)`);
    console.log(`  limit(1)\n`);
    
    try {
      const channelsQuery = await db.collection('channels')
        .where('organizationId', '==', orgId)
        .where('isDefault', '==', true)
        .limit(1)
        .get();
      
      console.log(`✓ Query successful!`);
      console.log(`Found ${channelsQuery.size} channel(s)\n`);
      
      if (channelsQuery.size > 0) {
        channelsQuery.docs.forEach(doc => {
          const data = doc.data();
          console.log(`Channel: #${data.name}`);
          console.log(`  ID: ${doc.id}`);
          console.log(`  organizationId: ${data.organizationId}`);
          console.log(`  isDefault: ${data.isDefault}`);
        });
      } else {
        console.log('❌ No channels found with this query');
      }
      
    } catch (queryError) {
      console.error('❌ Query FAILED:');
      console.error(queryError.message);
      
      if (queryError.message.includes('index')) {
        console.log('\n⚠️  MISSING FIRESTORE INDEX!');
        console.log('You need to create a composite index in Firestore.');
        console.log('\nGo to Firebase Console → Firestore → Indexes');
        console.log('Create index for collection "channels":');
        console.log('  - Field: organizationId (Ascending)');
        console.log('  - Field: isDefault (Ascending)');
      }
    }
    
    console.log('\n====================');
    console.log('If query succeeded but app still shows no channels,');
    console.log('the issue is in the app code or caching.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testChannelQuery();
