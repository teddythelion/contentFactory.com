import type { RequestHandler } from './$types';
import { encodeJobs } from '$lib/server/jobStore';

export const GET: RequestHandler = async ({ url }) => {
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    return new Response(JSON.stringify({ error: 'Missing jobId' }), { status: 400 });
  }

  const job = encodeJobs.get(jobId);

  if (!job) {
    return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 });
  }

  return new Response(JSON.stringify(job), {
    headers: { 'Content-Type': 'application/json' }
  });
};