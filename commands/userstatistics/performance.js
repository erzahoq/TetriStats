const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { formatNumber, escapeUnderscores, getEmojiOfRank, getLeagueRankColour } = require('../../helpers/formatters');
const { getUser } = require('../../helpers/getuser');
const { database } = require('../../database');

let statRankData = {};

const getAltitude = (res) => Number(res?.stats?.zenith?.altitude ?? -Infinity);

// sometimes new records for the week are better than the career best, so pick the best of the two
const pickBestZenithResults = (summaryObj) => {
  if (!summaryObj) return null;
  const current = summaryObj.record?.results || null;       // this week
  const best = summaryObj.best?.record?.results || null; // career best

  if (current && !best) return current;
  if (!current && best) return best;
  if (!current && !best) return null;

  return getAltitude(current) > getAltitude(best) ? current : best;
};

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
    const user = await getUser(interaction.options.getString('user').toLowerCase());

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

    let response = await fetch(`https://ch.tetr.io/api/users/${user._id}/summaries`);
    let userStats = await response.json();
    userStats = userStats.data;

    delete userStats.zen;
    delete userStats.achievements;

    let leagueData = userStats.league;
    let linesData = userStats['40l'].record?.results;
    let blitzData = userStats.blitz.record?.results;

    let zenithData = pickBestZenithResults(userStats.zenith);
    let zenithExData = pickBestZenithResults(userStats.zenithex);

    const userLeagueRank = leagueData?.rank ?? null;

    const leagueEmbed = getEmbed(user.username, 'Tetra League', user._id, !leagueData || leagueData.played === 0, userLeagueRank, leagueData?.percentile_rank);
    const linesEmbed = getEmbed(user.username, '40 Lines', user._id, !linesData || linesData.played === 0, userLeagueRank, leagueData?.percentile_rank);
    const blitzEmbed = getEmbed(user.username, 'Blitz', user._id, !blitzData || blitzData.played === 0, userLeagueRank, leagueData?.percentile_rank);
    const quickplayEmbed = getEmbed(user.username, 'Quick Play', user._id, !zenithData, userLeagueRank, leagueData?.percentile_rank);
    const quickplayExEmbed = getEmbed(user.username, 'Expert Quick Play', user._id, !zenithExData, userLeagueRank, leagueData?.percentile_rank);

    // Prefer percentile_rank if the user is unranked ('z') or rank is missing
    const effectiveRank = (leagueData?.rank && leagueData.rank !== 'z')
      ? leagueData.rank
      : (leagueData?.percentile_rank || null);

    
    // add all the embed fields

    if (leagueData) {
      await addEmbedField(leagueEmbed, 'league/pps', 'Pieces Per Second', leagueData.pps, effectiveRank, { decimals: 3 });
      await addEmbedField(leagueEmbed, 'league/apm', 'Attack Per Minute', leagueData.apm, effectiveRank);
      await addEmbedField(leagueEmbed, 'league/vs', 'VS score', leagueData.vs, effectiveRank);
    }

    if (linesData) {
      await addEmbedField(linesEmbed, 'sprint/time', '', linesData.stats.finaltime, effectiveRank, { lowerIsBetter: true, isTime: true });
      await addEmbedField(linesEmbed, 'sprint/pps', 'Pieces Per Second', linesData.aggregatestats.pps, effectiveRank, { decimals: 3 });
      if (Number(linesData.stats.piecesplaced) > 0) {
        await addEmbedField(linesEmbed, 'sprint/kpp', 'Keys Per Piece', linesData.stats.inputs / linesData.stats.piecesplaced, effectiveRank, { decimals: 3, lowerIsBetter: true });
      }
      if (Number(linesData.stats.finaltime) > 0) {
        await addEmbedField(linesEmbed, 'sprint/kps', 'Keys Per Second', linesData.stats.inputs / (linesData.stats.finaltime / 1000), effectiveRank, { decimals: 3 });
      }
      if (linesData.stats.finesse !== undefined && Number(linesData.stats.piecesplaced) > 0) {
        await addEmbedField(linesEmbed, 'sprint/finesse', 'Finesse', (linesData.stats.finesse.perfectpieces / linesData.stats.piecesplaced), effectiveRank, { isPercentage: true });
      }
    }

    if (blitzData) {
      await addEmbedField(blitzEmbed, 'blitz/score', 'Score', blitzData.stats.score, effectiveRank, { decimals: 0 });
      await addEmbedField(blitzEmbed, 'blitz/pps', 'Pieces Per Second', blitzData.aggregatestats.pps, effectiveRank, { decimals: 3 });
      if (Number(blitzData.stats.piecesplaced) > 0) {
        await addEmbedField(blitzEmbed, 'blitz/spp', 'Score Per Piece', blitzData.stats.score / blitzData.stats.piecesplaced, effectiveRank);
      }
      if (blitzData.stats.finesse !== undefined && Number(blitzData.stats.piecesplaced) > 0) {
        await addEmbedField(blitzEmbed, 'blitz/finesse', 'Finesse', (blitzData.stats.finesse.perfectpieces / blitzData.stats.piecesplaced), effectiveRank, { isPercentage: true });
      }
    }

    if (zenithData) {
      await addEmbedField(quickplayEmbed, 'zenith/height', 'Meters', zenithData.stats.zenith.altitude, effectiveRank);
      await addEmbedField(quickplayEmbed, 'zenith/pps', 'Pieces Per Second', zenithData.aggregatestats.pps, effectiveRank, { decimals: 3 });
      await addEmbedField(quickplayEmbed, 'zenith/apm', 'Attack Per Minute', zenithData.aggregatestats.apm, effectiveRank);
      await addEmbedField(quickplayEmbed, 'zenith/climbSpeed', 'Average Climb Speed', zenithData.stats.zenith.rank, effectiveRank, { decimals: 3 });
      await addEmbedField(quickplayEmbed, 'zenith/btb', 'Highest Back-to-Back', zenithData.stats.topbtb, effectiveRank, { decimals: 0 });
      await addEmbedField(quickplayEmbed, 'zenith/finesse', 'Finesse', (zenithData.stats.finesse.perfectpieces / zenithData.stats.piecesplaced), effectiveRank, { isPercentage: true });
    }

    if (zenithExData) {
      await addEmbedField(quickplayExEmbed, 'zenithEx/height', 'Meters', zenithExData.stats.zenith.altitude, effectiveRank);
      await addEmbedField(quickplayExEmbed, 'zenithEx/pps', 'Pieces Per Second', zenithExData.aggregatestats.pps, effectiveRank, { decimals: 3 });
      await addEmbedField(quickplayExEmbed, 'zenithEx/apm', 'Attack Per Minute', zenithExData.aggregatestats.apm, effectiveRank);
      await addEmbedField(quickplayExEmbed, 'zenithEx/climbSpeed', 'Average Climb Speed', zenithExData.stats.zenith.rank, effectiveRank, { decimals: 3 });
      await addEmbedField(quickplayExEmbed, 'zenithEx/btb', 'Highest Back-to-Back', zenithExData.stats.topbtb, effectiveRank, { decimals: 0 });
      await addEmbedField(quickplayExEmbed, 'zenithEx/finesse', 'Finesse', (zenithExData.stats.finesse.perfectpieces / zenithExData.stats.piecesplaced), effectiveRank, { isPercentage: true });
    }

    const playedLeague = !!(leagueData && (
      Number(leagueData.played) > 0 ||
      leagueData.pps != null ||
      leagueData.apm != null ||
      leagueData.vs != null
    ));

    const played40L = !!(linesData && (Number(linesData.played) > 0 || Number(linesData?.stats?.finaltime) > 0));
    const playedBlitz = !!(blitzData && (Number(blitzData.played) > 0 || Number(blitzData?.stats?.score) > 0));

    // For zenith/zenithex results objects, use altitude > 0 as the signal of a meaningful run
    const playedZenith = !!(zenithData && (Number(zenithData?.stats?.zenith?.altitude) > 0));
    const playedZenithEx = !!(zenithExData && (Number(zenithExData?.stats?.zenith?.altitude) > 0));

    const modes = [
      { label: 'Tetra League', embed: leagueEmbed, played: playedLeague },
      { label: '40 Lines', embed: linesEmbed, played: played40L },
      { label: 'Blitz', embed: blitzEmbed, played: playedBlitz },
      { label: 'Quick Play', embed: quickplayEmbed, played: playedZenith },
      { label: 'Expert Quick Play', embed: quickplayExEmbed, played: playedZenithEx },
    ];

    const availableModes = modes.filter(m => m.played);

    // if they've played literally nothing, show a clean "new player" embed with no buttons
    if (availableModes.length === 0) {
      const newUserEmbed = new EmbedBuilder()
        .setDescription(
          `### __[${escapeUnderscores(user.username).toUpperCase()}](https://tetr.io/u/${user.username}) -> Performance__\n` +
          `No recorded games yet.`
        )
        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.png`)
        .setURL(`https://tetr.io/u/${user.username}`);

      return await interaction.reply({ embeds: [newUserEmbed] });
    }

    // otherwise, build labels and embeds from the available modes
    const buttonLabels = availableModes.map(m => m.label);
    const embeds = availableModes.map(m => m.embed);

    const row = new ActionRowBuilder().addComponents(
      ...buttonLabels.map((label, idx) =>
        new ButtonBuilder()
          .setCustomId(`performancepage_${idx}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === 0)
      )
    );

    await interaction.reply({ embeds: [embeds[0]], components: [row] });

    // store page data for this interaction (for navigation handling elsewhere)
    interaction.client.pageData = {
      ...interaction.client.pageData,
      [interaction.id]: {
        pages: embeds,
        currentPage: 0,
        labels: buttonLabels,
      },
    };

  },
};

function getEmbed(username, mode, userId, recordNotExists, userRank, userPercentile) {
  let statusLine = '';
  if (recordNotExists) {
    statusLine = `Hasn't played any ${mode} games yet!`;
  } else if (userRank && userRank !== 'z') {
    statusLine = `-# Ranked ${getEmojiOfRank(userRank)}`;
  } else if (typeof userPercentile === 'string' && userPercentile && userPercentile !== 'z') {
    statusLine = `-# Unranked ~ Around ${getEmojiOfRank(userPercentile)}`;
  } else {
    statusLine = `-# Unranked`;
  }

  const embed = new EmbedBuilder()
    .setColor(
      userRank === 'z' && userPercentile
        ? getLeagueRankColour(userPercentile)
        : getLeagueRankColour(userRank)
    )
    .setDescription(
      `### __[${escapeUnderscores(username).toUpperCase()}](https://tetr.io/u/${username}) -> Performance -> ${mode}__\n${statusLine}`
    )
    .setThumbnail(`https://tetr.io/user-content/avatars/${userId}.png`)
    .setURL(`https://tetr.io/u/${username}`);

  return embed;
}

async function getClosestRank(userValue, statKey, lowerIsBetter = false) {
  if (!statRankData[statKey]) {
    statRankData[statKey] = (await database.LeagueStat.findByPk(statKey)).values;
  }

  let bestRank = 'd';
  let bestDiff = Infinity;
  for (const [rank, value] of Object.entries(statRankData[statKey])) {
    if (!value) continue;
    const diff = Math.abs(Number(userValue) - value);

    if (diff < bestDiff) {
      bestRank = rank;
      bestDiff = diff;
    } else if (diff === bestDiff) {
      // tie-breaker: bias toward the "better" rank
      const better =
        (!lowerIsBetter && value > statRankData[statKey][bestRank]) ||
        (lowerIsBetter && value < statRankData[statKey][bestRank]);
      if (better) bestRank = rank;
    }
  }

  return bestRank;
}


async function addEmbedField(
  embed,
  dbStatKey,
  statName,
  statValue,
  effectiveRank,
  extras = { lowerIsBetter: false, isTime: false, decimals: 2, isPercentage: false }
) {
  if (statValue == null || !isFinite(Number(statValue))) return;

  const lowerIsBetter = !!extras.lowerIsBetter;
  const decimals = Number.isInteger(extras.decimals) ? extras.decimals : 2;

  // a bunch of helper functions for formatting
  const delta = (x, ref) => (lowerIsBetter ? (ref - x) : (x - ref));

  const fmtValue = (value) => {
    if (extras.isTime) {
      const seconds = value / 1000;
      if (value >= 60000) return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
      return seconds.toFixed(2) + 's';
    }

    if (extras.isPercentage) return (value * 100).toFixed(2) + '%';
    if (decimals === 0) return formatNumber(Math.round(value));
    
    const decimalShift = 10 ** decimals;
    return formatNumber(Math.floor(value)) + '.' + (Math.floor(value * decimalShift) % decimalShift).toString().padStart(decimals, '0');
  };

  const fmtDelta = (deltaValue) => {
    const sign = deltaValue > 0 ? '+' : deltaValue === 0 ? '±' : '';

    if (extras.isTime) return `${sign}${(deltaValue / 1000).toFixed(2)}s`;
    if (extras.isPercentage) return `${sign}${(deltaValue * 100).toFixed(2)}%`;
    if (decimals === 0) return `${sign}${formatNumber(Math.round(deltaValue))}`;

    return `${sign}${Number(deltaValue).toFixed(decimals)}`;
  };

  // 1. determine the "average rank" for this stat value
  const avgRank = await getClosestRank(statValue, dbStatKey, lowerIsBetter);
  const deltaToAvg = delta(statValue, Number(statRankData[dbStatKey][avgRank]));

  // 2. determine the "user rank baseline": ranked letter OR percentile_rank letter 
  let userRankLabel = null;
  let userRankValue = null;

  if (effectiveRank && effectiveRank !== 'z') {
    userRankLabel = getEmojiOfRank(effectiveRank);
    userRankValue = statRankData[dbStatKey][effectiveRank];
  } else {
    userRankLabel = 'Unranked';
  }

  const deltaToUser =
    userRankValue != null
      ? delta(statValue, userRankValue)
      : null;

  const displayValue = fmtValue(statValue);
  const lines = [`**${displayValue} ${statName}**`];

  const userRankLetter = effectiveRank || null;

  // 1) show “around …” first (only if different from the user's baseline rank)
  if (avgRank && deltaToAvg !== null && avgRank !== userRankLetter) {
    lines.push(`- around ${getEmojiOfRank(avgRank)} (${fmtDelta(deltaToAvg)})`);
  }

  // 2) then show “± compared to [current rank]” (skip entirely if Unranked)
  if (userRankLabel !== 'Unranked') {
    if (deltaToUser !== null) {
      lines.push(`- ${fmtDelta(deltaToUser)} compared to ${userRankLabel}`);
    } else {
      lines.push(`- compared to ${userRankLabel}`);
    }
  }

  // 3) show “compared to next rank …” based on the around-rank, if the rank is different

  if (avgRank && avgRank !== "x+") {
    const order = Object.keys(statRankData[dbStatKey]);
    const avgIdx = order.findIndex((rk) => rk === avgRank);
    const nextIdx = avgIdx >= 0 ? avgIdx + 1 : -1;
    const nextRow =
      nextIdx >= 0 && nextIdx < order.length ? order[nextIdx] : null;
    const isRedundant = nextRow && nextRow === userRankLetter;

    if (nextRow && !isRedundant) {
      const nextAvg = statRankData[dbStatKey][nextRow];
      if (nextAvg != null && isFinite(Number(nextAvg))) {
        lines.push(
          `- ${fmtDelta(delta(statValue, Number(nextAvg)))} compared to next rank (${getEmojiOfRank(nextRow)})`
        );
      }
    }
  }

  embed.addFields({ name: '\u200b', value: lines.join('\n'), inline: false });
}
