// api/interactions.mjs
import nacl from "tweetnacl";

export const config = { runtime: 'edge' };

const { DISCORD_PUBLIC_KEY, BASE_URL } = process.env;

// Helpers
async function readBody(req) { return await req.text(); }
function json(data, init={}) { return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...init.headers } }); }
function unauthorized() { return new Response('Bad signature', { status: 401 }); }

// Discord interaction types
const PING = 1;
const APPLICATION_COMMAND = 2;

// Response types
const PONG = 1;
const CHANNEL_MESSAGE_WITH_SOURCE = 4;
const DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5;

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Verify signature
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const rawBody = await readBody(req);
  const isValid = nacl.sign.detached.verify(
    new TextEncoder().encode(timestamp + rawBody),
    hexToUint8Array(signature),
    hexToUint8Array(DISCORD_PUBLIC_KEY)
  );
  if (!isValid) return unauthorized();

  const body = JSON.parse(rawBody);

  if (body.type === PING) {
    return json({ type: PONG });
  }

  if (body.type === APPLICATION_COMMAND) {
    // Slash command: /verify
    if (body.data?.name === 'verify') {
      const userId = body.member?.user?.id || body.user?.id;
      const guildId = body.guild_id;
      const url = `${BASE_URL}/?uid=${encodeURIComponent(userId)}&guild=${encodeURIComponent(guildId)}`;

      // Reply with link button (ephemeral)
      return json({
        type: CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 64, // ephemeral
          content: 'Click to verify with MetaMask:',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5, // link
                  label: 'Connect MetaMask to Verify',
                  url
                }
              ]
            }
          ]
        }
      });
    }
  }

  return json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: 'Unknown command' }});
}

function hexToUint8Array(hex) {
  if (!hex) return new Uint8Array();
  if (hex.startsWith('0x')) hex = hex.slice(2);
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i/2] = parseInt(hex.slice(i, i+2), 16);
  return arr;
}
