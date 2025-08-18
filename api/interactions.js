// api/interactions.js
// ESM. Requires: "type": "module" in package.json
import nacl from "tweetnacl";

// Discord constants
const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 };
const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4
};

// Verify the request signature (required by Discord)
function verifyDiscordRequest(req, publicKey) {
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];
  if (!signature || !timestamp) return false;

  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const message = new TextEncoder().encode(timestamp + body);
  const sig = Buffer.from(signature, "hex");
  const key = Buffer.from(publicKey, "hex");

  return nacl.sign.detached.verify(message, sig, key);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    // Vercel parses JSON; for signature verification we need raw string too.
    // If you see false negatives, switch to a custom body parser (edge runtime) or
    // use req.headers + req.rawBody. For most simple payloads this works.
    const verified = verifyDiscordRequest(
      { headers: req.headers, body: req.body },
      process.env.DISCORD_PUBLIC_KEY
    );
    if (!verified) return res.status(401).send("Bad request signature");

    const { type, data, member, user } = req.body;

    // Respond to Discord PING
    if (type === InteractionType.PING) {
      return res.json({ type: InteractionResponseType.PONG });
    }

    // Slash command handler
    if (type === InteractionType.APPLICATION_COMMAND) {
      const name = data?.name;

      if (name === "verify") {
        // Prefer user.id from interactions v10
        const discordId =
          member?.user?.id || user?.id || req.body?.user?.id || "unknown";

        const link = `https://${req.headers.host}/?discordId=${discordId}`;

        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // flags 64 = ephemeral (only user sees it)
            flags: 64,
            content: `Click to verify ENS ownership:\n${link}`
          }
        });
      }

      // Unknown command
      return res.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: 64, content: "Unknown command." }
      });
    }

    return res.status(400).send("Unhandled interaction type");
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
}
