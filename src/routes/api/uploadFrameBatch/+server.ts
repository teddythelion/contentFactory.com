import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const batchNumber = formData.get('batchNumber') as string;
    const startFrame = formData.get('startFrame') as string;
    const frameCount = parseInt(formData.get('frameCount') as string);
    const width = parseInt(formData.get('width') as string);
    const height = parseInt(formData.get('height') as string);
    const frameData = formData.get('frameData') as File;

    console.log(`📦 Batch ${batchNumber}: ${frameCount} frames starting at ${startFrame}`);
    
    // Create session directory
    const tempDir = path.join(process.cwd(), 'temp', `session-${sessionId}`);
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Read batch data
    const arrayBuffer = await frameData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const bytesPerFrame = width * height * 4;

    // Write individual frames
    for (let i = 0; i < frameCount; i++) {
      const globalFrameNumber = parseInt(startFrame) + i;
      const frameStart = i * bytesPerFrame;
      const frameEnd = frameStart + bytesPerFrame;
      const frameBuffer = uint8Array.slice(frameStart, frameEnd);
      
      const framePath = path.join(tempDir, `frame-${globalFrameNumber.toString().padStart(6, '0')}.raw`);
      await writeFile(framePath, Buffer.from(frameBuffer));
    }

    console.log(`✅ Batch ${batchNumber} saved`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Batch upload error:', error);
    return new Response(
      JSON.stringify({
        error: 'Batch upload failed',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};