require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: "holyguard-app.firebaseapp.com",
  projectId: "holyguard-app",
  storageBucket: "holyguard-app.firebasestorage.app",
  messagingSenderId: "1074509187586",
  appId: "1:1074509187586:web:57bc9dbfaf35957d52b51b",
  measurementId: "G-0F46BXBZL6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkLocations() {
  console.log('Checking organization locations...');
  try {
    const querySnapshot = await getDocs(collection(db, 'organizations'));
    console.log(`Found ${querySnapshot.size} organizations.`);
    
    let validCount = 0;
    let invalidCount = 0;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const lat = data.latitude;
      const lng = data.longitude;
      const name = data.name || 'Unnamed Org';
      
      const isValid = 
        typeof lat === 'number' && 
        typeof lng === 'number' && 
        !isNaN(lat) && 
        !isNaN(lng) &&
        (lat !== 0 || lng !== 0);

      if (isValid) {
        validCount++;
        console.log(`✅ [VALID] ${name}: (${lat}, ${lng})`);
      } else {
        invalidCount++;
        console.log(`❌ [INVALID] ${name}: (${lat}, ${lng})`);
      }
    });

    console.log('\n--- Summary ---');
    console.log(`Total: ${querySnapshot.size}`);
    console.log(`Valid Locations: ${validCount}`);
    console.log(`Invalid Locations: ${invalidCount}`);
    
    if (validCount === querySnapshot.size) {
      console.log('All locations should appear on the map.');
    } else {
      console.log(`${invalidCount} locations will NOT appear on the map due to invalid coordinates.`);
    }

  } catch (error) {
    console.error('Error checking locations:', error);
  }
}

checkLocations();
