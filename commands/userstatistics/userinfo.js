const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, MessageFlags, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
import('node-fetch'); // Ensure 'node-fetch' is imported properly

// Import helper functions for formatting and data processing
const {
      formatNumber, escapeUnderscores, countryCodeToEmoji,
      convertToTimeFormat, playtimeConvert, getEmojiOfAch,
      getEmojiOfRank, reformatTimestamp, calculateLevel,
      createLevelImage
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
    // Fetch user data from TETR.IO API using provided username/ID
    const user = await getUser(interaction.options.getString('user').toLowerCase()); // calls API only once

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

    // Fetch detailed user statistics and summary from TETR.IO API
    const response = await fetch(`https://ch.tetr.io/api/users/${user._id}`);
    const summaryRaw = await fetch(`https://ch.tetr.io/api/users/${user._id}/summaries`);

    const stats = await response.json();
    const summary = await summaryRaw.json();

    const statData = stats.data;
    const summaryData = summary.data;

    // Normalize arrays to avoid repeated Array.isArray checks
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

    // Get country flag emoji
    const country = countryCodeToEmoji(statData.country);

    // Helper to format games played/won/playtime for both general and bot pages
    function getGamesSummary(stats) {
      if (stats.gamesplayed >= 0) {
        return `- Played ${stats.gamesplayed} games` +
          (stats.gameswon >= 0 ? `\n  - Won ${gamesWonConvert(stats.gameswon, stats.gamesplayed)}` : '') +
          (stats.gametime >= 0 ? `\n  - Has ${Math.round((stats.gametime / 3600) * 10) / 10} hours of playtime` : '');
      }
      return '- Has hidden games played';
    }

    // Build the three main embed pages: Profile, General, Gameplay
    const pages = [
      // Profile page
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
${statData.supporter ? ` - Has supporter${starConvert(statData.supporter_tier)}${statData.bio ? `\n> -  ${statData.bio}` : ''}` : ''}${formatConnections(statData.connections)}
${formatOldUsernames(statData.oldusernames)}
  `)
        .setTimestamp(),

      // General stats page
      new EmbedBuilder()
        .setColor('#ff9d7d')
        .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
        .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
        .setDescription(`
### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}) -> Quick Look -> General__

- Has ${unlockedCount} achievements${medalLine}${statData.ar > 0 ? `\n  - Totalling ${statData.ar} Achievement Rating` : ''}${formatBadges(badges)} ${formatDisplayedAchs(statData.achievements, ach)}

${getGamesSummary(statData)}
  `)
        .setTimestamp(),

      // Gameplay stats page
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

    // Create navigation buttons for the embed pages using a map for scalability
    const buttonLabels = ['Profile', 'General', 'Gameplay'];
    const row = new ActionRowBuilder().addComponents(
      ...buttonLabels.map((label, idx) =>
        new ButtonBuilder()
          .setCustomId(`profilepage_${idx}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === 0)
      )
    );

    const pngBuffer = await createLevelImage(statData.xp);
    const levelFile = new AttachmentBuilder(pngBuffer, { name: "level.png" });

    // Send the first page as a reply, with navigation buttons
    await interaction.reply({ embeds: [pages[0]], components: [row], files: [levelFile] });

    // Store page data for this interaction (for navigation handling elsewhere)
    interaction.client.pageData = {
      [interaction.id]: {
        pages,
        currentPage: 0,
      },
    };
  },
};

// =====================
// Helper Functions Below
// =====================

// Converts games won to a string with win percentage
function gamesWonConvert(gamesWon, gamesPlayed) {
  if (gamesWon === 'Hidden' || gamesPlayed === 'Hidden' || gamesPlayed === 0) return gamesWon;
  return `${gamesWon} (${Math.round(10000 * (gamesWon / gamesPlayed)) / 100}%)`;
}

// Formats badge count for display
function formatBadges(badgelist) {
  const count = Array.isArray(badgelist) ? badgelist.length : 0;
  return count > 0 ? `\n  - As well as ${count} badges` : '';
}

