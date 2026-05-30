import { createVertex } from '@ai-sdk/google-vertex';
import { streamText, convertToModelMessages } from 'ai';
import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'fs';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import type { UIMessage } from 'ai';
 
export const POST: RequestHandler = async ({ request }) => {
    const { messages }: { messages: UIMessage[] } = await request.json();

    // Load service account credentials
    const key = JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    const auth = new GoogleAuth({ 
        credentials: key, 
        scopes: ['https://www.googleapis.com/auth/cloud-platform'] 
    });
    const token = (await (await auth.getClient()).getAccessToken()).token;
    console.log(token);
    // Create Vertex with proper authentication
    const vertex = createVertex({
        project: env.GOOGLE_PROJECT_ID,
        location: env.GOOGLE_LOCATION || 'us-central1',
        googleAuthOptions: {
            credentials: key,
        },
    });

    const result = streamText({
        model: vertex('gemini-2.0-flash-lite-001'),
        messages: convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
};