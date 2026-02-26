const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Check if already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function createAdminInvite() {
  try {
    // Get ACME-ORG
    const orgsSnapshot = await db.collection('organizations')
      .where('name', '==', 'ACME-ORG')
      .limit(1)
      .get();
    
    if (orgsSnapshot.empty) {
      console.log('ERROR: ACME-ORG not found.');
      return;
    }
    
    const orgId = orgsSnapshot.docs[0].id;
    console.log(`Found ACME-ORG with ID: ${orgId}\n`);
    
    // Check current users in ACME-ORG
    const usersSnapshot = await db.collection('users')
      .where('organizationId', '==', orgId)
      .get();
    
    console.log(`Current users in ACME-ORG: ${usersSnapshot.size}`);
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.name || data.email} (${data.role})`);
    });
    console.log('');
    
    // Check if general channel exists
    const channelsSnapshot = await db.collection('channels')
      .where('organizationId', '==', orgId)
      .get();
    
    console.log(`Channels in ACME-ORG: ${channelsSnapshot.size}`);
    channelsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - #${data.name} (${data.isDefault ? 'default' : 'custom'})`);
    });
    console.log('');
    
    // Create admin invite code
    const inviteCode = 'ADMIN-ACME-2026';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    await db.collection('invite_codes').doc(inviteCode).set({
      code: inviteCode,
      organizationId: orgId,
      organizationName: 'ACME-ORG',
      role: 'admin',
      createdBy: 'system',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      maxUses: 100,
      usedCount: 0,
      isActive: true,
    });
    
    console.log('✅ Admin invite code created!');
    console.log(`Code: ${inviteCode}`);
    console.log(`Role: admin`);
    console.log(`Organization: ACME-ORG (${orgId})`);
    console.log(`Expires: ${expiresAt.toLocaleDateString()}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

createAdminInvite();
