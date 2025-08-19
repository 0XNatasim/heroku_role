// api/nonce.mjs
export const config = { runtime: 'edge' };

function newNonce() {
  const a = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler() {
  const nonce = newNonce();
  // Edge functions don't have durable memory; put nonce in response and echo back.
  // (We’ll validate shape + freshness client-side; for high security, use Vercel KV/Upstash.)
  return new Response(JSON.stringify({ nonce }), { status: 200, headers: { 'Content-Type': 'application/json' }});
}