// Formats games played, won, and playtime
function formatGamesPlayed(gamesplayed, gameswon, gamestime) {
  if (gamesplayed > -1) {
    return `\n### Games Played: ${gamesplayed}\n- Games Won: ${gamesWonConvert(gameswon, gamesplayed)}\n- Playtime: ${playtimeConvert(gamestime)}`;
  }
  return '';
}

// Returns supporter stars based on tier
function starConvert(supporterTier) {
  let s = '';
  for (let i = 1; i < supporterTier; i++) s = s.concat(` ${getEmoji('supporter_star')}`);
  return s;
}

// Formats achievement counts for legacy AR breakdown
function formatAchievementCounts(ar_counts) {
  const formattedList = [];
  const map = { 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'platinum', 5: 'diamond', t100: 't100', t50: 't50', t25: 't25', t10: 't10', t5: 't5', t3: 't3' };
  if (ar_counts[100]) formattedList.push(`${getEmojiOfAch('issued')} ${ar_counts[100]}`);
  for (const [key, name] of Object.entries(map)) if (ar_counts[key]) formattedList.push(`${getEmojiOfAch(name)} ${ar_counts[key]}`);
  return formattedList.length ? '\n  - ' + formattedList.join(', ') : '';
}

// Formats user connections (Discord, Twitch, etc.)
function formatConnections(connections) {
  const types = ['Discord', 'Twitch', 'Twitter', 'Reddit', 'Youtube', 'Steam'];
  const list = [];
  types.forEach((c) => {
    if (connections[c.toLowerCase()]) {
      const u = connections[c.toLowerCase()].display_username || connections[c.toLowerCase()].username;
      list.push(`  - ${c}: ${u}`);
    }
  });
  if (!list.length) return '';
  return `\n\n- ${list.length} connections\n` + list.join('\n');
}

// Formats league preview stats for gameplay page
function formatLeaguePreview(statistics, country) {
  const leagueStats = statistics['league'];
  let { gamesplayed: gp, gameswon: gw, glicko, rd, tr, gxe, rank, percentile_rank: estRank } = leagueStats;

  let progressToNextRank = (leagueStats.prev_at - leagueStats.standing) / (leagueStats.prev_at - leagueStats.next_at);
  let prevRank = leagueStats.prev_rank;
  let nextRank = leagueStats.next_rank;

  if (!nextRank && prevRank === 'x') { prevRank = 'x+'; nextRank = 'top'; }
  if (!prevRank && nextRank === 'd+') prevRank = 'd';

  prevRank = getEmojiOfRank(prevRank);
  nextRank = getEmojiOfRank(nextRank);

  let recordDisplay = Math.round(10000 * (gw / gp)) / 100;

  if (tr < 0) {
    if (leagueStats.gamesplayed === 0) recordDisplay = 0;
    tr = `${leagueStats.gamesplayed}/10 rating games`;
    progressToNextRank = leagueStats.gamesplayed / 10;
    prevRank = '';
    nextRank = getEmoji('rank_z');
  } else {
    tr = `${formatNumber(Math.round(tr * 100) / 100)} TR`;
  }

  let standing = '';
  if (rank != leagueStats.bestrank && gp !== 0 && leagueStats.bestRank) standing += `\n  - Has reached ${getEmojiOfRank(leagueStats.bestrank)}`;
  if (rd > 100) standing += `\n  - Probably around ${getEmojiOfRank(estRank)}`;
  if (leagueStats.standing > 0) standing += `\n  - Ranked #${leagueStats.standing} ${formatCountry(leagueStats.standing_local, country)}`;
  if (gp !== 0) standing += `\n    - Won ${gw}/${gp} games (${((gw / gp) * 100).toFixed(2)}%)\n    - ${leagueStats.vs || 'N/A'} VS score`;

  return `\n- ${getEmoji('league')} **${tr}**, ${getEmojiOfRank(rank)} ${standing}`;
}

