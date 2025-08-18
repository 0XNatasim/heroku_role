// api/verify.js
import { ethers } from "ethers";

// Vercel serverless function entrypoint
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { discordId, wallet, tokenId, signature, ensName } = req.body || {};

    // Basic validation
    if (!discordId || !wallet || !tokenId || !signature) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (ensName && !ensName.endsWith(".emperor.club.agi.eth")) {
      return res.status(400).json({ error: "ENS must be under emperor.club.agi.eth" });
    }

    // 1) Verify signature
    const message = `Verify ENS subdomain for ${discordId}`;
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    // 2) On-chain check: ENS NameWrapper ERC-1155 balanceOf(owner, tokenId)
    const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`;
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const nameWrapper = new ethers.Contract(
      process.env.ENS_WRAPPER_NFT_CONTRACT, // e.g. 0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401
      ["function balanceOf(address owner, uint256 id) view returns (uint256)"],
      provider
    );

    const bal = await nameWrapper.balanceOf(wallet, tokenId);
    if (bal === 0n) {
      return res.status(403).json({ error: "No matching ENS NameWrapper token found" });
    }

    // 3) Assign Discord role via REST API
    // Bot must already be in the guild and have Manage Roles permission
    const guildId = process.env.GUILD_ID;
    const roleId = process.env.MEMBER_ROLE_ID;
    const token = process.env.DISCORD_TOKEN;

    const resp = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bot ${token}`,
        "Content-Type": "application/json"
      }
      // no body for this PUT
    });

    if (resp.status === 204) {
      return res.json({ success: true, message: "ENS ownership verified, role granted!" });
    }

    const errTxt = await resp.text();
    return res.status(500).json({ error: `Discord role API failed: ${resp.status} ${errTxt}` });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
