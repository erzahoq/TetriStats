const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  InteractionContextType,
  ApplicationIntegrationType,
} = require('discord.js');

import('node-fetch'); // Ensure 'node-fetch' is imported properly

const {
  formatNumber,
  escapeUnderscores,
  countryCodeToEmoji,
  convertToTimeFormat,
  playtimeConvert,
  getEmojiOfAch,
  getEmojiOfRank,
  reformatTimestamp,
  calculateLevel,
} = require('../../helpers/functions');

const { getUser } = require('../../helpers/getuser');
const { getEmoji } = require('../../helpers/emojis');

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
    const response = await fetch(`https://ch.tetr.io/api/users/${user._id}`);
    const summaryRaw = await fetch(`https://ch.tetr.io/api/users/${user._id}/summaries`);

    const stats = await response.json();
    const summary = await summaryRaw.json();

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
        if (counts[k]) parts.push(`${getEmojiOfAch(names[k])} ${counts[k]}`);
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
### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username})__
## ANONYMOUS
${escapeUnderscores(user.username).toUpperCase()} is anonymous, which means they have no statistics, and cannot save replays. Only first seen date is known.

- About:
  - First seen ${reformatTimestamp(statData.ts)}
`);
      return await interaction.reply({ embeds: [embed] });
    }

    if (statData.role === 'bot') {
      const embed = new EmbedBuilder()
        .setColor('#80bdff')
        .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
        .setFooter({ text: `User ID: ${statData._id}` })
        .setDescription(`
### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Quick Look__
## BOT
${escapeUnderscores(user.username).toUpperCase()} is a known bot, owned by ${String(statData.botmaster || 'unknown').toLowerCase()}. Their records are not available, but some general information can be shown.

- About:
  - Account created ${reformatTimestamp(statData.ts)}
  - Level ${formatNumber(Math.floor(calculateLevel(statData.xp)))} (${formatNumber(Math.floor(statData.xp))} XP)
  - Has ${statData.friend_count} friends
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
### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Quick Look__

- About:
  - Account created ${reformatTimestamp(statData.ts)}
  - Level ${formatNumber(Math.floor(calculateLevel(statData.xp)))} (${formatNumber(Math.floor(statData.xp))} XP)
  - ${country}
  - Has ${statData.friend_count} friends
${statData.supporter ? `  - Has supporter${starConvert(statData.supporter_tier)}${statData.bio ? `\n> -  ${statData.bio}` : ''}` : ''}${formatConnections(statData.connections)}
${formatOldUsernames(statData.oldusernames)}
  `)
        .setTimestamp(),

      new EmbedBuilder()
        .setColor('#ff9d7d')
        .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
        .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
        .setDescription(`
### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Quick Look -> General__

- Has ${unlockedCount} achievements${medalLine}${statData.ar > 0 ? `\n  - Totalling ${statData.ar} Achievement Rating` : ''}${formatBadges(badges)} ${formatDisplayedAchs(statData.achievements, ach)}
${formatGamesPlayed(statData.gamesplayed, statData.gameswon, statData.gametime) || ''}
  `)
        .setTimestamp(),

      new EmbedBuilder()
        .setColor('#ff7dc0')
        .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
        .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
        .setDescription(`
### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Quick Look -> Gameplay__
${formatLeaguePreview(summaryData, country)} ${formatZenith(summaryData, country)} ${formatZenithExpert(summaryData, country)} ${format40Lines(summaryData, country)} ${formatBlitz(summaryData, country)} ${formatZen(summaryData)}
`)
        .setTimestamp(),
    ];

    //initial row of buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('profilepage_0').setLabel('Profile').setStyle(ButtonStyle.Primary).setDisabled(true), //disable the first button initially
      new ButtonBuilder().setCustomId('profilepage_1').setLabel('General').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('profilepage_2').setLabel('Gameplay').setStyle(ButtonStyle.Primary),
    );

    //send the initial message with the first page and buttons
    await interaction.reply({
      embeds: [pages[0]],
      components: [row],
    });

    //attach pages to the interaction for future reference
    interaction.client.pageData = {
      [interaction.id]: {
        pages,
        currentPage: 0,
      },
    };
  },
};

// most of these functions are self-explanatory
// good typo :aysm:

function gamesWonConvert(gamesWon, gamesPlayed) {
  if (gamesWon === 'Hidden' || gamesPlayed === 'Hidden' || gamesPlayed === 0) {
    return gamesWon;
  }

  return `${gamesWon} (${Math.round(10000 * (gamesWon / gamesPlayed)) / 100}%)`;
}

function formatBadges(badgelist) {
  if (badgelist.length > 0) {
    return `\n  - As well as ${badgelist.length} badges`;
  } else {
    return ``;
  }
}

function formatGamesPlayed(gamesplayed, gameswon, gamestime) {
  if (gamesplayed > -1) {
    return `\n- Played ${gamesplayed} games
  - Won ${gamesWonConvert(gameswon, gamesplayed)} of them
  - Has ${playtimeConvert(gamestime)} of playtime`;
  } else {
    return '\n- Has hidden games played';
  }
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
  const leagueStats = statistics['league'];

  let gamesPlayed = leagueStats.gamesplayed;
  let gamesWon = leagueStats.gameswon;
  let ratingDeviation = leagueStats.rd;
  let rating = leagueStats.tr;
  let rank = leagueStats.rank;
  let estRank = leagueStats.percentile_rank;

  let progressToNextRank = (leagueStats.prev_at - leagueStats.standing) / (leagueStats.prev_at - leagueStats.next_at);

  let prevRank = leagueStats.prev_rank;
  let nextRank = leagueStats.next_rank;

  if (!nextRank && prevRank === 'x') {
    prevRank = 'x+';
    nextRank = 'top';
  }

  if (!prevRank && nextRank === 'd+') {
    prevRank = 'd';
  }

  prevRank = getEmojiOfRank(prevRank);
  nextRank = getEmojiOfRank(nextRank);

  let recordDisplay = Math.round(10000 * (gamesWon / gamesPlayed)) / 100;

  if (rating < 0) {
    if (leagueStats.gamesplayed === 0) {
      recordDisplay = 0;
    }
    rating = `${leagueStats.gamesplayed}/10 rating games`;
    progressToNextRank = leagueStats.gamesplayed / 10;
    prevRank = '';
    nextRank = getEmoji('rank_z');
  } else {
    rating = `${formatNumber(Math.round(rating * 100) / 100)} TR`;
  }

  let standing = '';

  if (rank != leagueStats.bestrank && gamesPlayed !== 0 && leagueStats.bestRank) {
    standing += `\n  - Has reached ${getEmojiOfRank(leagueStats.bestrank)}`;
  }

  if (ratingDeviation > 100) {
    standing += `\n  - Probably around ${getEmojiOfRank(estRank)}`;
  }
  if (leagueStats.standing > 0) {
    standing += `\n  - Ranked #${leagueStats.standing} ${formatCountry(leagueStats.standing_local, country)}`;
  }

  if (gamesPlayed !== 0) {
    standing += `\n    - Won ${gamesWon}/${gamesPlayed} games (${((gamesWon / gamesPlayed) * 100).toFixed(2)}%)\n    - ${
      leagueStats.vs || 'N/A'
    } VS score`;
  }

  return `\n- ${getEmoji('league')} **${rating}**, ${getEmojiOfRank(rank)} ${standing}`;
}

