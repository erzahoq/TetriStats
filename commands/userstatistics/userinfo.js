const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
import('node-fetch'); // Ensure 'node-fetch' is imported properly

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('Get detailed information about a specific user via their TETR.IO (or Discord) username/ID.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('tetrio')
                .setDescription('Get detailed information about a specific user via their TETR.IO username/ID.')
                .addStringOption((option) =>
                    option
                        .setName('user')
                        .setDescription('the username/ID to search for')
                        .setRequired(true),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('discord')
                .setDescription('Get info about a specific user via their Discord, the user must have linked their Discord to TETR.IO')
                .addUserOption((option) =>
                    option
                        .setName('user')
                        .setDescription('the discord user to search for')
                        .setRequired(true),
                ),
        ),

    async execute(interaction) {
        let stats, summary;

        // Fetch the account with either discord or tetrio
        if (interaction.options.getSubcommand() === 'tetrio') {
            const user = interaction.options.getString('user').toLowerCase();

            const response = await fetch(`https://ch.tetr.io/api/users/${user}`);
            stats = await response.json();

            if (!stats.success) {
                if (stats.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
                    return await interaction.reply({
                        content: 'No such user! Either you mistyped something, or this user no longer exists.',
                        ephemeral: true
                    });
                } else {
                    return await interaction.reply({
                        content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                        ephemeral: true
                    });
                }
            }

            const summaryRaw = await fetch(`https://ch.tetr.io/api/users/${user}/summaries`);
            summary = await summaryRaw.json();

        } else if (interaction.options.getSubcommand() === 'discord') {
            const user = interaction.options.getUser('user');

            let response = await fetch(`https://ch.tetr.io/api/users/search/discord:${user.id}`);
            stats = await response.json();

            if (stats.data === null) {
                return await interaction.reply({
                    content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                    ephemeral: true
                });
            }

            if (!stats.success) {
                return await interaction.reply({
                    content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    ephemeral: true
                });
            }

            const tetrioID = stats.data.user._id

            response = await fetch(`https://ch.tetr.io/api/users/${tetrioID}`);
            const summaryRaw = await fetch(`https://ch.tetr.io/api/users/${tetrioID}/summaries`);

            stats = await response.json();
            summary = await summaryRaw.json();
        }

        const statData = stats.data;
        const summaryData = summary.data;
        const badgeArray = statData.badges.map(badge => badge.id); // ??? some magic badge thing erz pls explain

        if (statData.role === 'anon') {
            const embed = new EmbedBuilder()
                .setColor("#80bdff")
                .setThumbnail("https://tetr.io/res/avatar.png")
                .setDescription(`
# ANONYMOUS
${statData.username.toUpperCase()} is **anonymous**, which means they have no statistics, and cannot save replays. There's nothing that can be shown.`) // that's not true but TETR.IO doesn't show so we probably shouldn't either
        
            return await interaction.reply({
                embeds: [embed]
            })
        }
        if (statData.role === 'bot') {
            const embed = new EmbedBuilder()
                .setColor("#80bdff")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setFooter({ text: `User ID: ${statData._id}` })
                .setDescription(`
# BOT
This user is a **BOT**, owned by ${statData.botmaster.toLowerCase()}. Their records are not available, but some general information can be shown.

### __[${escapeUnderscores(statData.username).toUpperCase()}](https://ch.tetr.io/u/${statData.username}) -> Quick Look__

- About:
  - Account created ${reformatTimestamp(statData.ts)}
  - Level ${formatNumber(Math.floor(calculateLevel(statData.xp)))} (${formatNumber(Math.floor(statData.xp))} XP)
  - Has ${statData.friend_count} friends
  
  ${gamesPlayedConvert(statData.gamesplayed, statData.gameswon, statData.gametime)}`)
            return await interaction.reply({
                embeds: [embed]
            })
        }
        
        const country = countryCodeToEmoji(statData.country);

        // big wall embeds, functions are split up inside them though so click those
        // i love function spam
        const pages = [
            new EmbedBuilder()
                .setColor("#80bdff")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
                .setDescription(`
### __[${escapeUnderscores(statData.username).toUpperCase()}](https://ch.tetr.io/u/${statData.username}) -> Quick Look__

- About:
  - Account created ${reformatTimestamp(statData.ts)}
  - Level ${formatNumber(Math.floor(calculateLevel(statData.xp)))} (${formatNumber(Math.floor(statData.xp))} XP)
  - ${country}
  - Has ${statData.friend_count} friends
  - ${statData.supporter ? `Has supporter${starConvert(statData.supporter_tier)}${statData.bio ? `\n> -  ${statData.bio}` : ""}` : ""}${connectionsConvert(statData.connections)}
  `)
                .setTimestamp(),

                new EmbedBuilder()
                .setColor("#ff9d7d")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
                .setDescription(`
### __[${escapeUnderscores(statData.username).toUpperCase()}](https://ch.tetr.io/u/${statData.username}) -> Quick Look -> General__

- Has ${countAchievements(statData.ar_counts)} achievements ${achievementCountsConvert(statData.ar_counts)} ${statData.ar > 0 ? `\n  - Totalling ${statData.ar} Achievement Rating` : ""} ${badgesConvert(badgeArray)} ${displayedAchesConvert(statData.achievements, summaryData.achievements)}

${statData.gamesplayed >= 0 ? `- Played ${statData.gamesplayed} games${statData.gameswon >= 0 ? `\n  - Won ${statData.gameswon} of them (${Math.round(10000 * (statData.gameswon / statData.gamesplayed)) / 100}%)` : ""}${statData.gametime >= 0 ? `\n  - Has ${Math.round(secondsToHours(statData.gametime) * 10) / 10} hours of playtime` : ""}` : "- Has hidden games played"}
  `)
                .setTimestamp(),

            new EmbedBuilder()
                .setColor("#ff7dc0")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
                .setDescription(`
### __[${escapeUnderscores(statData.username.toUpperCase())}](https://ch.tetr.io/u/${statData.username}) -> Quick Look -> Gameplay__
${formatLeaguePreview(summaryData, country)} ${formatZenith(summaryData, country)} ${formatZenithExpert(summaryData, country)} ${format40Lines(summaryData, country)} ${formatBlitz(summaryData, country)} ${formatZen(summaryData)}
`)
//                 .setDescription(`
// ## Records:
// ${formatZenith(summaryData, country)}${formatZenithExpert(summaryData, country)}${format40Lines(summaryData, country)}${formatBlitz(summaryData, country)}${formatZen(summaryData)}
//                     `)
                .setTimestamp()
        ];

        // Initial row of buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('profilepage_0')
                .setLabel('Profile')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true), // Disable the first button initially
            new ButtonBuilder()
                .setCustomId('profilepage_1')
                .setLabel('General')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('profilepage_2')
                .setLabel('Gameplay')
                .setStyle(ButtonStyle.Primary)
        );

        // Send the initial message with the first page and buttons
        await interaction.reply({
            embeds: [pages[0]],
            components: [row]
        });

        // Attach pages to the interaction for future reference
        interaction.client.pageData = {
            [interaction.id]: {
                pages,
                currentPage: 0
            }
        };
    }
};