// Formats 40 Lines mode stats
function format40Lines(statistics, country) {
  if (statistics['40l'].record) {
    const flStatistics = statistics['40l'];
    const results = flStatistics.record.results;
    return `\n- ${getEmoji('40lines')} **40 Lines in ${convertToTimeFormat(results.stats.finaltime)}**\n  - Ranked #${formatNumber(flStatistics.rank)} ${formatCountry(flStatistics.rank_local, country)}\n  - [Submitted ${reformatTimestamp(flStatistics.record.ts)}](https://tetr.io/#R:${flStatistics.record.replayid})\n  - ${Math.round(results.aggregatestats.pps * 100) / 100} PPS | ${formatNumber(results.stats.finesse.faults)} finesse faults`;
  }
  return '';
}

// Formats Blitz mode stats
function formatBlitz(statistics, country) {
  if (statistics['blitz'].record) {
    const blStatistics = statistics['blitz'];
    return `\n- ${getEmoji('blitz')} **${formatNumber(blStatistics.record.results.stats.score)} points in Blitz**\n  - Ranked #${formatNumber(blStatistics.rank)} ${formatCountry(blStatistics.rank_local, country)}\n  - [Submitted ${reformatTimestamp(blStatistics.record.ts)}](https://tetr.io/#R:${blStatistics.record.replayid})\n  - ${Math.round(blStatistics.record.results.aggregatestats.pps * 100) / 100} PPS | ${formatNumber(Math.round((blStatistics.record.results.stats.score / blStatistics.record.results.stats.piecesplaced) * 100) / 100)} Points/Piece`;
  }
  return '';
}

// Formats Zenith (Quick Play) stats
function formatZenith(statistics, country) {
  let text = '';
  const z = statistics['zenith'];
  if (z.record) {
    text = `\n- ${getEmoji('quickplay')} **${formatNumber(Math.round(z.record.results.stats.zenith.altitude * 100) / 100)}m in Quick Play**\n  - Ranked #${formatNumber(z.rank)} ${formatCountry(z.rank_local, country)}\n  - [Submitted ${reformatTimestamp(z.record.ts)}](https://tetr.io/#R:${z.record.replayid})\n  - ${Math.round(z.record.results.aggregatestats.pps * 100) / 100} PPS | ${Math.round(z.record.results.aggregatestats.apm * 100) / 100} APM\n  - Floor ${z.record.results.stats.zenith.floor} | ${z.record.results.stats.kills} KOs | Reached ${z.record.results.stats.topbtb} B2B`;
    if (statistics['zenith'].best.record) {
      text += `\n  - All-time best is ${formatNumber(Math.round(z.best.record.results.stats.zenith.altitude * 100) / 100)}m (#${formatNumber(z.best.rank)})`;
    }
  } else if (z.best.record) {
    text = `\n- ${getEmoji('quickplay')} Hasn't played Quick Play this week\n  - All-time best is ${formatNumber(Math.round(z.best.record.results.stats.zenith.altitude * 100) / 100)}m\n  - Ranked #${formatNumber(z.best.rank)}\n  - [Submitted ${reformatTimestamp(z.best.record.ts)}](https://tetr.io/#R:${z.best.record.replayid})`;
  }
  return text;
}

