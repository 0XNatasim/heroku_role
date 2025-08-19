import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const {
  PORT = 5000,
  DISCORD_TOKEN,
  GUILD_ID,
  MEMBER_ROLE_ID,
  ALCHEMY_KEY,
  NAMEWRAPPER_CONTRACT,
  PARENT_NODE
} = process.env;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Super tiny nonce store (in-memory)
const nonces = new Map();
const newNonce = () => [...crypto.getRandomValues(new Uint8Array(16))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

// --- Helpers ---
function endsWithParent(name) {
  return typeof name === 'string' && name.toLowerCase().endsWith('.emperor.club.agi.eth');
}

function getNftName(nft) {
  // Try multiple places; Alchemy can vary
  return (
    nft?.rawMetadata?.name ||
    nft?.title ||
    nft?.name ||
    nft?.contractMetadata?.name ||
    null
  );
}

async function checkOwnership(address) {
  // Fetch only NameWrapper holdings for this owner
  const url = new URL(`https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`);
  url.searchParams.set('owner', address);
  url.searchParams.append('contractAddresses[]', NAMEWRAPPER_CONTRACT);
  url.searchParams.set('withMetadata', 'true');
  url.searchParams.set('pageSize', '100');

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alchemy error: ${res.status} ${text}`);
  }
  const data = await res.json();
  const list = Array.isArray(data?.ownedNfts) ? data.ownedNfts : (Array.isArray(data?.nfts) ? data.nfts : []);

  // Simple rule: name ends with '.emperor.club.agi.eth'
  const matches = list.filter((nft) => endsWithParent(getNftName(nft)));
  return { count: matches.length, sample: matches.slice(0, 5).map(getNftName) };
}

async function addRoleToUser(guildId, userId, roleId) {
  const endpoint = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;
  const r = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Discord role add failed: ${r.status} ${txt}`);
  }
}

// --- Routes ---

// Issue nonce
app.get('/nonce', (req, res) => {
  const nonce = newNonce();
  nonces.set(nonce, Date.now());
  res.json({ nonce });
});

// Verify signature + ownership → assign role
app.post('/verify', async (req, res) => {
  try {
    const { message, signature, uid, guild } = req.body;
    if (!message || !signature || !uid || !guild) {
      return res.status(400).json({ ok: false, error: 'Missing fields' });
    }

    // Basic nonce check
    const nonceMatch = /Nonce:\s*([a-f0-9]{32})/i.exec(message);
    if (!nonceMatch) return res.status(400).json({ ok: false, error: 'Nonce missing' });
    const nonce = nonceMatch[1];
    const issuedAt = nonces.get(nonce);
    if (!issuedAt) return res.status(400).json({ ok: false, error: 'Invalid nonce' });
    if (Date.now() - issuedAt > 5 * 60 * 1000) { // 5 minutes
      nonces.delete(nonce);
      return res.status(400).json({ ok: false, error: 'Nonce expired' });
    }
    nonces.delete(nonce);

    // Recover address
    const recovered = ethers.verifyMessage(message, signature);
    const address = ethers.getAddress(recovered);

    // Check ownership of a wrapped subname under emperor.club.agi.eth
    const { count, sample } = await checkOwnership(address);

    if (count > 0) {
      await addRoleToUser(guild, uid, MEMBER_ROLE_ID);
      return res.json({ ok: true, address, matched: count, sample, note: 'Role granted' });
    } else {
      return res.json({ ok: false, address, matched: 0, sample, error: 'No matching ENS subdomain found' });
    }
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// Fallback to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`ℹ️  Expecting GUILD_ID=${GUILD_ID}  ROLE=${process.env.MEMBER_ROLE_ID}`);
  console.log(`ℹ️  Using NameWrapper=${NAMEWRAPPER_CONTRACT}  ParentNode=${PARENT_NODE}`);
});
