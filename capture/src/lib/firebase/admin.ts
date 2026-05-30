import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { env } from '$env/dynamic/private';

// Initialize Firebase Admin using service account JSON
if (getApps().length === 0) {
  try {
    const serviceAccountPath = env.SERVICE_ACCOUNT_PATH || './service-account.json';
    
    console.log('🔍 Reading service account from:', serviceAccountPath);
    
    const serviceAccountJson = readFileSync(serviceAccountPath, 'utf-8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    console.log('✅ Service account loaded:');
    console.log('   - Project ID:', serviceAccount.project_id);
    console.log('   - Client Email:', serviceAccount.client_email);
    console.log('   - Private Key length:', serviceAccount.private_key?.length);
    console.log('   - Private Key starts with:', serviceAccount.private_key?.substring(0, 30));

    initializeApp({
      credential: cert(serviceAccount)
    });
    
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();