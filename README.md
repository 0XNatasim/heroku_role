# Discord ENS Subdomain Verifier (Free hosting on Vercel)

Static site + serverless function to verify ownership of an ENS subdomain (under `emperor.club.agi.eth`) and assign a Discord role.

## How it works
1. User opens `/` with `?discordId=<their Discord user id>`.
2. Frontend connects MetaMask, computes `tokenId = namehash(full ENS)`, asks user to sign `Verify ENS subdomain for <discordId>`.
3. Serverless API `/api/verify`:
   - Verifies signature with `ethers.verifyMessage`.
   - Calls NameWrapper `balanceOf(wallet, tokenId)` on mainnet via Alchemy RPC.
   - Calls Discord REST `PUT /guilds/{guild}/members/{user}/roles/{role}` to grant role.

## Deploy on Vercel
1. Push this repo to GitHub, import into Vercel (Hobby/free).
2. Add **Environment Variables** in the Vercel Project → Settings:
   - `DISCORD_TOKEN` = your bot token
   - `GUILD_ID` = your Discord server ID
   - `MEMBER_ROLE_ID` = the role to grant
   - `ALCHEMY_KEY` = your Alchemy mainnet key
   - `ENS_WRAPPER_NFT_CONTRACT` = ENS NameWrapper (e.g. `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`)
3. Deploy. Your site will be live at `https://<app>.vercel.app/`.

## Requirements
- The bot must already be in your guild and have **Manage Roles**.
- The bot’s role must be **above** the `MEMBER_ROLE_ID` in the role hierarchy.
- Users need their **Discord ID** (enable Developer Mode → right-click user → Copy ID).

## Local dev (optional)
This project is static + serverless; use `vercel dev` if you want to test locally.
