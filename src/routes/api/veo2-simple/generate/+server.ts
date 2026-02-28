import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'fs';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { checkUsage, incrementUsage } from '$lib/services/usage.service';
export const POST: RequestHandler = async ({ request, locals }) => {
    // Check authentication
    const userId = locals.user?.uid;
    if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Check usage limits
    const usageCheck = await checkUsage(userId, 'video');
    if (!usageCheck.allowed) {
        return new Response(JSON.stringify({ error: 'limit_reached', usage: usageCheck }), { status: 429 });
    }

    const { prompt, duration = 5, aspectRatio = "16:9"} = await request.json();
    
    const key = JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    const auth = new GoogleAuth({ 
        credentials: key, 
        scopes: ['https://www.googleapis.com/auth/cloud-platform'] 
    });
    const token = (await (await auth.getClient()).getAccessToken()).token;

    const modelId = 'veo-2.0-generate-001';
    
    const res = await fetch(
        `https://us-central1-aiplatform.googleapis.com/v1/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/${modelId}:predictLongRunning`,
        {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [{
                    prompt: prompt
                }],
                parameters: {
                    durationSeconds: duration,
                    sampleCount: 1,
                    aspectRatio: aspectRatio ,
                    storageUri: "gs://project_app_bucket/videos/"  // Changed to include /videos/
                }
            })
        }
    );

    if (!res.ok) {
        console.error('Generate failed:', res.status, res.statusText);
        const text = await res.text();
        console.error('Error response:', text);
        return new Response(JSON.stringify({ 
            error: `Generation failed: ${res.status}`,
            details: text
        }), { 
            status: res.status,
            headers: { 'Content-Type': 'application/json' } 
        });
    }

    const data = await res.json();
    console.log('in data*********************');
    console.log(data);
    await incrementUsage(userId, 'video');
    return new Response(JSON.stringify({ 
        operation: data.name 
    }), { 
        headers: { 'Content-Type': 'application/json' } 
    });
};