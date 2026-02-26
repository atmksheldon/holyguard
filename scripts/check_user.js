const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function checkAndFixUser() {
  const email = 'eric.sifford@hushmail.com';
  
  console.log(`Checking user: ${email}`);
  
  try {
    // 1. Get user from Firebase Auth
    const userRecord = await auth.getUserByEmail(email);
    console.log('\n✅ User found in Firebase Auth:');
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Email: ${userRecord.email}`);
    console.log(`   Display Name: ${userRecord.displayName || 'Not set'}`);
    console.log(`   Email Verified: ${userRecord.emailVerified}`);
    
    // 2. Check if profile exists in Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (userDoc.exists()) {
      console.log('\n✅ User profile found in Firestore:');
      console.log(JSON.stringify(userDoc.data(), null, 2));
    } else {
      console.log('\n❌ User profile NOT found in Firestore');
      console.log('\nTo fix this, you need to:');
      console.log('1. Go to Firebase Console → Firestore Database');
      console.log('2. Open the "users" collection');
      console.log(`3. Create a new document with ID: ${userRecord.uid}`);
      console.log('4. Add these fields:');
      console.log(`   - name: "${userRecord.displayName || userRecord.email.split('@')[0]}"`);
      console.log('   - role: "member" (or "admin"/"security")');
      console.log('   - organizationId: "<their organization ID>"');
      console.log('   - emailVerified: true');
      
      console.log('\n\nOr I can create it automatically. What organization should they belong to?');
    }
    
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('\n❌ User not found in Firebase Auth');
      console.log('This user needs to sign up first.');
    } else {
      console.error('Error:', error);
    }
  }
}

checkAndFixUser();
