const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
import('node-fetch'); // Ensure 'node-fetch' is imported properly

// Import helper functions for formatting and data processing
const { formatNumber, escapeUnderscores, getEmojiOfRank, getLeagueRankColour } = require('../../helpers/functions');
const { getUser } = require('../../helpers/getuser');
const { getEmoji } = require('../../helpers/emojis');
const { database } = require('../../database');

let rankData;

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

    let leagueData = userStats.league;
    let linesData = userStats['40l'].record?.results;
    let blitzData = userStats.blitz.record?.results;
    let zenithData = (userStats.zenith.best?.record || userStats.zenith.record)?.results;
    let zenithExData = (userStats.zenithex.record || userStats.zenithex.best?.record)?.results;

    const leagueEmbed = getEmbed(user.username, 'Tetra League', user._id, !leagueData || leagueData.played === 0);
    if (leagueData) {
      await addEmbedField(leagueEmbed, 'leaguePps', 'Pieces Per Second', leagueData.pps);
      await addEmbedField(leagueEmbed, 'leagueApm', 'Attack Per Minute', leagueData.apm);
      await addEmbedField(leagueEmbed, 'leagueVs', 'VS score', leagueData.vs);
    }

    const linesEmbed = getEmbed(user.username, '40 Lines', user._id, !linesData || linesData.played === 0);
    if (linesData) {
      await addEmbedField(linesEmbed, 'sprintTime', 'Time', linesData.stats.finaltime, { lowerIsBetter: true, isTime: true });
      await addEmbedField(linesEmbed, 'sprintPps', 'Pieces Per Second', linesData.aggregatestats.pps);
      await addEmbedField(linesEmbed, 'sprintKpp', 'Keys Per Piece', linesData.stats.inputs / linesData.stats.piecesplaced, { decimals: 3, lowerIsBetter: true });
      await addEmbedField(linesEmbed, 'sprintKps', 'Keys Per Second', linesData.stats.inputs / (linesData.stats.finaltime / 1000), { decimals: 3 });

      if (linesData.stats.finesse !== undefined) { // some replays don't have finesse data... very cool
        await addEmbedField(linesEmbed, 'sprintFinesse', 'Finesse', (linesData.stats.finesse.perfectpieces / linesData.stats.piecesplaced), { isPercentage: true });
      }
    }
      

    const blitzEmbed = getEmbed(user.username, 'Blitz', user._id, !blitzData || blitzData.played === 0);
    if (blitzData) {
      await addEmbedField(blitzEmbed, 'blitzScore', 'Score', blitzData.stats.score, { decimals: 0 });
      await addEmbedField(blitzEmbed, 'blitzPps', 'Pieces Per Second', blitzData.aggregatestats.pps);
      await addEmbedField(blitzEmbed, 'blitzSpp', 'Score Per Piece', blitzData.stats.score / blitzData.stats.piecesplaced, { decimals: 3 });

      if (blitzData.stats.finesse !== undefined) {
        await addEmbedField(blitzEmbed, 'blitzFinesse', 'Finesse', (blitzData.stats.finesse.perfectpieces / blitzData.stats.piecesplaced), { isPercentage: true });
      }
    }

    const quickplayEmbed = getEmbed(user.username, 'Quick Play', user._id, !zenithData || zenithData.played === 0);
    if (zenithData) {
      await addEmbedField(quickplayEmbed, 'zenithHeight', 'Height', zenithData.stats.zenith.altitude);
      await addEmbedField(quickplayEmbed, 'zenithPps', 'Pieces Per Second', zenithData.aggregatestats.pps);
      await addEmbedField(quickplayEmbed, 'zenithApm', 'Attack Per Minute', zenithData.aggregatestats.apm);
      await addEmbedField(quickplayEmbed, 'zenithClimbSpeed', 'Average Climb Speed', zenithData.stats.zenith.rank, { decimals: 3 });
      await addEmbedField(quickplayEmbed, 'zenithBtb', 'Highest Back-to-Back', zenithData.stats.topbtb, { decimals: 0 });

      // finesse is always here for zenith and expert
      await addEmbedField(quickplayEmbed, 'zenithFinesse', 'Finesse', (zenithData.stats.finesse.perfectpieces / zenithData.stats.piecesplaced), { isPercentage: true });
    }

    const quickplayExEmbed = getEmbed(user.username, 'Quick Play EX', user._id, !zenithExData || zenithExData.played === 0);
    if (zenithExData) {
      await addEmbedField(quickplayExEmbed, 'zenithExHeight', 'Height', zenithExData.stats.zenith.altitude);
      await addEmbedField(quickplayExEmbed, 'zenithExPps', 'Pieces Per Second', zenithExData.aggregatestats.pps);
      await addEmbedField(quickplayExEmbed, 'zenithExApm', 'Attack Per Minute', zenithExData.aggregatestats.apm);
      await addEmbedField(quickplayExEmbed, 'zenithExClimbSpeed', 'Average Climb Speed', zenithExData.stats.zenith.rank, { decimals: 3 });
      await addEmbedField(quickplayExEmbed, 'zenithExBtb', 'Highest Back-to-Back', zenithExData.stats.topbtb, { decimals: 0 });
      await addEmbedField(quickplayExEmbed, 'zenithExFinesse', 'Finesse', (zenithExData.stats.finesse.perfectpieces / zenithExData.stats.piecesplaced), { isPercentage: true });
    }

    const buttonLabels = ['Tetra League', '40 Lines', 'Blitz', 'Quick Play', 'Quick Play EX'];
    const embeds = [leagueEmbed, linesEmbed, blitzEmbed, quickplayEmbed, quickplayExEmbed];

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