function format40Lines(statistics, country) {
  if (statistics['40l'].record) {
    let flStatistics = statistics['40l'];
    let results = flStatistics.record.results;
    return `\n- ${getEmoji('40lines')} **40 Lines in ${convertToTimeFormat(results.stats.finaltime)}**
  - Ranked #${formatNumber(flStatistics.rank)} ${formatCountry(flStatistics.rank_local, country)}
  - [Submitted ${reformatTimestamp(flStatistics.record.ts)}](https://tetr.io/#R:${flStatistics.record.replayid})
  - ${Math.round(results.aggregatestats.pps * 100) / 100} PPS | ${formatNumber(results.stats.finesse.faults)} finesse faults`;
  } else {
    return '';
  }
}

function formatBlitz(statistics, country) {
  if (statistics['blitz'].record) {
    let blStatistics = statistics['blitz'];
    return `\n- ${getEmoji('blitz')} **${formatNumber(blStatistics.record.results.stats.score)} points in Blitz**
  - Ranked #${formatNumber(blStatistics.rank)} ${formatCountry(blStatistics.rank_local, country)}
  - [Submitted ${reformatTimestamp(blStatistics.record.ts)}](https://tetr.io/#R:${blStatistics.record.replayid})
  - ${Math.round(blStatistics.record.results.aggregatestats.pps * 100) / 100} PPS | ${formatNumber(
    Math.round((blStatistics.record.results.stats.score / blStatistics.record.results.stats.piecesplaced) * 100) / 100,
  )} Points/Piece`;
  } else {
    return '';
  }
}

function formatZenith(statistics, country) {
  let zenithText = '';
  let zStatistics = statistics['zenith'];

  if (statistics['zenith'].record) {
    zenithText = `\n- ${getEmoji('quickplay')} **${formatNumber(Math.round(zStatistics.record.results.stats.zenith.altitude * 100) / 100)}m in Quick Play**
  - Ranked #${formatNumber(zStatistics.rank)} ${formatCountry(zStatistics.rank_local, country)}
  - [Submitted ${reformatTimestamp(zStatistics.record.ts)}](https://tetr.io/#R:${zStatistics.record.replayid})
  - ${Math.round(zStatistics.record.results.aggregatestats.pps * 100) / 100} PPS | ${Math.round(
      zStatistics.record.results.aggregatestats.apm * 100,
    ) / 100} APM
  - Floor ${zStatistics.record.results.stats.zenith.floor} | ${zStatistics.record.results.stats.kills} KOs | Reached ${
      zStatistics.record.results.stats.topbtb
    } B2B`;
    if (statistics['zenith'].best.record) {
      zenithText += `\n  - All-time best is ${formatNumber(
        Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100,
      )}m (#${formatNumber(zStatistics.best.rank)})`;
    }
  } else if (statistics['zenith'].best.record) {
    zenithText = `\n- ${getEmoji('quickplay')} Hasn't played Quick Play this week
  - All-time best is ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100)}m
  - Ranked #${formatNumber(zStatistics.best.rank)}
  - [Submitted ${reformatTimestamp(zStatistics.best.record.ts)}](https://tetr.io/#R:${zStatistics.best.record.replayid})`;
  }

  return zenithText;
}

function formatZenithExpert(statistics, country) {
  let zenithText = '';
  let zStatistics = statistics['zenithex'];

  if (statistics['zenithex'].record) {
    zenithText = `\n- ${getEmoji('quickplayexpert')} **${formatNumber(
      Math.round(zStatistics.record.results.stats.zenith.altitude * 100) / 100,
    )}m in Quick Play EXPERT**
  - Ranked #${formatNumber(zStatistics.rank)} ${formatCountry(zStatistics.rank_local, country)}
  - [Submitted ${reformatTimestamp(zStatistics.record.ts)}](https://tetr.io/#R:${zStatistics.record.replayid})
  - ${Math.round(zStatistics.record.results.aggregatestats.pps * 100) / 100} PPS | ${Math.round(
      zStatistics.record.results.aggregatestats.apm * 100,
    ) / 100} APM
  - Floor ${zStatistics.record.results.stats.zenith.floor} | ${zStatistics.record.results.stats.kills} KOs | Reached ${
      zStatistics.record.results.stats.topbtb
    } B2B`;
    if (statistics['zenith'].best.record) {
      zenithText += `\n  - All-time best is ${formatNumber(
        Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100,
      )}m (#${formatNumber(zStatistics.best.rank)})`;
    }
  } else if (statistics['zenithex'].best.record) {
    zenithText = `\n- ${getEmoji('quickplayexpert')} Hasn't played Quick Play EXPERT this week
  - All-time best is ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100)}m
  - Ranked #${formatNumber(zStatistics.best.rank)}
  - [Submitted ${reformatTimestamp(zStatistics.best.record.ts)}](https://tetr.io/#R:${zStatistics.best.record.replayid})`;
  }

  return zenithText;
}

