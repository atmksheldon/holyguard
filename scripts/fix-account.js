const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function fixAccount() {
  try {
    const email = 'john@jhnwckdevops.com';
    const churchName = 'JohnWick DevOps'; // You can change this
    const address = 'Austin, TX'; // Default address
    
    console.log(`Fixing account: ${email}\n`);
    
    // Get auth user
    const authUser = await auth.getUserByEmail(email);
    console.log(`Found auth user: ${authUser.uid}`);
    
    // Create organization ID
    const orgId = `org_${Date.now()}`;
    console.log(`\nCreating organization with ID: ${orgId}`);
    
    // Create organization
    const orgRef = await db.collection('organizations').add({
      id: orgId,
      name: churchName,
      address: address,
      latitude: 30.2672, // Austin coordinates
      longitude: -97.7431,
      status: 'Active',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`✓ Created organization (${orgRef.id})`);
    
    // Create user document
    await db.collection('users').doc(authUser.uid).set({
      id: authUser.uid,
      name: authUser.displayName || 'John',
      email: authUser.email,
      role: 'admin', // First user is admin
      organization_id: orgId,
      email_verified: authUser.emailVerified,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`✓ Created user document`);
    
    // Create #general channel
    const channelRef = await db.collection('channels').add({
      name: 'general',
      organizationId: orgId,
      createdBy: authUser.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isDefault: true,
    });
    
    console.log(`✓ Created #general channel (${channelRef.id})`);
    
    console.log('\n✅ Account fixed! You can now log in.');
    console.log(`\nAccount details:`);
    console.log(`  Email: ${email}`);
    console.log(`  Role: admin`);
    console.log(`  Organization: ${churchName}`);
    console.log(`  Organization ID: ${orgId}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

fixAccount();
