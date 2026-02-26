const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createDefaultChannels() {
  try {
    console.log('Starting channel migration...\n');
    
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    
    if (orgsSnapshot.empty) {
      console.log('No organizations found.');
      return;
    }
    
    console.log(`Found ${orgsSnapshot.size} organizations\n`);
    
    let channelsCreated = 0;
    let channelsExisted = 0;
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data();
      const orgName = orgData.name || 'Unknown';
      
      console.log(`Processing: ${orgName} (${orgId})`);
      
      // Check for existing channels
      const existingChannelsQuery = await db.collection('channels')
        .where('organizationId', '==', orgId)
        .get();
      
      const existingChannelNames = existingChannelsQuery.docs.map(doc => doc.data().name);
      const hasGeneral = existingChannelNames.includes('general');
      const hasWatchlist = existingChannelNames.includes('watchlist');
      
      let generalChannelRef = null;
      
      // Create general channel if it doesn't exist
      if (!hasGeneral) {
        generalChannelRef = await db.collection('channels').add({
          name: 'general',
          organizationId: orgId,
          createdBy: 'system',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isDefault: true,
        });
        console.log(`  ✓ Created #general channel (${generalChannelRef.id})`);
        channelsCreated++;
        
        // Update existing messages without channelId to use general channel
        const messagesQuery = await db.collection('team_messages')
          .where('organizationId', '==', orgId)
          .where('channelId', '==', null)
          .get();
        
        if (!messagesQuery.empty) {
          const batch = db.batch();
          messagesQuery.docs.forEach(doc => {
            batch.update(doc.ref, { channelId: generalChannelRef.id });
          });
          await batch.commit();
          console.log(`  ✓ Updated ${messagesQuery.size} existing messages to #general`);
        }
      } else {
        console.log(`  ✓ #general channel already exists`);
        channelsExisted++;
      }
      
      // Create watchlist channel if it doesn't exist
      if (!hasWatchlist) {
        const watchlistChannelRef = await db.collection('channels').add({
          name: 'watchlist',
          organizationId: orgId,
          createdBy: 'system',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isDefault: false,
        });
        console.log(`  ✓ Created #watchlist channel (${watchlistChannelRef.id})`);
        channelsCreated++;
      } else {
        console.log(`  ✓ #watchlist channel already exists`);
        channelsExisted++;
      }
      
      console.log('');
    }
    
    console.log('═══════════════════════════════════════');
    console.log('Migration Complete!');
    console.log(`Channels created: ${channelsCreated}`);
    console.log(`Channels already existed: ${channelsExisted}`);
    console.log('═══════════════════════════════════════');
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createDefaultChannels();