function formatZen(statistics) {
  if (statistics['zen']) {
    let zenStatistics = statistics['zen'];
    return `\n- ${getEmoji('zen')} **Level ${zenStatistics.level} in Zen**
  - ${formatNumber(Math.round(zenStatistics.score))} points`;
  } else {
    return '';
  }
}

function formatDisplayedAchs(displayed = [], all = []) {
  const achievementMapping = {
    100: 'issued',
    1: 'bronze',
    2: 'silver',
    3: 'gold',
    4: 'platinum',
    5: 'diamond',
  };

  let displayCase = '\n  - Displayed achievements:';

  all.forEach((achievement) => {
    if (displayed.includes(achievement['k'])) {
      displayCase += `\n    - ` + getEmojiOfAch(achievementMapping[achievement['rank']]);

      // the formatting here is certainly
      if (achievement.vt === 4) {
        displayCase += ` **${achievement['name']}** - **Floor ${Math.floor(achievement.a)}** (${formatNumber(
          Math.round(achievement.v * 100) / 100,
        )}m) ${achievement.object || ''}`;
      } else {
        if (achievement['rank'] !== 100) {
          const prettyValue =
            achievement.v < 0 ? convertToTimeFormat(Math.abs(achievement.v)) : formatNumber(Math.round(achievement.v));

          displayCase += ` **${achievement['name']}** - **${prettyValue}** ${achievement.object || ''}`;
        } else if (achievement.vt === 5) {
          displayCase += ` **${achievement['name']}** - Obtained ${reformatTimestamp(-achievement.v)} ${
            achievement.object || ''
          }`;
        } else if (achievement.vt === 6) {
          displayCase += ` **${achievement['name']}** - ${formatNumber(-Math.round(achievement.v))} ${
            achievement.object || ''
          }`;
        }
      }

      if (achievement['rank'] === 100) {
        displayCase += ` (Issue ${achievement['pos']}/${achievement['total']})`;
      } else {
        if (achievement['pos'] < 100) {
          displayCase += ` (**#${achievement['pos'] + 1}**)`;
        } else if (achievement['pos'] / achievement['total'] < 0.01) {
          displayCase += ` (Top ${Math.round((achievement['pos'] / achievement['total']) * 100000) / 1000}%)`;
        } else {
          displayCase += ` (Top ${Math.round((achievement['pos'] / achievement['total']) * 10000) / 100}%)`;
        }
      }

      if (achievement['x'] && achievement['x'].ally !== undefined) {
        displayCase += ` (With [${achievement['x'].ally.username.toUpperCase()}](https://ch.tetr.io/u/${
          achievement['x'].ally.username
        }))`;
      }
    }
  });

  if (displayCase != '\n  - Displayed achievements:') return displayCase;
  return '';
}

function formatCountry(localRank, country) {
  if (localRank > 0) return `(#${formatNumber(localRank)} ${country})`;
  else return '';
}

// i nuked a massive comment here and it was probably deserved

function formatOldUsernames(usernameArray) {
  if (usernameArray.length === 0) return '';

  let usernames = `- Previous usernames:`;

  usernameArray.forEach((name) => {
    usernames = usernames + `\n  - ${name.username}`;
  });

  return usernames;
}
