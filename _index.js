require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { ethers } = require("ethers");

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  MEMBER_ROLE_ID,
  BASE_URL,
  PORT,
  ALCHEMY_KEY,
  ENS_WRAPPER_NFT_CONTRACT,
  PARENT_NODE
} = process.env;

// ----------------- DISCORD BOT -----------------
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const commands = [
  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verify ENS subdomain ownership under emperor.club.agi.eth")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Slash command /verify registered");
  } catch (err) {
    console.error("❌ Error registering commands:", err);
  }
})();

client.on("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "verify") {
    try {
      const verifyUrl = `${BASE_URL}/?discordId=${interaction.user.id}`;
      await interaction.reply({
        content: `Click to verify ENS subdomain ownership: ${verifyUrl}`,
        flags: 64 // 👈 ephemeral reply (only the user sees this)
      });
    } catch (err) {
      console.error("❌ Interaction error:", err);
    }
  }
});

client.login(DISCORD_TOKEN);

// ----------------- EXPRESS SERVER -----------------
const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`);
const ensWrapper = new ethers.Contract(
  ENS_WRAPPER_NFT_CONTRACT,
  ["function balanceOf(address owner, uint256 id) view returns (uint256)"],
  provider
);

app.post("/api/verify", async (req, res) => {
  try {
    const { discordId, wallet, subnodeHex, signature } = req.body;

    const recovered = ethers.verifyMessage(`Verify ENS subdomain for ${discordId}`, signature);
    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const balance = await ensWrapper.balanceOf(wallet, subnodeHex);
    if (balance > 0n) {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(discordId);
      await member.roles.add(MEMBER_ROLE_ID);

      return res.json({ success: true, message: "ENS ownership verified, role granted!" });
    } else {
      return res.status(403).json({ error: "No ENS subdomain NFT found." });
    }
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT || 5000, () => {
  console.log(`🌐 Server running at ${BASE_URL}`);
});
