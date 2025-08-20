import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';

const { DISCORD_TOKEN, BASE_URL } = process.env;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'verify') return;

  const query = `?uid=${encodeURIComponent(interaction.user.id)}&guild=${encodeURIComponent(interaction.guildId)}`;
  const webUrl = `${BASE_URL}/${query}`;
  // MetaMask deep link for mobile: open the same page in MetaMask in-app browser
  const dappNoProto = webUrl.replace(/^https?:\/\//, '');
  const metamaskDeepLink = `https://metamask.app.link/dapp/${dappNoProto}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Verify (Desktop/Web)')
      .setStyle(ButtonStyle.Link)
      .setURL(webUrl),
    new ButtonBuilder()
      .setLabel('Verify in MetaMask (Mobile)')
      .setStyle(ButtonStyle.Link)
      .setURL(metamaskDeepLink)
  );

  await interaction.reply({
    content: 'Use the button that fits your device:',
    components: [row],
    flags: 64 // ephemeral
  });
});

client.login(DISCORD_TOKEN);
