import { json } from '@sveltejs/kit';
import { adminAuth } from '$lib/firebase/admin.ts';

export async function POST({ request, cookies }) {
  try {
    const { idToken } = await request.json();
    
    // FIX: Extended to 14 days to prevent session expiry during long operations
    const expiresIn = 60 * 60 * 24 * 14 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    
    cookies.set('__session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax'
    });
    
    return json({ success: true });
  } catch (error) {
    console.error('Session creation failed:', error);
    return json({ error: 'Failed to create session' }, { status: 401 });
  }
}