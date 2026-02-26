const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createTestInviteCode() {
  try {
    // First, check if ACME-ORG exists
    const orgsSnapshot = await db.collection('organizations')
      .where('name', '==', 'ACME-ORG')
      .limit(1)
      .get();
    
    let orgId;
    let orgName = 'ACME-ORG';
    
    if (orgsSnapshot.empty) {
      console.log('ACME-ORG not found. Creating it...');
      
      // Create ACME-ORG for testing
      const orgRef = await db.collection('organizations').add({
        name: 'ACME-ORG',
        address: '123 Test Street, Austin, TX',
        coordinates: {
          latitude: 30.2672,
          longitude: -97.7431
        },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      orgId = orgRef.id;
      console.log(`Created ACME-ORG with ID: ${orgId}`);
    } else {
      orgId = orgsSnapshot.docs[0].id;
      console.log(`Found ACME-ORG with ID: ${orgId}`);
    }
    
    // Create test invite code
    const inviteCode = 'TEST-ACME-2026';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Expires in 30 days
    
    await db.collection('invite_codes').doc(inviteCode).set({
      code: inviteCode,
      organizationId: orgId,
      organizationName: orgName,
      role: 'member',
      createdBy: 'test-admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      maxUses: 100,
      usedCount: 0,
      isActive: true,
    });
    
    console.log(`\n✅ Test invite code created successfully!`);
    console.log(`Code: ${inviteCode}`);
    console.log(`Organization: ${orgName} (${orgId})`);
    console.log(`Expires: ${expiresAt.toLocaleDateString()}`);
    console.log(`Max uses: 100`);
    
  } catch (error) {
    console.error('Error creating test invite code:', error);
  } finally {
    process.exit(0);
  }
}

createTestInviteCode();
