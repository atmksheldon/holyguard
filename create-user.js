const admin = require('firebase-admin');

// Initialize Firebase Admin with application default credentials
admin.initializeApp({
  projectId: 'holyguard-app'
});

const db = admin.firestore();

async function createUser() {
  try {
    await db.collection('users').doc('0NBP1UgzcyfeRQuceA0sNjIgK7w2').set({
      id: '0NBP1UgzcyfeRQuceA0sNjIgK7w2',
      name: 'Kate Libby',
      email: 'katelibby@starkinternational.se',
      role: 'security',
      organization_id: 'default-org',
      email_verified: true,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('User document created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error);
    process.exit(1);
  }
}

createUser();
