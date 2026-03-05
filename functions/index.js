const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

// Get Firestore instance - this will use the (default) database
const db = admin.firestore();

// Secure access codes stored server-side
const ACCESS_CODES = {
  'SEC-882': { role: 'security', valid: true },
  'LEAD-991': { role: 'admin', valid: true },
  'MEM-001': { role: 'member', valid: true },
};

// Helper function to generate random invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  let code = 'JOIN-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code; // Format: JOIN-XXXX-XXXX
}

// Validate invite code (replaces validateAccessCode)
exports.validateInviteCode = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { inviteCode } = req.body;
    
    if (!inviteCode || typeof inviteCode !== 'string') {
      res.status(400).json({ valid: false, error: 'Invite code required' });
      return;
    }

    const normalized = inviteCode.trim().toUpperCase();
    
    // Query invite_codes collection
    const codesRef = db.collection('invite_codes');
    const snapshot = await codesRef.where('code', '==', normalized).limit(1).get();
    
    if (snapshot.empty) {
      res.status(200).json({ valid: false, error: 'Invalid invite code' });
      return;
    }
    
    const codeDoc = snapshot.docs[0];
    const codeData = codeDoc.data();
    
    // Validate code
    if (!codeData.isActive) {
      res.status(200).json({ valid: false, error: 'This invite code has been deactivated' });
      return;
    }
    
    // Check expiration
    if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) {
      res.status(200).json({ valid: false, error: 'This invite code has expired' });
      return;
    }
    
    // Check usage limit
    if (codeData.maxUses && codeData.usedCount >= codeData.maxUses) {
      res.status(200).json({ valid: false, error: 'This invite code has reached its usage limit' });
      return;
    }
    
    // Get organization details
    const orgDoc = await db.collection('organizations').doc(codeData.organizationId).get();
    const orgName = orgDoc.exists ? orgDoc.data().name : 'Unknown Organization';
    
    // Increment usage count
    await codesRef.doc(codeDoc.id).update({
      usedCount: admin.firestore.FieldValue.increment(1)
    });
    
    res.status(200).json({
      valid: true,
      role: codeData.role,
      organizationId: codeData.organizationId,
      organizationName: orgName
    });
  } catch (error) {
    console.error('Error validating invite code:', error);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});

// Generate invite code (admin only)
exports.generateInviteCode = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    
    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      res.status(403).json({ error: 'Only admins can generate invite codes' });
      return;
    }
    
    const { role, expiresInDays, maxUses } = req.body;
    const organizationId = userDoc.data().organization_id;
    
    // Validate role
    if (!role || !['admin', 'security', 'member'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    
    // Generate unique code
    let code;
    let isUnique = false;
    const codesRef = db.collection('invite_codes');
    
    while (!isUnique) {
      code = generateInviteCode();
      const existing = await codesRef.where('code', '==', code).limit(1).get();
      isUnique = existing.empty;
    }
    
    // Calculate expiration
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }
    
    // Create invite code document
    const inviteData = {
      code,
      organizationId,
      role,
      createdBy: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(expiresAt) : null,
      maxUses: maxUses || null,
      usedCount: 0,
      isActive: true
    };
    
    await codesRef.add(inviteData);
    
    res.status(200).json({
      success: true,
      code,
      role,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      maxUses: maxUses || null
    });
  } catch (error) {
    console.error('Error generating invite code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Keep old validateAccessCode for backward compatibility (temporary)
exports.validateAccessCode = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { accessCode } = req.body;
    
    if (!accessCode || typeof accessCode !== 'string') {
      res.status(400).json({ valid: false, error: 'Access code required' });
      return;
    }

    const normalized = accessCode.trim().toUpperCase();
    const codeData = ACCESS_CODES[normalized];
    
    if (codeData && codeData.valid) {
      res.status(200).json({ valid: true, role: codeData.role });
    } else {
      res.status(200).json({ valid: false });
    }
  } catch (error) {
    console.error('Error validating access code:', error);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});

