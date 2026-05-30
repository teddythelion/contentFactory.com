// src/lib/server/jobStore.ts
// Shared in-memory job store — imported by both encodeFromBatches and encodeStatus

export const encodeJobs = new Map<string, {
  status: 'processing' | 'complete' | 'error';
  gcsUrl?: string;
  error?: string;
  createdAt: number;
}>();

export function pruneOldJobs() {
  const oneHour = 60 * 60 * 1000;
  const now = Date.now();
  for (const [id, job] of encodeJobs.entries()) {
    if (now - job.createdAt > oneHour) encodeJobs.delete(id);
  }
}