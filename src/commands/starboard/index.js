const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { handleCreate } = require('./handlers/create');
const { handleEdit } = require('./handlers/edit');
const { handleRemove } = require('./handlers/remove');
const { handleList } = require('./handlers/list');
const starboardManager = require('../../features/starboard/starboardManager');

const STARBOARD_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
];

const CONTENT_TYPE_CHOICES = Object.entries(starboardManager.CONTENT_TYPES).map(([value, name]) => ({ name, value }));
const VOTING_METHOD_CHOICES = Object.entries(starboardManager.VOTING_METHODS).map(([value, name]) => ({ name, value }));

const data = new SlashCommandBuilder()
  .setName('starboard')
  .setDescription('Reposts messages that get enough reactions to a dedicated channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('[Admin] Set up a new starboard')
      .addStringOption((opt) => opt.setName('name').setDescription('A short name for this starboard (e.g. "main")').setRequired(true))
      .addChannelOption((opt) =>
        opt
          .setName('watch_channel')
          .setDescription('Channel to watch for reactions')
          .addChannelTypes(...STARBOARD_CHANNEL_TYPES)
          .setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName('post_channel')
          .setDescription('Channel where starred messages get reposted')
          .addChannelTypes(...STARBOARD_CHANNEL_TYPES)
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('threshold')
          .setDescription('Minimum number of (distinct users) reactions needed')
          .setMinValue(1)
          .setMaxValue(1000)
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('emojis')
          .setDescription('Emoji(s) to count, separated by spaces/commas (e.g. "⭐" or "⭐ 🔥")')
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('content_type')
          .setDescription('Restrict to a kind of message (default: any)')
          .addChoices(...CONTENT_TYPE_CHOICES)
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('voting_method')
          .setDescription('Reactions (default) or a bot-posted vote button on every message')
          .addChoices(...VOTING_METHOD_CHOICES)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('[Admin] Edit an existing starboard')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Which starboard to edit').setRequired(true).setAutocomplete(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName('watch_channel')
          .setDescription('New channel to watch for reactions')
          .addChannelTypes(...STARBOARD_CHANNEL_TYPES)
          .setRequired(false)
      )
      .addChannelOption((opt) =>
        opt
          .setName('post_channel')
          .setDescription('New channel where starred messages get reposted')
          .addChannelTypes(...STARBOARD_CHANNEL_TYPES)
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt.setName('threshold').setDescription('New minimum reaction count').setMinValue(1).setMaxValue(1000).setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('emojis')
          .setDescription('New emoji list, replaces the old one entirely (space/comma separated)')
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('content_type')
          .setDescription('New message-type restriction')
          .addChoices(...CONTENT_TYPE_CHOICES)
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('voting_method')
          .setDescription('New voting method (reactions or a bot-posted vote button)')
          .addChoices(...VOTING_METHOD_CHOICES)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('[Admin] Delete a starboard')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Which starboard to remove').setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Lists every starboard configured in this server'));

async function execute(interaction) {
  if (!(await starboardManager.isEnabled(interaction.guildId))) {
    await interaction.reply({
      content: '⚠️ The Starboard feature is currently disabled in this server. An admin can re-enable it with `/disablefeature`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (interaction.options.getSubcommand()) {
    case 'create':
      return handleCreate(interaction);
    case 'edit':
      return handleEdit(interaction);
    case 'remove':
      return handleRemove(interaction);
    case 'list':
      return handleList(interaction);
    default:
      return interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
  }
}

// Powers the "name" option's autocomplete on /starboard edit and /starboard remove.
async function autocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'name') {
    await interaction.respond([]);
    return;
  }

  const names = await starboardManager.getNamesList(interaction.guildId);
  const query = focused.value.toLowerCase();

  const filtered = names.filter((n) => n.toLowerCase().includes(query)).slice(0, 25);

  await interaction.respond(filtered.map((n) => ({ name: n, value: n })));
}

module.exports = { data, execute, autocomplete };
