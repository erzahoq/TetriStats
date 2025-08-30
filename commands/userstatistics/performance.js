const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
import('node-fetch'); // Ensure 'node-fetch' is imported properly

// Import helper functions for formatting and data processing
const { formatNumber, escapeUnderscores, getEmojiOfRank, getLeagueRankColour } = require('../../helpers/functions');
const { getUser } = require('../../helpers/getuser');
const { getEmoji } = require('../../helpers/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('performance')
    .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
    .setDescription('Get information about the performance of a user via their TETR.IO (or Discord) username/ID.')
    .addStringOption((option) =>
      option
        .setName('user')
        .setDescription('the TETR.IO username / Discord to search for')
        .setRequired(true),
    ),

  async execute(interaction) {
    // Fetch user data from TETR.IO API using provided username/ID
    const user = await getUser(interaction.options.getString('user').toLowerCase());

    // Handle user not found or server error cases
    if (user === 'no such user') {
      return await interaction.reply({
        content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
        flags: MessageFlags.Ephemeral,
      });
    } else if (user === 'server error') {
      return await interaction.reply({
        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Fetch league data
    let response = await fetch(`https://ch.tetr.io/api/users/${user._id}/summaries`);
    let userStats = await response.json();
    userStats = userStats.data;

    delete userStats.zen;
    delete userStats.achievements;
    // maybe also expert qp but idk
    // delete userStats.zenithex;

    let zenithData = userStats.zenith;
    let leagueData = userStats.league;
    let linesData = userStats['40l'];
    let blitzData = userStats.blitz;

    // Fetch labs league data
    response = await fetch(`https://ch.tetr.io/api/labs/league_ranks`);
    let labsLeagueData = await response.json();
    let rankData = labsLeagueData.data.data;
    // kills u
    delete rankData.total;

    const leagueObj = league(leagueData, rankData);

    // Tetra League embed
    let leagueEmbed;
    if (leagueObj === null) {
      leagueEmbed = new EmbedBuilder()
        .setColor('#ff8c57')
        .setDescription(`### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Performance -> Tetra League__\n### Hasn't played any Tetra League games yet!`)
        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
        .setURL(`https://tetr.io/u/${user.username}`)
        .setTimestamp();
    } else {
      leagueEmbed = new EmbedBuilder()
        .setColor(getLeagueRankColour(leagueData.rank) || '#ff8c57')
        .setDescription(`### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Performance -> Tetra League__\n` + (leagueData.tr < 0 ? `## Unranked ${getEmojiOfRank('z')}` : `## Ranked ${getEmojiOfRank(leagueData.rank)}`))
        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
        .setURL(`https://tetr.io/u/${user.username}`)
        .addFields(
          { name: 'APM', value: `${formatNumber(leagueObj.apm)} APM (${getEmojiOfRank(leagueObj.apmRank)})`, inline: true },
          { name: 'PPS', value: `${formatNumber(leagueObj.pps)} PPS (${getEmojiOfRank(leagueObj.ppsRank)})`, inline: true },
          { name: 'VS Score', value: `${formatNumber(leagueObj.vsScore)} (${getEmojiOfRank(leagueObj.vsScoreRank)})`, inline: true },
        )
        .setTimestamp();
    }

    // 40 Lines embed
    let linesEmbed;
    if (!linesData || !linesData.record) {
      linesEmbed = new EmbedBuilder()
        .setColor('#ffd94f')
        .setDescription(`### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Performance -> 40 Lines__\n### Hasn't played any 40 Lines games yet!`)
        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
        .setURL(`https://tetr.io/u/${user.username}`)
        .setTimestamp();
    } else {
      const linesObj = linesData.record.results.aggregatestats;
      linesEmbed = new EmbedBuilder()
        .setColor('#ffd94f')
        .setDescription(`### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Performance -> 40 Lines__\n`)
        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
        .setURL(`https://tetr.io/u/${user.username}`)
        .addFields(
          { name: 'PPS', value: `${formatNumber(linesObj.pps.toFixed(2))} PPS (${getEmojiOfRank(getRank(linesObj.pps, rankData, "pps"))})`, inline: true },
        )
        .setTimestamp();
    }

    // Blitz embed
    let blitzEmbed;
    if (!blitzData || !blitzData.record) {
      blitzEmbed = new EmbedBuilder()
        .setColor('#ff5410')
        .setDescription(`### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Performance -> Blitz__\n### Hasn't played any Blitz games yet!`)
        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
        .setURL(`https://tetr.io/u/${user.username}`)
        .setTimestamp();
    } else {
      const blitzObj = blitzData.record.results.aggregatestats;
      blitzEmbed = new EmbedBuilder()
        .setColor('#ff5410')
        .setDescription(`### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Performance -> Blitz__\n`)
        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
        .setURL(`https://tetr.io/u/${user.username}`)
        .addFields(
          { name: 'PPS', value: `${formatNumber(blitzObj.pps.toFixed(2))} PPS (${getEmojiOfRank(getRank(blitzObj.pps, rankData, "pps"))})`, inline: true },
        )
        .setTimestamp();
    }

    // Quick Play embed
    let quickplayEmbed;
    if (!zenithData || !zenithData.record) {
      quickplayEmbed = new EmbedBuilder()
        .setColor('#ff7024')
        .setDescription(`### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Performance -> Quick Play__\n### Hasn't played any Quick Play games yet!`)
        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
        .setURL(`https://tetr.io/u/${user.username}`)
        .setTimestamp();
    } else {
      const zenithObj = zenithData.record.results.aggregatestats;
      quickplayEmbed = new EmbedBuilder()
        .setColor('#ff7024')
        .setDescription(`### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Performance -> Quick Play__\n`)
        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
        .setURL(`https://tetr.io/u/${user.username}`)
        .addFields(
          { name: 'APM', value: `${formatNumber(zenithObj.apm.toFixed(2))} APM (${getEmojiOfRank(getRank(zenithObj.apm, rankData, "apm"))})`, inline: true },
          { name: 'PPS', value: `${formatNumber(zenithObj.pps.toFixed(2))} PPS (${getEmojiOfRank(getRank(zenithObj.pps, rankData, "pps"))})`, inline: true },
          { name: 'VS Score', value: `${formatNumber(zenithObj.vsscore.toFixed(2))} (${getEmojiOfRank(getRank(zenithObj.vsscore, rankData, "vs"))})`, inline: true },
        )
        .setTimestamp();
    }

    // Button labels and embeds in the correct order
    const buttonLabels = ['Tetra League', '40 Lines', 'Blitz', 'Quick Play'];
    const embeds = [leagueEmbed, linesEmbed, blitzEmbed, quickplayEmbed];

    // Create navigation buttons
    const row = new ActionRowBuilder().addComponents(
      ...buttonLabels.map((label, idx) =>
        new ButtonBuilder()
          .setCustomId(`performancepage_${idx}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === 0)
      )
    );

    // Send the first page as a reply, with navigation buttons
    await interaction.reply({ embeds: [embeds[0]], components: [row] });

    // Store page data for this interaction (for navigation handling elsewhere)
    interaction.client.pageData = {
      ...interaction.client.pageData,
      [interaction.id]: {
        pages: embeds,
        currentPage: 0,
        labels: buttonLabels
      },
    };
  },
};

function league(leagueData, rankData) {
  if (!leagueData || leagueData.gamesplayed === 0) {
    return null;
  }
  let apm = leagueData.apm;
  let pps = leagueData.pps;
  let vsScore = leagueData.vs;

  let apmRank = getRank(apm, rankData, 'apm');
  let ppsRank = getRank(pps, rankData, 'pps');
  let vsScoreRank = getRank(vsScore, rankData, 'vs');

  return { apm, pps, vsScore, apmRank, ppsRank, vsScoreRank };
}

function getRank(statValue, rankData, statKey) {
  let rank = 'd';
  for (const [r, data] of Object.entries(rankData)) {
    if (statValue >= data[statKey]) {
      rank = r;
      break;
    }
  }
  return rank;
}

