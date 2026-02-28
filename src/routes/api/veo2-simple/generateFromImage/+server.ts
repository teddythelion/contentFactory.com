import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'fs';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { checkUsage, incrementUsage } from '$lib/services/usage.service';
//import { Storage } from '@google-cloud/storage';
//update 3
// --- Veo 3.1 API Structures ---

interface ReferenceImage {
    image: {
        bytesBase64Encoded: string;
        mimeType: string;
    };
    referenceType: 'asset';
}

interface VeoParameters {
    durationSeconds: number;
    storageUri: string;
    sampleCount: number;
     resolution: string;
}

interface VeoInstance {
    prompt: string;
    referenceImages?: ReferenceImage[];
}

function getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
    };
    return mimeTypeMap[ext || 'jpg'] || 'image/jpeg';
}

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

    const contentType = request.headers.get('content-type') || '';
    
    let prompt: string;
    let duration: number = 8;
    const referenceImages: ReferenceImage[] = [];
    const bucketName = env.GOOGLE_STORAGE_BUCKET || 'project_app_bucket';

    try {
        // --- 1. Parse Request Body ---
        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            prompt = formData.get('prompt') as string;
            duration = parseInt(formData.get('duration') as string) || 8;

            const images = formData.getAll('images') as File[];
            console.log("📦 Received images:", images.length);

            if (!images || images.length === 0) {
                console.warn("⚠️ No images provided");
            } else {
                // Convert images to base64
                for (const image of images) {
                    try {
                        const buffer = await image.arrayBuffer();
                        const base64 = Buffer.from(buffer).toString('base64');
                        const mimeType = getMimeType(image.name);

                        console.log(`📤 Processing: ${image.name} (${mimeType})`);

                        referenceImages.push({
                            image: {
                                bytesBase64Encoded: base64,
                                mimeType: mimeType
                            },
                            referenceType: 'asset'
                        });

                        console.log(`✅ Image converted to base64`);
                    } catch (imageError) {
                        console.error(`❌ Failed to process ${image.name}:`, imageError);
                        throw new Error(`Failed to process image ${image.name}`);
                    }
                }
            }
        } else {
            // Handle JSON (text-only prompts)
            const body = await request.json();
            prompt = body.prompt;
            duration = body.duration || 8;
        }

        if (!prompt) {
            return new Response(JSON.stringify({ 
                error: 'Prompt is required' 
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // --- 2. Authentication ---
        console.log("🔐 Authenticating with Google Cloud...");
        const key = JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
        const auth = new GoogleAuth({ 
            credentials: key, 
            scopes: ['https://www.googleapis.com/auth/cloud-platform'] 
        });
        const token = (await (await auth.getClient()).getAccessToken()).token;
        console.log("✅ Authentication successful");

        // --- 3. Build Veo 3.1 Payload (per documentation) ---
        const modelId = 'veo-3.1-generate-preview';

        console.log("🎬 Building Veo 3.1 payload...");
        console.log(`   - Prompt: ${prompt}`);
        console.log(`   - Duration: ${duration}s`);
        console.log(`   - Reference Images: ${referenceImages.length}`);

        const instance: VeoInstance = {
            prompt: prompt
        };

        // Only add reference images if we have them
        if (referenceImages.length > 0) {
            instance.referenceImages = referenceImages;
        }

        const instances: VeoInstance[] = [instance];

        const parameters: VeoParameters = {
            durationSeconds: duration,
            storageUri: `gs://${bucketName}/videos/`,
            sampleCount: 1,
            resolution: "1080p"
        };

        // --- 4. Call Vertex AI API ---
        console.log("🚀 Calling Veo 3.1 API...");
        const apiUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${env.GOOGLE_PROJECT_ID}/locations/us-central1/publishers/google/models/${modelId}:predictLongRunning`;
        
        const payload = {
            instances: instances,
            parameters: parameters
        };

        console.log("📨 Payload:", JSON.stringify(payload, null, 2));

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error('❌ Veo 3.1 API Error:', res.status, res.statusText);
            const errorText = await res.text();
            console.error('Error details:', errorText);
            return new Response(JSON.stringify({ 
                error: `Generation failed: ${res.status} - ${res.statusText}`,
                details: errorText
            }), { 
                status: res.status,
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const data = await res.json();
        console.log('✅ Operation created:', data.name);
        await incrementUsage(userId, 'video');
        return new Response(JSON.stringify({ 
            operation: data.name,
            imageCount: referenceImages.length
        }), { 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error('❌ Request processing error:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to process request',
            details: error instanceof Error ? error.message : String(error)
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};