import { setTimeout } from 'node:timers/promises';
const url = process.argv[2] || 'http://127.0.0.1:3000/api/health';
for (let attempt = 0; attempt < 60; attempt++) {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (response.ok) process.exit(0); } catch { /* service starting */ }
  await setTimeout(1000);
}
throw new Error(`Service did not become ready: ${url}`);