function getEmbed(username, mode, userId, recordExists) {
  const embed = new EmbedBuilder()
    .setDescription(`### __[${escapeUnderscores(username).toUpperCase()}](https://tetr.io/u/${username}) -> Performance -> ${mode}__\n${recordExists ? `Hasn't played any ${mode} games yet!` : ''}`)
    .setThumbnail(`https://tetr.io/user-content/avatars/${userId}.png`)
    .setURL(`https://tetr.io/u/${username}`)
  
  return embed;
}

async function addEmbedField(embed, dbStatKey, statName, statValue, extras = { lowerIsBetter: false, isTime: false, decimals: 2, isPercentage: false }) {
  if (!statValue) return;

  let rank = await getRank(statValue, dbStatKey, extras.lowerIsBetter);
  let emoji = getEmojiOfRank(rank);
  let value;

  if (extras.isTime) {
    value = (statValue / 1000).toFixed(2) + 's';
    if (statValue >= 60000) value = `${Math.floor(statValue / 60000)}:${((statValue % 60000) / 1000).toFixed(2)}`;
  } else if (extras.isPercentage) {
    value = (statValue * 100).toFixed(2) + '%';
  } else {
    const d = 10 ** (extras.decimals);
    value = formatNumber(Math.floor(statValue)) + '.' + (Math.floor(statValue * d) % d).toString().padStart(extras.decimals, '0');

    if (extras.decimals === 0) {
      value = formatNumber(Math.round(statValue)); // round instead of floor
    }
  }

  embed.addFields({ name: `${statName}`, value: `**${value}** (Around ${emoji})`, inline: true });
}

async function getRank(statValue, statKey, lowerIsBetter = false) {
  if (!rankData) {
    await database.LeagueAverage.findAll().then((data) => {
      rankData = [];
      data.forEach((entry) => rankData.push({...entry.dataValues, rank: entry.rank}));
    });
  }

  let rank = 'z';
  for (let i = 0; i < rankData.length; i++) {
    const betterThanRank = (statValue > rankData[i][statKey] && !lowerIsBetter) || (statValue < rankData[i][statKey] && lowerIsBetter)

    if (!betterThanRank) {
      if (i === 0) rank = 'd';
      else rank = rankData[i - 1].rank || 'd';

      break;
    }
    if (betterThanRank && i === rankData.length - 1) {
      rank = rankData[i].rank;
    }
  }

  return rank;
}

