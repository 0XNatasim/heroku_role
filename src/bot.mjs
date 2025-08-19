import 'dotenv/config';
import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } from 'discord.js';

const { DISCORD_TOKEN, BASE_URL } = process.env;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'verify') return;

  const url = `${process.env.BASE_URL}/?uid=${encodeURIComponent(interaction.user.id)}&guild=${encodeURIComponent(interaction.guildId)}`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Connect MetaMask to Verify').setStyle(ButtonStyle.Link).setURL(url)
  );

  await interaction.reply({
    content: 'You are in the Club ? Prove it !',
    components: [row],
    flags: 64 // ephemeral
  });
});

client.login(DISCORD_TOKEN);
