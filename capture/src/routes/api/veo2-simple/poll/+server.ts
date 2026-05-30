import { GoogleAuth } from 'google-auth-library';
import { Storage } from '@google-cloud/storage';
import { readFileSync } from 'fs';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
//updated
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { operation } = await request.json();

        if (!operation) {
            return new Response(JSON.stringify({ 
                done: false, 
                error: 'Operation name is required' 
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // --- Authentication ---
        console.log('🔐 Authenticating...');
        const key = JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
        const auth = new GoogleAuth({ 
            credentials: key, 
            scopes: ['https://www.googleapis.com/auth/cloud-platform'] 
        });
        const token = (await (await auth.getClient()).getAccessToken()).token;

        // --- Poll Veo 3.1 Operation ---
        const modelId = 'veo-3.1-generate-preview';
        console.log(`📋 Polling operation: ${operation}`);

        const res = await fetch(
            `https://us-central1-aiplatform.googleapis.com/v1/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/${modelId}:fetchPredictOperation`,
            {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    operationName: operation
                })
            }
        );

        if (!res.ok) {
            console.error('❌ Polling failed:', res.status, res.statusText);
            const text = await res.text();
            console.error('Error response:', text);
            return new Response(JSON.stringify({ 
                done: false, 
                error: `Polling failed: ${res.status}` 
            }), { 
                status: 200,
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const data = await res.json();
        console.log('📊 Poll Response:', JSON.stringify(data, null, 2));

        // Check if operation is complete
        if (!data.done) {
            console.log('⏳ Operation still processing...');
            return new Response(JSON.stringify({ 
                done: false 
            }), { 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Operation is done - check for video
        console.log('✅ Operation complete');
        const gcsUri = data.response?.videos?.[0]?.gcsUri;

        if (!gcsUri) {
            console.error('❌ No GCS URI found in response');
            return new Response(JSON.stringify({ 
                done: true, 
                error: 'No video generated' 
            }), { 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        console.log(`📹 Video URI: ${gcsUri}`);

        // Parse GCS URI: gs://bucket-name/path/to/file.mp4
        const match = gcsUri.match(/gs:\/\/([^/]+)\/(.+)/);
        if (!match) {
            console.error('❌ Invalid GCS URI format:', gcsUri);
            return new Response(JSON.stringify({ 
                done: true, 
                error: 'Invalid video URI format',
                uri: gcsUri
            }), { 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const bucketName = match[1];
        const filePath = match[2];

        console.log(`🪣 Bucket: ${bucketName}, Path: ${filePath}`);

        // Generate signed URL (valid for 1 hour)
        try {
            const storage = new Storage({ credentials: key });
            const bucket = storage.bucket(bucketName);
            const file = bucket.file(filePath);

            const [signedUrl] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 3600000, // 1 hour
            });

            console.log('🔗 Signed URL generated successfully');

            return new Response(JSON.stringify({ 
                done: true, 
                video: signedUrl 
            }), { 
                headers: { 'Content-Type': 'application/json' } 
            });
        } catch (urlError) {
            console.error('❌ Failed to generate signed URL:', urlError);
            return new Response(JSON.stringify({ 
                done: true, 
                error: 'Failed to generate signed URL',
                details: urlError instanceof Error ? urlError.message : String(urlError)
            }), { 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

    } catch (error) {
        console.error('❌ Request processing error:', error);
        return new Response(JSON.stringify({ 
            done: true,
            error: 'Polling failed',
            details: error instanceof Error ? error.message : String(error)
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};