// HTTPS function to get user profile
exports.getUserProfile = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    // Get the auth token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    
    console.log('Fetching profile for user:', userId);

    // Fetch user document from Firestore
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    const userData = userDoc.data();
    
    res.status(200).json({
      id: userId,
      name: userData.name,
      role: userData.role,
      organizationId: userData.organization_id,
      emailVerified: decodedToken.email_verified || false
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// ORGANIZATION VERIFICATION FUNCTIONS
// =============================================

// Read from environment variable. Set via functions/.env file (Firebase Functions v2 loads it automatically)
// or via: firebase functions:config:set google.places_api_key="YOUR_KEY"
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const AUTO_APPROVE_THRESHOLD = 60;

const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
  'gmx.com', 'live.com', 'msn.com', 'comcast.net', 'att.net',
  'verizon.net', 'me.com', 'mac.com',
];

// Helper: Verify auth token and return userId
async function verifyAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken.uid;
}

// Helper: Set CORS headers
function setCorsHeaders(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

// Helper: Check Google Places for a place of worship
async function checkGooglePlaces(orgName, address, lat, lng) {
  const result = {
    status: 'failed',
    score: 0,
    placeId: null,
    details: '',
    checkedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const query = encodeURIComponent(`${orgName} ${address}`);
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name,formatted_address,types,geometry&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.candidates || data.candidates.length === 0) {
      result.details = 'No matching place found on Google Maps';
      return result;
    }

    const place = data.candidates[0];
    const worshipTypes = ['church', 'place_of_worship', 'hindu_temple', 'mosque', 'synagogue'];
    const isWorshipPlace = place.types && place.types.some(t => worshipTypes.includes(t));

    // Check location proximity (within ~500m)
    let locationMatch = false;
    if (place.geometry && place.geometry.location) {
      const placeLat = place.geometry.location.lat;
      const placeLng = place.geometry.location.lng;
      const distance = Math.sqrt(Math.pow(placeLat - lat, 2) + Math.pow(placeLng - lng, 2));
      locationMatch = distance < 0.005; // ~500m
    }

    if (isWorshipPlace && locationMatch) {
      result.status = 'passed';
      result.score = 30;
      result.placeId = place.place_id;
      result.details = `Found "${place.name}" as place of worship at matching location`;
    } else if (locationMatch) {
      result.status = 'passed';
      result.score = 20;
      result.placeId = place.place_id;
      result.details = `Found "${place.name}" at matching location (not categorized as place of worship)`;
    } else if (isWorshipPlace) {
      result.status = 'passed';
      result.score = 10;
      result.placeId = place.place_id;
      result.details = `Found "${place.name}" as place of worship but location differs`;
    } else {
      result.details = `Found "${place.name}" but no worship type or location match`;
    }
  } catch (error) {
    console.error('Google Places check error:', error);
    result.details = 'Error contacting Google Places API';
  }

  return result;
}

// Helper: Check EIN via ProPublica Nonprofit Explorer
async function checkEIN(ein, orgName) {
  const result = {
    status: 'skipped',
    score: 0,
    nonprofitName: null,
    details: '',
    checkedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!ein) {
    result.details = 'EIN not provided';
    return result;
  }

  try {
    const cleanEIN = ein.replace(/\D/g, '');
    if (cleanEIN.length !== 9) {
      result.status = 'failed';
      result.details = 'Invalid EIN format (must be 9 digits)';
      return result;
    }

    const url = `https://projects.propublica.org/nonprofits/api/v2/organizations/${cleanEIN}.json`;
    const response = await fetch(url);

    if (response.status === 404) {
      result.status = 'failed';
      result.details = 'EIN not found in IRS nonprofit database';
      return result;
    }

    const data = await response.json();
    const org = data.organization;

    if (!org) {
      result.status = 'failed';
      result.details = 'Invalid response from nonprofit database';
      return result;
    }

    result.nonprofitName = org.name;
    const isReligious = org.ntee_code && org.ntee_code.startsWith('X');

    // Check name similarity (basic)
    const orgNameLower = orgName.toLowerCase();
    const nonprofitNameLower = org.name.toLowerCase();
    const nameMatch = orgNameLower.includes(nonprofitNameLower) ||
                      nonprofitNameLower.includes(orgNameLower) ||
                      orgNameLower.split(' ').some(word =>
                        word.length > 3 && nonprofitNameLower.includes(word)
                      );

    if (nameMatch || isReligious) {
      result.status = 'passed';
      result.score = 30;
      result.details = `Found "${org.name}" (${isReligious ? 'Religious org' : 'Nonprofit'}) - EIN verified`;
    } else {
      result.status = 'passed';
      result.score = 15;
      result.details = `Found "${org.name}" but name doesn't closely match "${orgName}"`;
    }
  } catch (error) {
    console.error('EIN check error:', error);
    result.status = 'failed';
    result.details = 'Error checking nonprofit database';
  }

  return result;
}

