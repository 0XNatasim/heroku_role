# Discord ENS Wrapped Subname Verification

Gives a Discord role **only if** a user owns an **ERC-1155 wrapped ENS subname** under a specific parent (e.g. `.emperor.club.agi.eth`).

## Architecture

- **Web Service (server.mjs)**: Serves `/verify` page, issues nonce, verifies signature, checks Alchemy for NameWrapper holdings, calls Discord REST to assign role.
- **Worker (bot.mjs)**: Discord bot that exposes `/verify` and replies with the link to the web page.

## Requirements

- Node.js v20+
- Discord bot with `Manage Roles` permission
- Set the bot's role **above** the target `MEMBER_ROLE_ID` in the guild hierarchy
- Alchemy API key (Mainnet)

## Env Vars

Copy `.env.example` to `.env` (do **not** commit `.env`):

