const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { firebaseConfig } = require('../src/config/firebase');

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
      console.log(`${invalidCount} locations will NOT appear on the map.`);
    }

  } catch (error) {
    console.error('Error checking locations:', error);
  }
}

checkLocations();