// most of these functions are self-explainatory

function gamesWonConvert(gamesWon, gamesPlayed) {
    if (gamesWon === 'Hidden' || gamesPlayed === 'Hidden' || gamesPlayed === 0) {
        return gamesWon;
    }

    return `${gamesWon} (${Math.round(10000 * (gamesWon / gamesPlayed)) / 100}%)`
}

function badgesConvert(badgelist) {
    if (badgelist.length > 0) {
        return `\n  - As well as ${badgelist.length} badges`
    } else {
        return ``
    }
}

function convertToTimeFormat(inputSeconds) {
    const totalSeconds = inputSeconds / 1000
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(3); // Keep milliseconds as part of seconds

    // Format seconds to ensure two digits before decimal
    const [intSeconds, fracSeconds] = seconds.split('.');
    const formattedSeconds = intSeconds.padStart(2, '0') + '.' + (fracSeconds || '000').padEnd(3, '0');

    return `${minutes}:${formattedSeconds}`;
}

function playtimeConvert(playtime) {
    if (playtime === 'Hidden') {
        return playtime;
    } 
    return `${Math.round(secondsToHours(playtime) * 10) / 10} Hours`
}

function gamesPlayedConvert(gamesplayed, gameswon, gamestime) {
    if (gamesplayed > -1) {
        return `\n### Games Played: ${gamesplayed}
- Games Won: ${gamesWonConvert(gameswon, gamesplayed)}
- Playtime: ${playtimeConvert(gamestime)}`
    } else {
        return ""
    }
}

