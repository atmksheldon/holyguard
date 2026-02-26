const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'holyguard-app'
});

async function test() {
  try {
    const db = admin.firestore();
    console.log('Firestore initialized');
    
    // Try to list collections
    const collections = await db.listCollections();
    console.log('Collections:', collections.map(c => c.id));
    
    // Try to get the specific document
    const userDoc = await db.collection('users').doc('0NBP1UgzcyfeRQuceA0sNjIgK7w2').get();
    console.log('User doc exists:', userDoc.exists);
    if (userDoc.exists) {
      console.log('User data:', userDoc.data());
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
  process.exit(0);
}

test();
