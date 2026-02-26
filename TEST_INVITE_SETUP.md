# Test Invite Code Setup Instructions

To test the new invite-based signup flow, you need to create a test invite code in Firestore.

## Option 1: Using Firebase Console (Recommended)

1. Open Firebase Console: https://console.firebase.google.com/project/holyguard-app/firestore
2. Navigate to Firestore Database
3. Click on "invite_codes" collection (or create it if it doesn't exist)
4. Click "Add document"
5. Set Document ID: `TEST-ACME-2026`
6. Add the following fields:

```
code: "TEST-ACME-2026" (string)
organizationId: "<ACME-ORG-ID>" (string) - Get this from the organizations collection
organizationName: "ACME-ORG" (string)
role: "member" (string)
createdBy: "test-admin" (string)
createdAt: <Current timestamp> (timestamp)
expiresAt: <30 days from now> (timestamp)
maxUses: 100 (number)
usedCount: 0 (number)
isActive: true (boolean)
```

## Option 2: Get ACME-ORG ID

If ACME-ORG doesn't exist yet:
1. Go to Firebase Console → Firestore → organizations collection
2. Find ACME-ORG (or create it with the following fields):
   - name: "ACME-ORG"
   - address: "123 Test Street, Austin, TX"
   - coordinates: {latitude: 30.2672, longitude: -97.7431}
   - created_at: <Current timestamp>
3. Copy the organization's document ID
4. Use that ID in the invite_codes document as organizationId

## Testing the Invite Flow

Once the invite code is created:

1. **Join Existing Organization Flow:**
   - Open the app and go to signup
   - Step 1: Enter name, email, password
   - Step 2: Select "Join Existing Organization"
   - Enter invite code: `TEST-ACME-2026`
   - Proceed with signup - user should be added to ACME-ORG

2. **Create New Organization Flow:**
   - Step 1: Enter name, email, password
   - Step 2: Select "Create New Organization"
   - Step 3: Enter church name and address
   - Complete signup - new organization should be created with user as admin

## Verification

After testing:
- Check Firestore → users collection to verify new user has correct organizationId
- Check invite_codes → TEST-ACME-2026 to verify usedCount incremented
- Check organizations collection to verify new org was created (if testing create flow)
- Try logging in with the new user and verify they can see team messages from their org