function starConvert(supporterTier) {
    let supporterString = '';

    for (let i = 1; i < supporterTier; i++) { // add stars because those exist
        supporterString = supporterString.concat(" <:supporter_star:1277300953111855231>")

    }
    return (`${supporterString}`)
}

function getEmojiOfAch(name) {
    //mapping of emoji names to their IDs
    const achEmojis = {
        "ach_issued": "1277286439205339146",
        "ach_bronze": "1277286431949328455",
        "ach_silver": "1277286422935764992",
        "ach_gold": "1277286414664339508",
        "ach_platinum": "1277286402773483603",
        "ach_diamond": "1277286389146321017",
        "ach_t5": "1277286374600478785",
        "ach_t100": "1277286366719381650",
        "ach_t50": "1277286359777935432",
        "ach_t25": "1277286349208293466",
        "ach_t10": "1277286339527577730",
        "ach_t3": "1277286318824620042"
    }
    return `<:ach_${name}:${achEmojis["ach_" + name]}>`
}

function countAchievements(ar_counts) {
    // Initialize an array to store the formatted achievements
    const formattedList = [];

    // Mapping of keys to their corresponding names
    const achievementMapping = {
        1: 'bronze',
        2: 'silver',
        3: 'gold',
        4: 'platinum',
        5: 'diamond',
        t100: 't100',
        t50: 't50',
        t25: 't25',
        t10: 't10',
        t5: 't5',
        t3: 't3'
    };

    var count = 0;

    // Loop through the rest of the achievements (excluding issued)
    for (const [key, _name] of Object.entries(achievementMapping)) {
        // Check if the achievement exists in the ar_counts object
        if (ar_counts[key]) {
            count += ar_counts[key];
        }
    }

    return count;
}

function achievementCountsConvert(ar_counts) {
    // Initialize an array to store the formatted achievements
    const formattedList = [];

    // Mapping of keys to their corresponding names
    const achievementMapping = {
        1: 'bronze',
        2: 'silver',
        3: 'gold',
        4: 'platinum',
        5: 'diamond',
        t100: 't100',
        t50: 't50',
        t25: 't25',
        t10: 't10',
        t5: 't5',
        t3: 't3'
    };

    // Check if issued achievement exists and add it to the start of the list
    if (ar_counts[100]) {
        formattedList.push(`${getEmojiOfAch('issued')} ${ar_counts[100]}`);
    }

    // Loop through the rest of the achievements (excluding issued)
    for (const [key, name] of Object.entries(achievementMapping)) {
        // Check if the achievement exists in the ar_counts object
        if (ar_counts[key]) {
            // Push the formatted string to the list with the count
            formattedList.push(`${getEmojiOfAch(name)} ${ar_counts[key]}`);
        }
    }

    // If the formatted list is empty, return an empty string
    if (formattedList.length === 0) {
        return '';
    }

    // Join the list items with pipes (|) and return the formatted string
    return "\n  - " + formattedList.join(', ');
}

function connectionsConvert(connections) {
    // List of possible connections and their keys
    const connectionTypes = ['Discord', 'Twitch', 'Twitter', 'Reddit', 'Youtube', 'Steam'];

    // Initialize an array to store formatted connection - username pairs
    const formattedList = [];

    // Loop through each connection type
    connectionTypes.forEach(connection => {
        // Check if the connection exists in the user's connections
        if (connections[connection.toLowerCase()]) {
            // Extract the connection's display_username or username
            const username = connections[connection.toLowerCase()].display_username || connections[connection.toLowerCase()].username;
            // Push the formatted string to the list
            formattedList.push(`  - ${connection}: ${username}`);
        }
    });

    if (formattedList.length === 0) {
        return ''
    }

    // Join the list items with new lines and return the formatted string
    return `\n\n- ${formattedList.length} connections\n` + formattedList.join('\n');
}

