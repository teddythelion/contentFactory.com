import { adminAuth } from '$lib/firebase/admin';
import { startTempSweeper } from '$lib/server/tempSweeper';
import type { Handle } from '@sveltejs/kit';

// Reap orphaned capture temp files (RAM-backed /dev/shm on the VPS) — starts
// once at boot, then hourly.
startTempSweeper();

const SESSION_14_DAYS = 60 * 60 * 24 * 14 * 1000;
const REFRESH_THRESHOLD = 60 * 60 * 24 * 2 * 1000; // Refresh if less than 2 days left

export const handle: Handle = async ({ event, resolve }) => {
  const sessionCookie = event.cookies.get('__session');
  
  if (sessionCookie) {
    try {
      const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
      
      event.locals.userId = decodedClaims.uid;
      event.locals.user = {
        uid: decodedClaims.uid,
        email: decodedClaims.email || '',
        displayName: decodedClaims.name || null,
        photoURL: decodedClaims.picture || null
      };

      // FIX: Auto-refresh session if less than 2 days remaining.
      // This prevents session expiry during long operations like video encoding.
      const expiresAt = decodedClaims.exp * 1000; // exp is in seconds
      const timeLeft = expiresAt - Date.now();

      if (timeLeft < REFRESH_THRESHOLD) {
        try {
          // Mint a fresh session cookie using the existing verified uid
          const newSessionCookie = await adminAuth.createSessionCookie(sessionCookie, {
            expiresIn: SESSION_14_DAYS
          });

          event.cookies.set('__session', newSessionCookie, {
            maxAge: SESSION_14_DAYS,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax'
          });

          console.log(`🔄 Session auto-refreshed for user ${decodedClaims.uid}`);
        } catch (refreshError) {
          // Non-fatal — user is still authenticated for this request
          console.warn('Session refresh failed (non-fatal):', refreshError);
        }
      }

    } catch (error) {
      console.error('Session verification failed:', error);
      // Clear the expired cookie so client knows to re-authenticate
      event.cookies.delete('__session', { path: '/' });
      event.locals.userId = null;
      event.locals.user = null;
    }
  } else {
    event.locals.userId = null;
    event.locals.user = null;
  }
  
  return resolve(event);
};