// Helper: Recalculate score and possibly auto-approve
async function recalculateAndUpdateStatus(orgId) {
  const checksDoc = await db.collection('organizations').doc(orgId)
    .collection('verification').doc('checks').get();

  if (!checksDoc.exists) return;

  const checks = checksDoc.data();
  const totalScore = (checks.googlePlaces?.score || 0) +
                     (checks.einVerification?.score || 0) +
                     (checks.emailDomain?.score || 0) +
                     (checks.phoneSms?.score || 0);

  const autoApproved = totalScore >= AUTO_APPROVE_THRESHOLD;

  await db.collection('organizations').doc(orgId)
    .collection('verification').doc('checks').update({
      totalScore,
      autoApproved,
    });

  if (autoApproved) {
    await db.collection('organizations').doc(orgId).update({
      status: 'verified',
      verificationScore: totalScore,
      verificationCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await db.collection('organizations').doc(orgId).update({
      verificationScore: totalScore,
    });
  }

  return { totalScore, autoApproved };
}

// Main verification orchestrator
exports.verifyOrganization = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { organizationId, ein, orgEmail, phone, website } = req.body;
    if (!organizationId) {
      res.status(400).json({ error: 'organizationId required' });
      return;
    }

    // Get the organization document
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
      // Try querying by id field (existing pattern)
      const orgQuery = await db.collection('organizations').where('id', '==', organizationId).limit(1).get();
      if (orgQuery.empty) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      var orgRef = orgQuery.docs[0].ref;
      var orgData = orgQuery.docs[0].data();
      var orgDocId = orgQuery.docs[0].id;
    } else {
      var orgRef = orgDoc.ref;
      var orgData = orgDoc.data();
      var orgDocId = orgDoc.id;
    }

    // Run Google Places check (always)
    const placesResult = await checkGooglePlaces(
      orgData.name, orgData.address, orgData.latitude, orgData.longitude
    );

    // Run EIN check (if provided)
    const einResult = await checkEIN(ein, orgData.name);

    // Email and phone are verified separately (async flow)
    const emailResult = {
      status: orgEmail ? 'pending' : 'skipped',
      score: 0,
      domain: orgEmail ? orgEmail.split('@')[1] : null,
      details: orgEmail ? 'Awaiting email verification' : 'Organization email not provided',
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const phoneResult = {
      status: phone ? 'pending' : 'skipped',
      score: 0,
      details: phone ? 'Awaiting phone verification' : 'Phone not provided',
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const totalScore = placesResult.score + einResult.score;
    const autoApproved = totalScore >= AUTO_APPROVE_THRESHOLD;

    // Store verification checks
    await db.collection('organizations').doc(orgDocId)
      .collection('verification').doc('checks').set({
        googlePlaces: placesResult,
        einVerification: einResult,
        emailDomain: emailResult,
        phoneSms: phoneResult,
        totalScore,
        autoApproved,
      });

    // Update org status
    const newStatus = autoApproved ? 'verified' : 'pending';
    await orgRef.update({
      status: newStatus,
      verificationScore: totalScore,
      ein: ein || null,
      website: website || null,
      orgEmail: orgEmail || null,
      phone: phone || null,
      verificationSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(autoApproved ? { verificationCompletedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    });

    res.status(200).json({
      status: newStatus,
      score: totalScore,
      checks: {
        googlePlaces: { status: placesResult.status, score: placesResult.score, details: placesResult.details },
        einVerification: { status: einResult.status, score: einResult.score, details: einResult.details },
        emailDomain: { status: emailResult.status, score: emailResult.score },
        phoneSms: { status: phoneResult.status, score: phoneResult.score },
      },
    });
  } catch (error) {
    console.error('Error verifying organization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send organization email verification code
exports.sendOrgEmailVerification = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { organizationId, email } = req.body;
    if (!organizationId || !email) {
      res.status(400).json({ error: 'organizationId and email required' });
      return;
    }

    // Check for free email domains
    const domain = email.split('@')[1]?.toLowerCase();
    if (FREE_EMAIL_DOMAINS.includes(domain)) {
      res.status(400).json({ error: 'Please use your organization email, not a free email provider' });
      return;
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store code in verification subcollection
    await db.collection('organizations').doc(organizationId)
      .collection('verification').doc('emailCode').set({
        code,
        email,
        domain,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        attempts: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Send email via Firestore mail collection (Firebase Trigger Email extension)
    await db.collection('mail').add({
      to: email,
      message: {
        subject: 'HolyGuard - Organization Email Verification',
        text: `Your verification code is: ${code}\n\nThis code expires in 1 hour.\n\nIf you did not request this, please ignore this email.`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #8B4513;">HolyGuard Verification</h2>
          <p>Your organization email verification code is:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #2F2F2F;">${code}</span>
          </div>
          <p style="color: #666;">This code expires in 1 hour.</p>
          <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>`,
      },
    });

    res.status(200).json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('Error sending org email verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Confirm organization email verification code
exports.confirmOrgEmail = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { organizationId, code } = req.body;
    if (!organizationId || !code) {
      res.status(400).json({ error: 'organizationId and code required' });
      return;
    }

    const codeRef = db.collection('organizations').doc(organizationId)
      .collection('verification').doc('emailCode');
    const codeDoc = await codeRef.get();

    if (!codeDoc.exists) {
      res.status(400).json({ error: 'No verification code found. Please request a new one.' });
      return;
    }

    const codeData = codeDoc.data();

    // Check attempts
    if (codeData.attempts >= 5) {
      res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
      return;
    }

    // Check expiry
    if (codeData.expiresAt.toDate() < new Date()) {
      res.status(400).json({ error: 'Code has expired. Please request a new one.' });
      return;
    }

    // Increment attempts
    await codeRef.update({ attempts: admin.firestore.FieldValue.increment(1) });

    // Verify code
    if (codeData.code !== code.trim()) {
      res.status(400).json({ error: 'Invalid code' });
      return;
    }

    // Update email verification check
    const checksRef = db.collection('organizations').doc(organizationId)
      .collection('verification').doc('checks');

    await checksRef.update({
      emailDomain: {
        status: 'passed',
        score: 25,
        domain: codeData.domain,
        details: `Verified ownership of ${codeData.email}`,
        checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    // Recalculate score and possibly auto-approve
    const result = await recalculateAndUpdateStatus(organizationId);

    res.status(200).json({
      success: true,
      totalScore: result.totalScore,
      autoApproved: result.autoApproved,
      status: result.autoApproved ? 'verified' : 'pending',
    });
  } catch (error) {
    console.error('Error confirming org email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Confirm phone verification (after client-side Firebase Auth phone flow)
exports.confirmPhoneVerification = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { organizationId, phoneNumber } = req.body;
    if (!organizationId || !phoneNumber) {
      res.status(400).json({ error: 'organizationId and phoneNumber required' });
      return;
    }

    // Mask phone for storage
    const maskedPhone = phoneNumber.replace(/\d(?=\d{4})/g, '*');

    // Update phone verification check
    const checksRef = db.collection('organizations').doc(organizationId)
      .collection('verification').doc('checks');

    await checksRef.update({
      phoneSms: {
        status: 'passed',
        score: 15,
        details: `Phone verified: ${maskedPhone}`,
        checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    // Recalculate score and possibly auto-approve
    const result = await recalculateAndUpdateStatus(organizationId);

    res.status(200).json({
      success: true,
      totalScore: result.totalScore,
      autoApproved: result.autoApproved,
      status: result.autoApproved ? 'verified' : 'pending',
    });
  } catch (error) {
    console.error('Error confirming phone verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Super admin: Review organization (approve or reject)
exports.reviewOrganization = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify super_admin role
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data().role !== 'super_admin') {
      res.status(403).json({ error: 'Only super admins can review organizations' });
      return;
    }

    const { organizationId, action, reason } = req.body;
    if (!organizationId || !action || !['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: 'organizationId and action (approve/reject) required' });
      return;
    }

    const newStatus = action === 'approve' ? 'verified' : 'rejected';

    // Update organization status
    await db.collection('organizations').doc(organizationId).update({
      status: newStatus,
      ...(action === 'reject' ? { rejectionReason: reason || 'Did not meet verification requirements' } : {}),
      verificationCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update verification checks with reviewer info
    const checksRef = db.collection('organizations').doc(organizationId)
      .collection('verification').doc('checks');
    const checksDoc = await checksRef.get();
    if (checksDoc.exists) {
      await checksRef.update({
        reviewedBy: userId,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(action === 'approve' ? { autoApproved: false } : {}),
      });
    }

    res.status(200).json({
      success: true,
      status: newStatus,
      organizationId,
    });
  } catch (error) {
    console.error('Error reviewing organization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
