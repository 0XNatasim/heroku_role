// api/verify.mjs
import { verifyMessage, getAddress } from 'ethers';
import { fetch } from 'undici';

export const config = { runtime: 'edge' };

const {
  DISCORD_TOKEN,
  MEMBER_ROLE_ID,
  ALCHEMY_KEY,
  NAMEWRAPPER_CONTRACT
} = process.env;

function endsWithParent(name) {
  return typeof name === 'string' && name.toLowerCase().endsWith('.emperor.club.agi.eth');
}

function getNftName(nft) {
  return nft?.rawMetadata?.name || nft?.title || nft?.name || nft?.contractMetadata?.name || null;
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { message, signature, uid, guild } = await req.json().catch(() => ({}));
  if (!message || !signature || !uid || !guild) {
    return json({ ok: false, error: 'Missing fields' }, 400);
  }

  let address;
  try {
    const recovered = verifyMessage(message, signature);
    address = getAddress(recovered);
  } catch (e) {
    return json({ ok: false, error: 'Invalid signature' }, 400);
  }

  // Alchemy: get NFTs for owner on NameWrapper
  const url = new URL(`https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`);
  url.searchParams.set('owner', address);
  url.searchParams.append('contractAddresses[]', NAMEWRAPPER_CONTRACT);
  url.searchParams.set('withMetadata', 'true');
  url.searchParams.set('pageSize', '100');

  const r = await fetch(url.toString());
  if (!r.ok) return json({ ok: false, error: `Alchemy ${r.status}` }, 500);
  const data = await r.json();
  const list = Array.isArray(data?.ownedNfts) ? data.ownedNfts : (Array.isArray(data?.nfts) ? data.nfts : []);
  const matches = list.filter(nft => endsWithParent(getNftName(nft)));

  if (matches.length === 0) {
    return json({ ok: false, address, matched: 0, sample: list.slice(0,5).map(getNftName) });
  }

  // Add role via REST
  const endpoint = `https://discord.com/api/v10/guilds/${guild}/members/${uid}/roles/${MEMBER_ROLE_ID}`;
  const put = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!put.ok) {
    const txt = await put.text();
    return json({ ok: false, address, matched: matches.length, error: `Role add failed: ${put.status} ${txt}` }, 500);
  }

  return json({ ok: true, address, matched: matches.length, sample: matches.slice(0,5).map(getNftName) });
}

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' }});
}
