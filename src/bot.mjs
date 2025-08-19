import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, InteractionContextType } from 'discord.js';

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  BASE_URL
} = process.env;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('verify')
      .setDescription('Verify you own an ENS subdomain under emperor.club.agi.eth to get the role')
      .setContexts(InteractionContextType.Guild)
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  // Guild-scoped for fast updates
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('✅ Slash commands registered (guild)');
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  if (process.argv.includes('--register')) {
    await registerCommands();
    process.exit(0);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'verify') return;

    const url = `${BASE_URL}/?uid=${encodeURIComponent(interaction.user.id)}&guild=${encodeURIComponent(interaction.guildId)}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Connect MetaMask to Verify')
        .setStyle(ButtonStyle.Link)
        .setURL(url)
    );

    await interaction.reply({
      content: 'Click the button to verify with MetaMask. This message is only visible to you.',
      components: [row],
      // Ephemeral via flags (no deprecation warning)
      flags: 64
    });
  } catch (err) {
    console.error('Interaction error:', err);
    // Best-effort error notice
    if (interaction.isRepliable()) {
      await interaction.reply({ content: 'Something went wrong. Try again in a moment.', flags: 64 });
    }
  }
});

client.login(DISCORD_TOKEN);
