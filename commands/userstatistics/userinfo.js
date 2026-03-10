const { SlashCommandBuilder, EmbedBuilder, MessageFlags, InteractionContextType, ApplicationIntegrationType, } = require('discord.js');

const { formatNumber, escapeUnderscores, countryCodeToEmoji, formatPreciseTime, formatLongTime, getEmojiOfRank, formatISOString, calculateLevel, formatUsername, formatAchievement, buildPageButtonRows, } = require('../../helpers/formatters');
const { getUser } = require('../../helpers/getuser');
const { getEmoji } = require('../../helpers/emojis');
const { fetchCached } = require('../../helpers/fetch');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
    .setDescription('Get detailed information about a specific user via their TETR.IO (or Discord) username/ID.')
    .addStringOption((option) =>
      option
        .setName('user')
        .setDescription('the TETR.IO username / Discord to search for')
        .setRequired(true),
    ),

  async execute(interaction) {
    const user = await getUser(interaction.options.getString('user').toLowerCase()); // calls API only once

    if (user === 'no such user') {
      return await interaction.reply({
        content:
          'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
        flags: MessageFlags.Ephemeral,
      });
    } else if (user === 'server error') {
      return await interaction.reply({
        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // fetch from API using the ID
    const stats = await fetchCached(`https://ch.tetr.io/api/users/${user._id}`);
    const summary = await fetchCached(`https://ch.tetr.io/api/users/${user._id}/summaries`);

    const statData = stats.data;
    const summaryData = summary.data;

    const ach = Array.isArray(summaryData.achievements) ? summaryData.achievements : [];
    const badges = Array.isArray(statData.badges) ? statData.badges : [];

    // Count all unlocked achievements (ranked + unranked, including ISSUED)
    const unlockedCount = ach.reduce((sum, a) => {
      const unlocked = !a.stub && (a.rank === 100 || (typeof a.rank === 'number' && a.rank >= 1));
      return sum + (unlocked ? 1 : 0);
    }, 0);

    // Build a summary line for all unlocked achievements
    const medalLine = (() => {
      const counts = { 100: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const a of ach) {
        const unlocked = !a.stub && (a.rank === 100 || (typeof a.rank === 'number' && a.rank >= 1));
        if (!unlocked) continue;
        if (a.rank === 100) counts[100]++;
        else if (a.rank >= 1 && a.rank <= 5) counts[a.rank]++;
      }
      const order = [100, 1, 2, 3, 4, 5];
      const names = { 100: 'issued', 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'platinum', 5: 'diamond' };
      const parts = [];
      for (const k of order) {
        if (counts[k]) parts.push(`${getEmoji("ach_" + names[k])} ${counts[k]}`);
      }
      return parts.length ? '\n  - ' + parts.join(', ') : '';
    })();

    // ========= anon/bot detection =========
    // these accounts are kinda weird, anon has basically nothing, bot hides records but has some basic info
    if (statData.role === 'anon') {
      const embed = new EmbedBuilder()
        .setColor('#80bdff')
        .setThumbnail('https://tetr.io/res/avatar.png')
        .setDescription(`
### __${formatUsername(user.username)}__
## ANONYMOUS
${escapeUnderscores(user.username).toUpperCase()} is anonymous, which means they have no statistics, and cannot save replays. Only first seen date is known.

- About:
  - First seen ${formatISOString(statData.ts)}
`);
      return await interaction.reply({ embeds: [embed] });
    }

    if (statData.role === 'bot') {
      const embed = new EmbedBuilder()
        .setColor('#80bdff')
        .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
        .setFooter({ text: `User ID: ${statData._id}` })
        .setDescription(`
### __${formatUsername(user.username)} -> Quick Look__
## BOT
${escapeUnderscores(user.username).toUpperCase()} is a known bot, owned by ${String(statData.botmaster || 'unknown').toLowerCase()}. Their records are not available, but some general information can be shown.

- About:
  - Account created ${formatISOString(statData.ts)}
  - Level ${formatNumber(Math.floor(calculateLevel(statData.xp)))} (${formatNumber(Math.floor(statData.xp))} XP)
  - Has ${formatNumber(statData.friend_count)} friends
${formatGamesPlayed(statData.gamesplayed, statData.gameswon, statData.gametime) || ''}
`);
      return await interaction.reply({ embeds: [embed] });
    }
    // ========= end anon/bot detection =========

    const country = countryCodeToEmoji(statData.country);

    // big wall embeds, functions are split up inside them though so click those
    // i love function spam
    const pages = [
      new EmbedBuilder()
        .setColor('#80bdff')
        .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
        .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
        .setDescription(`
### __${formatUsername(user.username)} -> Quick Look__

- About:
  - Account created ${formatISOString(statData.ts)}
  - Level ${formatNumber(Math.floor(calculateLevel(statData.xp)))} (${formatNumber(Math.floor(statData.xp))} XP)
  - ${country}
  - Has ${formatNumber(statData.friend_count)} friends
${statData.supporter ? `  - Has supporter${starConvert(statData.supporter_tier)}${statData.bio ? `\n> -  ${statData.bio}` : ''}` : ''}${formatConnections(statData.connections)}
${formatOldUsernames(statData.oldusernames)}
  `)
        .setTimestamp(),

      new EmbedBuilder()
        .setColor('#ff9d7d')
        .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
        .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
        .setDescription(`
### __${formatUsername(user.username)} -> Quick Look -> General__

- Has ${unlockedCount} achievements${medalLine}${statData.ar > 0 ? `\n  - Totalling ${statData.ar} Achievement Rating` : ''}${formatBadges(badges)} ${formatDisplayedAchs(statData.achievements, ach)}
${formatGamesPlayed(statData.gamesplayed, statData.gameswon, statData.gametime) || ''}
  `)
        .setTimestamp(),

      new EmbedBuilder()
        .setColor('#ff7dc0')
        .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
        .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
        .setDescription(`
### __${formatUsername(user.username)} -> Quick Look -> Gameplay__
${formatLeaguePreview(summaryData, country)} ${formatZenith(summaryData, country)} ${formatZenith(summaryData, country, true)} ${format40Lines(summaryData, country)} ${formatBlitz(summaryData, country)} ${formatZen(summaryData)}
`)
        .setTimestamp(),
    ];

    const key = interaction.id;
    const commandName = 'user';
    const labels = ['Profile', 'General', 'Gameplay'];

    interaction.client.pageData.set(key, {
      commandName,
      ownerId: interaction.user.id,
      pages,
      labels,
      currentPage: 0,
      ttlMs: 10 * 60 * 1000,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // build standard buttons (customIds like `user:page-<key>-<i>`)
    const rows = buildPageButtonRows({ commandName, key, labels, activeIndex: 0 });

    // send initial page
    await interaction.reply({
      embeds: [pages[0]],
      components: rows,
    });

  },
};

// most of these functions are self-explanatory
// good typo :aysm:

function gamesWonConvert(gamesWon, gamesPlayed) {
  if (gamesWon === 'Hidden' || gamesPlayed === 'Hidden' || gamesPlayed === 0) {
    return gamesWon;
  }

  return `${gamesWon} (${formatNumber(100 * gamesWon / gamesPlayed, 2)}%)`;
}

function formatBadges(badgelist) {
  if (badgelist.length > 0) {
    return `\n  - As well as ${badgelist.length} badges`;
  } 
    return ``;
  
}

function formatGamesPlayed(gamesplayed, gameswon, gamestime) {
  if (gamesplayed > -1) {
    return `\n- Played ${gamesplayed} games
  - Won ${gamesWonConvert(gameswon, gamesplayed)} of them
  -  ${formatLongTime(gamestime, true)} played (${formatLongTime(gamestime)})`;
  } 
    return '\n- Has hidden games played';
  
}

function starConvert(supporterTier) {
  let supporterString = '';

  for (let i = 1; i < supporterTier; i++) {
    supporterString = supporterString.concat(` ${getEmoji('supporter_star')}`);
  }
  return supporterString;
}

function formatConnections(connections) {
  const connectionTypes = ['Discord', 'Twitch', 'Twitter', 'Reddit', 'Youtube', 'Steam'];
  const formattedList = [];

  connectionTypes.forEach((connection) => {
    if (connections[connection.toLowerCase()]) {
      const username = connections[connection.toLowerCase()].display_username || connections[connection.toLowerCase()].username;
      formattedList.push(`  - ${connection}: ${username}`);
    }
  });

  if (formattedList.length === 0) {
    return '';
  }

  return `\n\n- ${formattedList.length} connections\n` + formattedList.join('\n');
}

//small and cute league function (will purr at you if it gets the chance)
function formatLeaguePreview(statistics, country) {
  const leagueStats = statistics.league;

  const gamesPlayed = leagueStats.gamesplayed;
  const gamesWon = leagueStats.gameswon;
  const ratingDeviation = leagueStats.rd;
  let rating = leagueStats.tr;
  const rank = leagueStats.rank;
  const estRank = leagueStats.percentile_rank;

  if (rating < 0) {
    rating = `${leagueStats.gamesplayed}/10 rating games`;
  } else {
    rating = `${formatNumber(rating, 2)} TR`;
  }

  let standing = '';

  if (rank !== leagueStats.bestrank && gamesPlayed !== 0 && leagueStats.bestRank) {
    standing += `\n  - Has reached ${getEmojiOfRank(leagueStats.bestrank)}`;
  }

  if (ratingDeviation > 100) {
    standing += `\n  - Probably around ${getEmojiOfRank(estRank)}`;
  }
  if (leagueStats.standing > 0) {
    standing += `\n  - Ranked #${leagueStats.standing} ${formatCountry(leagueStats.standing_local, country)}`;
  }

  if (gamesPlayed !== 0) {
    standing += `\n  - Won ${gamesWon}/${gamesPlayed} games (${formatNumber(gamesWon / gamesPlayed * 100, 2)}%)\n  - ${
      leagueStats.vs || 'N/A'
    } VS score`;
  }

  return `\n- ${getEmoji('league')} **${rating}**, ${getEmojiOfRank(rank)} ${standing}`;
}

function format40Lines(statistics, country) {
  if (statistics['40l'].record) {
    const flStatistics = statistics['40l'];
    const results = flStatistics.record.results;
    return `\n- ${getEmoji('40lines')} **40 Lines in ${formatPreciseTime(results.stats.finaltime)}**
  - Ranked #${formatNumber(flStatistics.rank)} ${formatCountry(flStatistics.rank_local, country)}
  - [Submitted ${formatISOString(flStatistics.record.ts)}](https://tetr.io/#R:${flStatistics.record.replayid})
  - ${formatNumber(results.aggregatestats.pps, 2)} PPS | ${formatNumber(results.stats.finesse.faults)} finesse faults`;
  } 
    return '';
  
}

function formatBlitz(statistics, country) {
  if (statistics.blitz.record) {
    const blStatistics = statistics.blitz;
    return `\n- ${getEmoji('blitz')} **${formatNumber(blStatistics.record.results.stats.score)} points in Blitz**
  - Ranked #${formatNumber(blStatistics.rank)} ${formatCountry(blStatistics.rank_local, country)}
  - [Submitted ${formatISOString(blStatistics.record.ts)}](https://tetr.io/#R:${blStatistics.record.replayid})
  - ${formatNumber(blStatistics.record.results.aggregatestats.pps, 2)} PPS | ${formatNumber(blStatistics.record.results.stats.score / blStatistics.record.results.stats.piecesplaced, 2)} Points/Piece`;
  } 
    return '';
  
}

function formatZenith(statistics, country, expert = false) {
  const zenithVer = expert ? 'zenithex' : 'zenith';
  const zenithVerLong = expert ? 'Quick Play EXPERT' : 'Quick Play';
  let zenithText = '';
  const zStatistics = statistics[zenithVer];

  if (statistics[zenithVer].record) {
    zenithText = `\n- ${getEmoji('quickplay')} **${formatNumber(zStatistics.record.results.stats.zenith.altitude, 2)}m in ${zenithVerLong}**
  - Ranked #${formatNumber(zStatistics.rank)} ${formatCountry(zStatistics.rank_local, country)}
  - [Submitted ${formatISOString(zStatistics.record.ts)}](https://tetr.io/#R:${zStatistics.record.replayid})
  - ${formatNumber(zStatistics.record.results.aggregatestats.pps, 2)} PPS | ${formatNumber(zStatistics.record.results.aggregatestats.apm, 2)} APM
  - Floor ${zStatistics.record.results.stats.zenith.floor} | ${zStatistics.record.results.stats.kills} KOs | Reached ${
      zStatistics.record.results.stats.topbtb
    } B2B`;
    if (statistics[zenithVer].best.record) {
      zenithText += `\n  - All-time best is ${formatNumber(zStatistics.best.record.results.stats.zenith.altitude, 2)}m (#${formatNumber(zStatistics.best.rank)})`;
    }
  } else if (statistics[zenithVer].best.record) {
    zenithText = `\n- ${getEmoji('quickplay')} Hasn't played ${zenithVerLong} this week
  - All-time best is ${formatNumber(zStatistics.best.record.results.stats.zenith.altitude, 2)}m
  - Ranked #${formatNumber(zStatistics.best.rank)}
  - [Submitted ${formatISOString(zStatistics.best.record.ts)}](https://tetr.io/#R:${zStatistics.best.record.replayid})`;
  }

  return zenithText;
}

function formatZen(statistics) {
  if (statistics.zen) {
    const zenStatistics = statistics.zen;
    return `\n- ${getEmoji('zen')} **Level ${zenStatistics.level} in Zen**
  - ${formatNumber(Math.round(zenStatistics.score))} points`;
  } 
    return '';
  
}

function formatDisplayedAchs(displayed = [], all = []) {
  let displayCase = '\n  - Displayed achievements:';

  all.forEach((achievement) => {
    if (displayed.includes(achievement.k)) {
      displayCase += `\n    - ` + formatAchievement(achievement);
    }
  });

  if (displayCase !== '\n  - Displayed achievements:') return displayCase;
  return '';
}

function formatCountry(localRank, country) {
  if (localRank > 0) return `(#${formatNumber(localRank)} ${country})`;
  return '';
}

function formatOldUsernames(usernameArray) {
  if (usernameArray.length === 0) return '';

  let usernames = `- Previous usernames:`;

  usernameArray.forEach((name) => {
    usernames = usernames + `\n  - ${name.username}`;
  });

  return usernames;
}
