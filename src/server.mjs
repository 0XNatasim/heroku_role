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
  MEMBER_ROLE_ID,
  ALCHEMY_KEY,
  NAMEWRAPPER_CONTRACT,
  PARENT_SUFFIX = '.emperor.club.agi.eth'
} = process.env;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// serve /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// simple in-memory nonce store (5 min TTL)
const nonces = new Map();
const newNonce = () => [...crypto.getRandomValues(new Uint8Array(16))]
  .map(b => b.toString(16).padStart(2, '0')).join('');

// helpers
const endsWithParent = (name) =>
  typeof name === 'string' && name.toLowerCase().endsWith(PARENT_SUFFIX.toLowerCase());

const getNftName = (nft) =>
  nft?.rawMetadata?.name ||
  nft?.title ||
  nft?.name ||
  nft?.contractMetadata?.name ||
  null;

async function getWrapperNftsForOwner(address) {
  const base = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`;
  let pageKey, out = [];
  while (true) {
    const url = new URL(base);
    url.searchParams.set('owner', address);
    url.searchParams.append('contractAddresses[]', NAMEWRAPPER_CONTRACT);
    url.searchParams.set('withMetadata', 'true');
    url.searchParams.set('pageSize', '100');
    if (pageKey) url.searchParams.set('pageKey', pageKey);

    const r = await fetch(url.toString());
    if (!r.ok) throw new Error(`Alchemy error ${r.status}`);
    const j = await r.json();
    const list = Array.isArray(j?.ownedNfts) ? j.ownedNfts : (Array.isArray(j?.nfts) ? j.nfts : []);
    out = out.concat(list);
    if (j.pageKey) pageKey = j.pageKey; else break;
  }
  return out;
}

async function addRoleToUser(guildId, userId, roleId) {
  const endpoint = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;
  const r = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Authorization': `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json' }
  });
  if (!r.ok) throw new Error(`Role add failed: ${r.status} ${await r.text()}`);
}

// routes
app.get('/nonce', (req, res) => {
  const nonce = newNonce();
  nonces.set(nonce, Date.now());
  res.json({ nonce });
});

app.post('/verify', async (req, res) => {
  try {
    const { message, signature, uid, guild } = req.body || {};
    if (!message || !signature || !uid || !guild) {
      return res.status(400).json({ ok: false, error: 'Missing fields' });
    }

    // check nonce
    const m = /Nonce:\s*([a-f0-9]{32})/i.exec(message);
    if (!m) return res.status(400).json({ ok: false, error: 'Nonce missing' });
    const nonce = m[1];
    const issuedAt = nonces.get(nonce);
    if (!issuedAt || Date.now() - issuedAt > 5 * 60 * 1000) {
      nonces.delete(nonce);
      return res.status(400).json({ ok: false, error: 'Nonce invalid/expired' });
    }
    nonces.delete(nonce);

    // recover wallet from signature
    const address = ethers.getAddress(ethers.verifyMessage(message, signature));

    // check NameWrapper holdings
    const nfts = await getWrapperNftsForOwner(address);
    const matches = nfts.filter(n => endsWithParent(getNftName(n)));

    if (matches.length === 0) {
      return res.json({ ok: false, address, matched: 0, sample: nfts.slice(0, 5).map(getNftName).filter(Boolean) });
    }

    // grant role
    await addRoleToUser(guild, uid, MEMBER_ROLE_ID);

    // return ALL matching names so the UI can list them comma-separated
    const allNames = matches.map(getNftName).filter(Boolean);
    res.json({ ok: true, address, matched: matches.length, sample: allNames });
  } catch (e) {
    console.error('verify error:', e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// SPA fallback
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
);

app.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
});