function reformatTimestamp(isoString) {
    if (!isoString) {
        return "Before account creation was tracked"
    }

    // Create a Date object from the ISO string
    const date = new Date(isoString);

    // Return the Unix timestamp by dividing the milliseconds by 1000
    return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// this is such a function (and it's only used once lmao)
function secondsToHours(seconds) {
    const secondsPerHour = 60 * 60;
    return seconds / secondsPerHour;
}

// Convert country code to flag emoji
function countryCodeToEmoji(countryCode) {
    if (countryCode === 'XM') return ("<:flag_xm:1310891739078328374>");
    if (!countryCode) return ("❔"); //if a country isn't set i guess
    const codePoints = countryCode
        .toUpperCase() // Make sure the code is uppercase
        .split('')     // Split the letters
        .map(char => 127397 + char.charCodeAt()); // Convert to regional indicator symbol

    return String.fromCodePoint(...codePoints);
}

// a magic formula stolen from somewhere online
function calculateLevel(xp) {
    return ((xp / 500) ** 0.6) + (xp / (5000 + ((Math.max(0, xp - (4 * 10 ** 6))) / 5000))) + 1
}

//small and cute league function (will purr at you if it gets the chance)
function formatLeaguePreview(statistics, country) {
    const leagueStats = statistics['league']

    // lots of vars
    let gamesPlayed = leagueStats.gamesplayed;
    let gamesWon = leagueStats.gameswon;
    let glicko = leagueStats.glicko;
    let ratingDeviation = leagueStats.rd;
    let rating = leagueStats.tr;
    let glixaire = leagueStats.gxe;
    let rank = leagueStats.rank;
    let estRank = leagueStats.percentile_rank;

    let rankBoolean = true;

    let progressToNextRank = (leagueStats.prev_at - leagueStats.standing) / (leagueStats.prev_at - leagueStats.next_at)

    let prevRank = leagueStats.prev_rank;
    let nextRank = leagueStats.next_rank;

    if (!nextRank && prevRank === 'x') {
        prevRank = 'x+'
        nextRank = 'top'
    }

    if (!prevRank && nextRank === 'd+') {
        prevRank = "d"
    }

    prevRank = getEmojiOfRank(prevRank);
    nextRank = getEmojiOfRank(nextRank);

    let recordDisplay = Math.round(10000 * (gamesWon / gamesPlayed)) / 100;

    // TR display stuff
    if (rating < 0) {
        if (leagueStats.gamesplayed === 0) {
            recordDisplay = 0;
        }
        rating = `${leagueStats.gamesplayed}/10 rating games`
        progressToNextRank = leagueStats.gamesplayed / 10
        prevRank = '';
        nextRank = '<:rank_z:1277382169538461746>';

        rankBoolean = "yesnt"; // so true
    }
    else {
        rating = `${formatNumber(Math.round(rating * 100) / 100)} TR`
    }

    if (ratingDeviation > 100 && rankBoolean != "yesnt") {
        rankBoolean = false;
    } 

    let standing = ""

    if (rank != leagueStats.bestrank && gamesPlayed !== 0 && leagueStats.bestRank) {
        standing += `
  - Has reached ${getEmojiOfRank(leagueStats.bestrank)}`
    }

    if (ratingDeviation > 100) {
        standing += `
  - Probably around ${getEmojiOfRank(estRank)}`
    }
    if (leagueStats.standing > 0 ) {
        standing += `
  - Ranked #${leagueStats.standing} ${formatCountry(leagueStats.standing_local, country)}`
    }

    if (gamesPlayed !== 0)  {
        standing += `
    - Won ${gamesWon}/${gamesPlayed} games (${((gamesWon/gamesPlayed)*100).toFixed(2)}%)
    - ${leagueStats.vs || "N/A"} VS score`
    }

    return `
- <:league:1352045247512842251> **${rating}**, ${getEmojiOfRank(rank)} ${standing}`
}

function format40Lines(statistics, country) {
    if (statistics['40l'].record) {
        let flStatistics = statistics['40l'];
        let results = flStatistics.record.results;
        return `
- <:40lines:1277298516380614786> **40 Lines in ${convertToTimeFormat(results.stats.finaltime)}**
  - Ranked #${formatNumber(flStatistics.rank)} ${formatCountry(flStatistics.rank_local, country)}
  - [Submitted ${reformatTimestamp(flStatistics.record.ts)}](https://tetr.io/#R:${flStatistics.record.replayid})
  - ${Math.round(results.aggregatestats.pps * 100) / 100} PPS | ${formatNumber(results.stats.finesse.faults)} finesse faults`
    } else {
        return ""
    }
}

function formatBlitz(statistics, country) {
    if (statistics['blitz'].record) {
        let blStatistics = statistics['blitz'];
        return `
- <:blitz:1277298507920838718> **${formatNumber(blStatistics.record.results.stats.score)} points in Blitz**
  - Ranked #${formatNumber(blStatistics.rank)} ${formatCountry(blStatistics.rank_local, country)}
  - [Submitted ${reformatTimestamp(blStatistics.record.ts)}](https://tetr.io/#R:${blStatistics.record.replayid})
  - ${Math.round(blStatistics.record.results.aggregatestats.pps * 100) / 100} PPS | ${formatNumber(Math.round(blStatistics.record.results.stats.score/blStatistics.record.results.stats.piecesplaced*100)/100)} Points/Piece`
    } else {
        return ""
    }
}

function formatZenith(statistics, country) {
    let zenithText = ''
    let zStatistics = statistics['zenith'];

    if (statistics['zenith'].record) {
        zenithText = `
- <:quickplay:1277296551428886588> **${formatNumber(Math.round(zStatistics.record.results.stats.zenith.altitude * 100) / 100)}m in Quick Play**
  - Ranked #${formatNumber(zStatistics.rank)} ${formatCountry(zStatistics.rank_local, country)}
  - [Submitted ${reformatTimestamp(zStatistics.record.ts)}](https://tetr.io/#R:${zStatistics.record.replayid})
  - ${Math.round(zStatistics.record.results.aggregatestats.pps * 100) / 100} PPS | ${Math.round(zStatistics.record.results.aggregatestats.apm * 100) / 100} APM
  - Floor ${zStatistics.record.results.stats.zenith.floor} | ${zStatistics.record.results.stats.kills} KOs | Reached ${zStatistics.record.results.stats.topbtb} B2B`
        if (statistics['zenith'].best.record) {
            zenithText += `
  - All-time best is ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100)}m (#${formatNumber(zStatistics.best.rank)})`
        }
    }
    else if (statistics['zenith'].best.record) {
        zenithText = `
- <:quickplay:1277296551428886588> Hasn't played Quick Play this week
  - All-time best is ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100)}m
  - Ranked #${formatNumber(zStatistics.best.rank)}
  - [Submitted ${reformatTimestamp(zStatistics.best.record.ts)}](https://tetr.io/#R:${zStatistics.best.record.replayid})`
        // zenithText = `\n- All-Time Best: ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100)}m (#${formatNumber(zStatistics.best.rank)})`
    }

    return zenithText;

}

function formatZenithExpert(statistics, country) {
    let zenithText = ''
    let zStatistics = statistics['zenithex'];

    if (statistics['zenithex'].record) {
        zenithText = `
- <:quickplayexpert:1277351744413896724> **${formatNumber(Math.round(zStatistics.record.results.stats.zenith.altitude * 100) / 100)}m in Quick Play EXPERT**
  - Ranked #${formatNumber(zStatistics.rank)} ${formatCountry(zStatistics.rank_local, country)}
  - [Submitted ${reformatTimestamp(zStatistics.record.ts)}](https://tetr.io/#R:${zStatistics.record.replayid})
  - ${Math.round(zStatistics.record.results.aggregatestats.pps * 100) / 100} PPS, ${Math.round(zStatistics.record.results.aggregatestats.apm * 100) / 100} APM
  - Floor ${zStatistics.record.results.stats.zenith.floor}
  - ${zStatistics.record.results.stats.kills} KOs
  - Reached ${zStatistics.record.results.stats.topbtb} B2B`
        if (statistics['zenithex'].best.record) {
            zenithText += `
  - All-time best is ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100)}m (#${formatNumber(zStatistics.best.rank)})`
        }
    }
    else if (statistics['zenithex'].best.record) {
        zenithText = `
- <:quickplayexpert:1277351744413896724> Hasn't played Quick Play EXPERT this week
  - All-time best is ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100)}m
  - Ranked #${formatNumber(zStatistics.best.rank)}
  - [Submitted ${reformatTimestamp(zStatistics.best.record.ts)}](https://tetr.io/#R:${zStatistics.best.record.replayid})`
        // zenithText = `\n- All-Time Best: ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100)}m (#${formatNumber(zStatistics.best.rank)})`
    }

    return zenithText;
}

function formatZen(statistics) {
    if (statistics['zen']) {
        let zenStatistics = statistics['zen'];
        return `
- <:zen:1277364107883974676> **Level ${zenStatistics.level} in Zen**
  - ${formatNumber(Math.round(zenStatistics.score))} points`
    } else {
        return ""
    }
}

//i nuked massive comment
//im sure its completely fine :3

function getEmojiOfRank(rank) {
    if (!rank) {
        return;
    }

    const rankEmojis = {
        "rank_xplus": "1277293685058310288",
        "rank_x": "1277293677873463368",
        "rank_u": "1277293667891286046",
        "rank_ss": "1277293658403770388",
        "rank_splus": "1277293647225819196",
        "rank_s": "1277293636928933888",
        "rank_sminus": "1277293624157278228",
        "rank_aplus": "1277293615114358997",
        "rank_a": "1277293607648231527",
        "rank_aminus": "1277293600438227106",
        "rank_bplus": "1277293592511250553",
        "rank_b": "1277293576895856751",
        "rank_bminus": "1277293566284267581",
        "rank_cplus": "1277293553147449505",
        "rank_c": "1277293540547756115",
        "rank_cminus": "1277293530095685745",
        "rank_dplus": "1277293513616265216",
        "rank_d": "1277293312696516690",
        "rank_z": "1277382169538461746",
        "rank_top": "1278185429656670269"
    }
    let formattedRank = 'rank_' + rank.toLowerCase().replace("+", "plus").replace("-", "minus");
    return `<:${formattedRank}:${rankEmojis[formattedRank]}>`
}


function displayedAchesConvert(displayed, all) {
    const achievementMapping = {
        100: 'issued',
        1: 'bronze',
        2: 'silver',
        3: 'gold',
        4: 'platinum',
        5: 'diamond'
    };

    let displayCase = "\n  - Displayed achievements:"

    // loop thru each displayed ach
    all.forEach(achievement => {
        if (displayed.includes(achievement['k'])) {
            displayCase += `\n    - ` + getEmojiOfAch(achievementMapping[achievement['rank']])

            //wehhhhhhh
            // funny formatting
            if (achievement.vt === 4) {
                displayCase += ` **${achievement['name']}** - **Floor ${Math.floor(achievement.a)}** (${formatNumber(Math.round((achievement.v) * 100) / 100)}m) ${achievement.object}`
            } else {
                if (achievement['rank'] !== 100) { // if it isn't issued
                    displayCase += ` **${achievement['name']}** - **${formatNumber(Math.round(achievement.v))}** ${achievement.object}`

                } else if (achievement.vt === 5) displayCase += ` **${achievement['name']}** - Obtained ${reformatTimestamp(-achievement.v)} ${achievement.object}` //if it is issued show the time
                else if (achievement.vt === 6) displayCase += ` **${achievement['name']}** - ${formatNumber(-Math.round(achievement.v))} ${achievement.object}` // if its some stupid achievement that isnt accounted for then just do this i guess??
            }

            if (achievement['rank'] === 100) { // if it's issued
                displayCase += ` (Issue ${achievement['pos']}/${achievement['total']})` 
            } else {
                if (achievement['pos'] < 100) { // if you're in the top 100 players
                    displayCase += ` (**#${achievement['pos'] + 1}**)`
                }
                else if (achievement['pos'] / achievement['total'] < 0.01) { // if you're in the top 1%
                    displayCase += ` (Top ${Math.round(achievement['pos'] / achievement['total'] * 100000) / 1000}%)` // literally just one extra point of precision
                } 
                else { // everything else
                    displayCase += ` (Top ${Math.round(achievement['pos'] / achievement['total'] * 10000) / 100}%)`
                }
            }

            if (achievement['x'] && !isEmpty(achievement['x'])) {

                displayCase += ` (With [${achievement['x'].ally.username.toUpperCase()}](https://ch.tetr.io/u/${achievement['x'].ally.username}))`
            }
        }
    })
    // make sure the display isn't nothing
    if (displayCase != "\n  - Displayed achievements:") return displayCase;
    return "";
}

function escapeUnderscores(input) {
    const underscoreCount = (input.match(/_/g) || []).length;
    
    // Only escape if the count is a multiple of 2
    if (underscoreCount % 2 === 0 && underscoreCount > 0) {
        return input.replace(/_/g, '\\_');
    }
    
    return input;
}

function formatCountry(localRank, country) {
    if (localRank > 0) return `(#${formatNumber(localRank)} ${country})`
    else return "" 
}

    

function reformatTimestamp(isoString) {
    if (!isoString) {
        return "Before account creation was tracked"
    }

    // Create a Date object from the ISO string
    const date = new Date(isoString);

    // Return the Unix timestamp by dividing the milliseconds by 1000
    return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

function isEmpty(obj) {
    for (const prop in obj) {
      if (Object.hasOwn(obj, prop)) {
        return false;
      }
    }
  
    return true;
  }