// Formats Zenith Expert stats
function formatZenithExpert(statistics, country) {
  let text = '';
  const z = statistics['zenithex'];
  if (z.record) {
    text = `\n- ${getEmoji('quickplayexpert')} **${formatNumber(Math.round(z.record.results.stats.zenith.altitude * 100) / 100)}m in Quick Play EXPERT**\n  - Ranked #${formatNumber(z.rank)} ${formatCountry(z.rank_local, country)}\n  - [Submitted ${reformatTimestamp(z.record.ts)}](https://tetr.io/#R:${z.record.replayid})\n  - ${Math.round(z.record.results.aggregatestats.pps * 100) / 100} PPS | ${Math.round(z.record.results.aggregatestats.apm * 100) / 100} APM\n  - Floor ${z.record.results.stats.zenith.floor} | ${z.record.results.stats.kills} KOs | Reached ${z.record.results.stats.topbtb} B2B`;
    if (statistics['zenith'].best.record) {
      text += `\n  - All-time best is ${formatNumber(Math.round(z.best.record.results.stats.zenith.altitude * 100) / 100)}m (#${formatNumber(z.best.rank)})`;
    }
  } else if (z.best.record) {
    text = `\n- ${getEmoji('quickplayexpert')} Hasn't played Quick Play EXPERT this week\n  - All-time best is ${formatNumber(Math.round(z.best.record.results.stats.zenith.altitude * 100) / 100)}m\n  - Ranked #${formatNumber(z.best.rank)}\n  - [Submitted ${reformatTimestamp(z.best.record.ts)}](https://tetr.io/#R:${z.best.record.replayid})`;
  }
  return text;
}

// Formats Zen mode stats
function formatZen(statistics) {
  if (statistics['zen']) {
    const z = statistics['zen'];
    return `\n- ${getEmoji('zen')} **Level ${z.level} in Zen**\n  - ${formatNumber(Math.round(z.score))} points`;
  }
  return '';
}

// Formats displayed achievements for the user
function formatDisplayedAchs(displayed = [], all = []) {
  const map = { 100: 'issued', 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'platinum', 5: 'diamond' };
  if (!Array.isArray(all) || !Array.isArray(displayed) || all.length === 0) return '';

  let out = '\n  - Displayed achievements:';

  all.forEach((a) => {
    const featured = displayed.includes(a.k);
    const unlocked = !a.stub && (a.rank === 100 || (typeof a.rank === 'number' && a.rank >= 1));
    if (!featured || !unlocked) return;

    const rankName = map[a.rank];
    if (!rankName) return;

    out += `\n    - ${getEmojiOfAch(rankName)}`;

    if (a.vt === 4) {
      out += ` **${a.name}** - **Floor ${Math.floor(a.a)}** (${formatNumber(Math.round(a.v * 100) / 100)}m) ${a.object || ''}`;
    } else if (a.rank !== 100) {
      // If value is negative, it's probably a time in ms (e.g., Sprint 40L)
      const prettyValue = a.v < 0
        ? convertToTimeFormat(Math.abs(a.v))     // -40597 -> "0:40.597"
        : formatNumber(Math.round(a.v));         // normal numbers stay formatted

      out += ` **${a.name}** - **${prettyValue}** ${a.object || ''}`;
    } else if (a.vt === 5) {
      out += ` **${a.name}** - Obtained ${reformatTimestamp(-a.v)} ${a.object || ''}`;
    } else if (a.vt === 6) {
      out += ` **${a.name}** - ${formatNumber(-Math.round(a.v))} ${a.object || ''}`;
    }

    if (a.rank === 100) {
      out += ` (Issue ${a.pos}/${a.total})`;
    } else if (a.total > 0) {
      if (a.pos < 100) out += ` (**#${a.pos + 1}**)`;
      else if (a.pos / a.total < 0.01) out += ` (Top ${Math.round((a.pos / a.total) * 100000) / 1000}%)`;
      else out += ` (Top ${Math.round((a.pos / a.total) * 10000) / 100}%)`;
    }

    const ally = a.x && a.x.ally;
    if (ally && ally.username) out += ` (With [${ally.username.toUpperCase()}](https://ch.tetr.io/u/${ally.username}))`;
  });

  return out !== '\n  - Displayed achievements:' ? out : '';
}

// Formats country and local rank for display
function formatCountry(localRank, country) {
  if (localRank > 0) return `(#${formatNumber(localRank)} ${country})`;
  return '';
}

// Formats previous usernames for display
function formatOldUsernames(usernameArray) {
  if (!Array.isArray(usernameArray) || usernameArray.length === 0) return '';
  let s = `- Previous usernames:`;
  usernameArray.forEach((n) => (s += `\n  - ${n.username}`));
  return s;
}
