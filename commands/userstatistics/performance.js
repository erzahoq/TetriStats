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

    // remember the user's league rank (may be null/undefined)
    const userLeagueRank = leagueData?.rank ?? null;

    const leagueEmbed    = getEmbed(user.username, 'Tetra League', user._id, !leagueData || leagueData.played === 0, userLeagueRank, leagueData?.percentile_rank);
    const linesEmbed     = getEmbed(user.username, '40 Lines',    user._id, !linesData  || linesData.played  === 0, userLeagueRank, leagueData?.percentile_rank);
    const blitzEmbed     = getEmbed(user.username, 'Blitz',       user._id, !blitzData  || blitzData.played  === 0, userLeagueRank, leagueData?.percentile_rank);
    const quickplayEmbed = getEmbed(user.username, 'Quick Play',  user._id, !zenithData || zenithData.played === 0, userLeagueRank, leagueData?.percentile_rank);
    const quickplayExEmbed = getEmbed(user.username, 'Expert Quick Play', user._id, !zenithExData || zenithExData.played === 0, userLeagueRank, leagueData?.percentile_rank);

    if (leagueData) {
      await addEmbedField(leagueEmbed, 'leaguePps', 'Pieces Per Second', leagueData.pps,        { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(leagueEmbed, 'leagueApm', 'Attack Per Minute',  leagueData.apm,       { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(leagueEmbed, 'leagueVs',  'VS score',           leagueData.vs,        { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
    }

    if (linesData) {
      await addEmbedField(linesEmbed,  'sprintTime','' /*yeag*/,               linesData.stats.finaltime, { lowerIsBetter: true, isTime: true, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(linesEmbed,  'sprintPps', 'Pieces Per Second',  linesData.aggregatestats.pps, { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(linesEmbed,  'sprintKpp', 'Keys Per Piece',     linesData.stats.inputs / linesData.stats.piecesplaced, { decimals: 3, lowerIsBetter: true, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(linesEmbed,  'sprintKps', 'Keys Per Second',    linesData.stats.inputs / (linesData.stats.finaltime / 1000), { decimals: 3, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });

      if (linesData.stats.finesse !== undefined) { // some replays don't have finesse data... very cool
        await addEmbedField(linesEmbed,  'sprintFinesse','Finesse',         (linesData.stats.finesse.perfectpieces / linesData.stats.piecesplaced), { isPercentage: true, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      }
    }
      
    if (blitzData) {
      await addEmbedField(blitzEmbed,  'blitzScore','Score',              blitzData.stats.score, { decimals: 0, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(blitzEmbed,  'blitzPps',  'Pieces Per Second',  blitzData.aggregatestats.pps, { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(blitzEmbed,  'blitzSpp',  'Score Per Piece',    blitzData.stats.score / blitzData.stats.piecesplaced, { decimals: 3, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });

      if (blitzData.stats.finesse !== undefined) {
        await addEmbedField(blitzEmbed,  'blitzFinesse','Finesse',          (blitzData.stats.finesse.perfectpieces / blitzData.stats.piecesplaced), { isPercentage: true, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      }
    }

    if (zenithData) {
      await addEmbedField(quickplayEmbed, 'zenithHeight','Height',        zenithData.stats.zenith.altitude, { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(quickplayEmbed, 'zenithPps',   'Pieces Per Second', zenithData.aggregatestats.pps, { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(quickplayEmbed, 'zenithApm',   'Attack Per Minute',  zenithData.aggregatestats.apm, { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(quickplayEmbed, 'zenithClimbSpeed','Average Climb Speed', zenithData.stats.zenith.rank, { decimals: 3, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(quickplayEmbed, 'zenithBtb',   'Highest Back-to-Back', zenithData.stats.topbtb, { decimals: 0, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });

      // finesse is always here for zenith and expert
      await addEmbedField(quickplayEmbed, 'zenithFinesse','Finesse',      (zenithData.stats.finesse.perfectpieces / zenithData.stats.piecesplaced), { isPercentage: true, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
    }

    if (zenithExData) {
      await addEmbedField(quickplayExEmbed, 'zenithExHeight','Height',    zenithExData.stats.zenith.altitude, { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(quickplayExEmbed, 'zenithExPps',   'Pieces Per Second', zenithExData.aggregatestats.pps, { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(quickplayExEmbed, 'zenithExApm',   'Attack Per Minute',  zenithExData.aggregatestats.apm, { userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(quickplayExEmbed, 'zenithExClimbSpeed','Average Climb Speed', zenithExData.stats.zenith.rank, { decimals: 3, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(quickplayExEmbed, 'zenithExBtb',   'Highest Back-to-Back', zenithExData.stats.topbtb, { decimals: 0, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
      await addEmbedField(quickplayExEmbed, 'zenithExFinesse','Finesse',  (zenithExData.stats.finesse.perfectpieces / zenithExData.stats.piecesplaced), { isPercentage: true, userRank: userLeagueRank, userPercentile: leagueData?.percentile_rank });
    }

    //create pages dynamically
    const playedLeague = !!(leagueData &&
  (
    Number(leagueData.played) > 0 ||
    leagueData.pps != null ||
    leagueData.apm != null ||
    leagueData.vs  != null
  )
);
    const played40L       = !!(linesData && (Number(linesData.played) > 0 || Number(linesData?.stats?.finaltime) > 0));
    const playedBlitz     = !!(blitzData && (Number(blitzData.played) > 0 || Number(blitzData?.stats?.score) > 0));
    const playedZenith    = !!(zenithData && (Number(zenithData.played) > 0 || Number(zenithData?.stats?.zenith?.altitude) > 0));
    const playedZenithEx  = !!(zenithExData && (Number(zenithExData.played) > 0 || Number(zenithExData?.stats?.zenith?.altitude) > 0));

    const modes = [
      { label: 'Tetra League',       embed: leagueEmbed,     played: playedLeague },
      { label: '40 Lines',           embed: linesEmbed,      played: played40L },
      { label: 'Blitz',              embed: blitzEmbed,      played: playedBlitz },
      { label: 'Quick Play',         embed: quickplayEmbed,  played: playedZenith },
      { label: 'Expert Quick Play',  embed: quickplayExEmbed,played: playedZenithEx },
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

    // make navigation buttons
    const row = new ActionRowBuilder().addComponents(
      ...buttonLabels.map((label, idx) =>
        new ButtonBuilder()
          .setCustomId(`performancepage_${idx}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === 0)
      )
    );

    // send the first page as a reply, with navigation buttons
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

function getEmbed(username, mode, userId, recordExists, userRank, userPercentile) {
  let statusLine = '';
  if (recordExists) {
    statusLine = `Hasn't played any ${mode} games yet!`;
  } else if (userRank && userRank !== 'z') {
    statusLine = `-# Ranked ${getEmojiOfRank(userRank)}`;
  } else if (typeof userPercentile === 'string' && userPercentile && userPercentile !== 'z') {
    // percentile_rank is a rank letter like 's', 'ss', 'u', etc.
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

async function getRank(statValue, statKey, lowerIsBetter = false) {
  if (!rankData) {
    await database.LeagueAverage.findAll().then((data) => {
      rankData = [];
      data.forEach((entry) => rankData.push({ ...entry.dataValues, rank: entry.rank }));
    });
  }

  // filter out rows that don't have this stat
  const rows = rankData.filter(r => r[statKey] != null && isFinite(Number(r[statKey])));
  if (rows.length === 0 || !isFinite(Number(statValue))) {
    // fallback
    return 'd';
  }

  // find the closest by absolute difference
  let best = rows[0];
  let bestDiff = Math.abs(Number(statValue) - Number(rows[0][statKey]));

  // loop over all rows to find the closest
  for (let i = 1; i < rows.length; i++) {
    const ref = Number(rows[i][statKey]);
    const diff = Math.abs(Number(statValue) - ref);

    if (diff < bestDiff) {
      best = rows[i];
      bestDiff = diff;
    } else if (diff === bestDiff) {
      // tie-breaker: bias toward the "better" rank
      // if higher is better, prefer the row with the larger ref (closer upward)
      // if lower is better, prefer the row with the smaller ref (closer downward)
      const better =
        (!lowerIsBetter && ref > Number(best[statKey])) ||
        ( lowerIsBetter && ref < Number(best[statKey]));
      if (better) best = rows[i];
    }
  }

  return best.rank || 'd';
}


async function addEmbedField(
  embed,
  dbStatKey,
  statName,
  statValue,
  extras = { lowerIsBetter: false, isTime: false, decimals: 2, isPercentage: false, userRank: null, userPercentile: null }
) {
  if (statValue == null) return;

  // make sure rankdata is loaded
  if (!rankData) {
    await database.LeagueAverage.findAll().then((data) => {
      rankData = [];
      data.forEach((entry) => rankData.push({ ...entry.dataValues, rank: entry.rank }));
    });
  }

  const lowerIsBetter = !!extras.lowerIsBetter;
  const decimals = Number.isInteger(extras.decimals) ? extras.decimals : 2;

  // helper to find a row by rank letter
  const findRow = (rankLetter) => rankData?.find((r) => r.rank === rankLetter) || null;
  const delta = (x, ref) => (lowerIsBetter ? (ref - x) : (x - ref));
  const fmtValue = (v) => {
    if (extras.isTime) {
      // v is ms; display as s with 2 decimals (or mm:ss.xx if >= 60s)
      if (v >= 60000) return `${Math.floor(v / 60000)}:${((v % 60000) / 1000).toFixed(2)}`;
      return (v / 1000).toFixed(2) + 's';
    }
    if (extras.isPercentage) return (v * 100).toFixed(2) + '%';
    if (decimals === 0) return formatNumber(Math.round(v));
    const d = 10 ** decimals;
    return formatNumber(Math.floor(v)) + '.' + (Math.floor(v * d) % d).toString().padStart(decimals, '0');
  };
  const fmtDelta = (dVal) => {
    const sign = dVal >= 0 ? '+' : '';
    if (extras.isTime) return `${sign}${(dVal / 1000).toFixed(2)}s`;
    if (extras.isPercentage) return `${sign}${(dVal * 100).toFixed(2)}%`;
    if (decimals === 0) return `${sign}${formatNumber(Math.round(dVal))}`;
    return `${sign}${dVal.toFixed(decimals)}`;
  };

  // 1. determine the "average rank" for this stat value
  const avgRank = await getRank(statValue, dbStatKey, lowerIsBetter);
  const avgRow = findRow(avgRank);
  const deltaToAvg = avgRow && avgRow[dbStatKey] != null ? delta(statValue, Number(avgRow[dbStatKey])) : null;

  // 2. determine the "user rank baseline": ranked letter OR percentile_rank letter 
  let userBaselineRow = null;
  let userRankLabel = null;

  if (extras.userRank && extras.userRank !== 'z') {
    userBaselineRow = findRow(extras.userRank);
    userRankLabel = getEmojiOfRank(extras.userRank);
  } else if (typeof extras.userPercentile === 'string' && extras.userPercentile && extras.userPercentile !== 'z') {
    // percentile_rank is a rank letter; use it directly
    userBaselineRow = findRow(extras.userPercentile);
    userRankLabel = getEmojiOfRank(extras.userPercentile);
  } else {
    userRankLabel = 'Unranked';
  }




  const deltaToUser =
    userBaselineRow && userBaselineRow[dbStatKey] != null
      ? delta(statValue, Number(userBaselineRow[dbStatKey]))
      : null;

  // text time or sometghuing
  const displayValue = fmtValue(statValue);

  // first line: bold value + stat name
  const lines = [`**${displayValue} ${statName}**`];

  // “compared to …”
  if (deltaToUser !== null) {
    lines.push(`- ${fmtDelta(deltaToUser)} compared to ${userRankLabel}`);
  } else {
    lines.push(`- compared to ${userRankLabel}`);
  }

  // only show “around …” if avgRank is different from user rank
  const userRankLetter =
    (extras.userRank && extras.userRank !== 'z')
      ? extras.userRank
      : (typeof extras.userPercentile === 'string' && extras.userPercentile && extras.userPercentile !== 'z'
          ? extras.userPercentile
          : null);

  if (avgRank && deltaToAvg !== null && avgRank !== userRankLetter) {
    lines.push(`- around ${getEmojiOfRank(avgRank)} (${fmtDelta(deltaToAvg)})`);
  }

  // "rank above" relative to the around-rank
  try {
    if (avgRank && Array.isArray(rankData) && rankData.length > 0) {
      const order = rankData.map(r => r.rank);
      const avgIdx = order.indexOf(avgRank);
      const nextIdx = avgIdx >= 0 ? avgIdx + 1 : -1;
      const nextRow = nextIdx >= 0 && nextIdx < rankData.length ? rankData[nextIdx] : null;

      // skip x+ ranks
      const isTop = nextRow && String(nextRow.rank).toLowerCase() === 'x+';

      if (nextRow && !isTop) {
        const nextAvg = nextRow[dbStatKey];
        if (nextAvg != null && isFinite(Number(nextAvg))) {
          lines.push(`- rank above (${getEmojiOfRank(nextRow.rank)}) has ${fmtValue(Number(nextAvg))} ${statName}`);
        }
      }
    }
  } catch {}


  embed.addFields({ name: '\u200b', value: lines.join('\n'), inline: false });

}
