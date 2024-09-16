const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
import('node-fetch'); // Ensure 'node-fetch' is imported properly

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user-info')
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
        const country = countryCodeToEmoji(statData.country);
        const badgeArray = statData.badges.map(badge => badge.id); // ??? some magic badge thing erz pls explain

        // big wall embeds, functions are split up inside them though so click those
        const pages = [
            new EmbedBuilder()
                .setColor("#80bdff")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setTitle(`${capitalizeFirstLetter(escapeUnderscores(statData.username))}'s Profile:`)
                .setURL(`https://ch.tetr.io/u/${statData.username}`)
                .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
                .setDescription(`
## General Information

${statData.bio || ""}

Account Creation: ${reformatTimestamp(statData.ts)}
Level ${formatNumber(Math.round(calculateLevel(statData.xp)))} (${formatNumber(Math.round(statData.xp))} XP)
Country: ${country}
Friends: ${statData.friend_count}
${supporterConvert(statData.supporter, statData.supporter_tier)}
Achievement Rating: ${statData.ar}${badgesConvert(badgeArray)}${achievementCountsConvert(statData.ar_counts)}${displayedAchesConvert(statData.achievements, summaryData.achievements)}${gamesPlayedConvert(statData.gamesplayed, statData.gameswon, statData.gametime)}

${connectionsConvert(statData.connections)}
                    `)
                .setTimestamp(),
            new EmbedBuilder()
                .setColor("#ff7dc0")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setTitle(`${capitalizeFirstLetter(escapeUnderscores(statData.username))}'s Profile:`)
                .setURL(`https://ch.tetr.io/u/${statData.username}`)
                .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
                .setDescription(`
## Records:
${formatZenith(summaryData, country)}${formatZenithExpert(summaryData, country)}${format40Lines(summaryData, country)}${formatBlitz(summaryData, country)}${formatZen(summaryData)}
                    `)
                .setTimestamp(),
            new EmbedBuilder()
                .setColor("#ff9d7d")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setTitle(`${capitalizeFirstLetter(escapeUnderscores(statData.username))}'s Profile:`)
                .setURL(`https://ch.tetr.io/u/${statData.username}`)
                .setFooter({ text: `User ID: ${statData._id} | Role: ${statData.role}` })
                .setDescription(`${formatLeague(summaryData, country)}`)
        ];

        // Initial row of buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('profilepage_0')
                .setLabel('General')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true), // Disable the first button initially
            new ButtonBuilder()
                .setCustomId('profilepage_1')
                .setLabel('Records')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('profilepage_2')
                .setLabel('Tetra League')
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
        return ` | **Badges**: ${badgelist.length}`
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

function supporterConvert(supporter, supporterTier) {
    if (supporter) {
        let supporterString = '';

        for (let i = 1; i < supporterTier; i++) { // add stars because those exist
            supporterString = supporterString.concat(" <:supporter_star:1277300953111855231>")

        }
        return (`Supporter ${supporterString}\n`)
    } else {
        return ""
    }
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
    return "\n" + formattedList.join(' | ');
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
            formattedList.push(`${connection} - ${username}`);
        }
    });

    if (formattedList.length === 0) {
        return ''
    }

    // Join the list items with new lines and return the formatted string
    return "__**Connections:**__ \n" + formattedList.join('\n');
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

function format40Lines(statistics, country) {
    if (statistics['40l'].record) {
        let flStatistics = statistics['40l'];
        return `\n### <:40lines:1277298516380614786> 40 Lines:
- PB: ${convertToTimeFormat(flStatistics.record.results.stats.finaltime)}s (${Math.round(flStatistics.record.results.aggregatestats.pps * 100) / 100} PPS)
- Rank: #${formatNumber(flStatistics.rank)} (#${formatNumber(flStatistics.rank_local)} ${country})`
    } else {
        return ""
    }
}

function formatBlitz(statistics, country) {
    if (statistics['blitz'].record) {
        let blStatistics = statistics['blitz'];
        return `\n### <:blitz:1277298507920838718> Blitz:
- PB: ${formatNumber(blStatistics.record.results.stats.score)} (${Math.round(blStatistics.record.results.aggregatestats.pps * 100) / 100} PPS)
- Rank: #${formatNumber(blStatistics.rank)} (#${formatNumber(blStatistics.rank_local)} ${country})`
    } else {
        return ""
    }
}

function formatZenith(statistics, country) {
    let zenithText = ''
    let zStatistics = statistics['zenith'];

    if (statistics['zenith'].record) {
        zenithText += `\n- PB: ${formatNumber(Math.round(zStatistics.record.results.stats.zenith.altitude * 100) / 100)}m
- #${formatNumber(zStatistics.rank)} (#${formatNumber(zStatistics.rank_local)} ${country})`
    }
    if (statistics['zenith'].best.record) {
        zenithText += `\n- All-Time Best: ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100)}m (#${formatNumber(zStatistics.best.rank)})`
    }

    if (zenithText.length > 0) {
        zenithText = `\n### <:quickplay:1277296551428886588> Quick Play:` + zenithText
    }

    return zenithText;

}

function formatZenithExpert(statistics, country) {
    let zenithText = ''
    let zStatistics = statistics['zenithex'];

    if (statistics['zenithex'].record) {
        zenithText += `\n- PB: ${formatNumber(Math.round(zStatistics.record.results.stats.zenith.altitude * 100) / 100)}m
- #${formatNumber(zStatistics.rank)} (#${formatNumber(zStatistics.rank_local)} ${country})`
    }
    if (statistics['zenithex'].best.record) {
        zenithText += `\n- All-Time Best: ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude * 100) / 100)}m (#${formatNumber(zStatistics.best.rank)})`
    }

    if (zenithText.length > 0) {
        zenithText = `\n### <:quickplayexpert:1277351744413896724> Expert Quick Play:` + zenithText
    }

    return zenithText;
}

function formatZen(statistics) {
    if (statistics['zen']) {
        let zenStatistics = statistics['zen'];
        return `\n### <:zen:1277364107883974676> Zen:
- Level ${zenStatistics.level} (${formatNumber(Math.round(zenStatistics.score))})`
    } else {
        return ""
    }
}

function formatLeague(statistics, country) {
    const leagueStats = statistics['league']

    // lots of vars
    let gamesPlayed = leagueStats.gamesplayed;
    let gamesWon = leagueStats.gameswon;
    let glicko = leagueStats.glicko;
    let ratingDeviation = leagueStats.rd;
    let rating = leagueStats.tr;
    let glixaire = leagueStats.gxe;
    let rank = leagueStats.rank;


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

    let glixaireDisplay = "";

    let recordDisplay = Math.round(10000 * (gamesWon / gamesPlayed)) / 100;

    if (glixaire !== -1) {
        glixaireDisplay = `Win Odds: ${Math.round(glixaire * 100) / 100}%\n`
    }

    // TR display stuff
    if (rating < 0) {
        if (leagueStats.gamesplayed === 0) {
            recordDisplay = 0;
        }
        rating = `${leagueStats.gamesplayed}/10 Rating Games Played`
        progressToNextRank = leagueStats.gamesplayed / 10
        prevRank = '';
        nextRank = '<:rank_z:1277382169538461746>';

        rankBoolean = "yesnt"; // so true
    } else if (ratingDeviation > 100) {
        rating = `Unranked`;
        rankBoolean = false;
    } else {
        rating = `${(Math.round(rating * 100)) / 100} TR`
    }

    return `# <:league:1277378168717840497> Tetra League:
# ${getEmojiOfRank(rank)} ${formatNumber(rating)}${formatLeagueStanding(leagueStats.standing, leagueStats.standing_local, glicko, ratingDeviation, country)}
**Record: ${gamesWon}/${gamesPlayed}** (${recordDisplay}%)
${glixaireDisplay}
Attack Per Minute: ${leagueStats.apm || 0}
Pieces Per Second: ${leagueStats.pps || 0}
Versus Score: ${leagueStats.vs || 0}${generateProgressBar(rankBoolean, progressToNextRank, prevRank, nextRank)}`
}

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


function formatLeagueStanding(standing, localStanding, glicko, ratingDeviation, country) {
    if (standing > 0) {
        return `\n**\\\#${formatNumber(standing)}** (#${formatNumber(localStanding)} ${country})
**Glicko: ${formatNumber((Math.round(glicko * 100)) / 100)} ± ${(Math.round(ratingDeviation * 100)) / 100}**`
    } else {
        return ''
    }
}

function generateProgressBar(generateBar, progress, symbolA, symbolB, length = 14) {
    if (!generateBar) {
        return '';
    }

    let startSymbol = "<:bar_start:1277463580513669160>"
    let endSymbol = "<:bar_end:1277463565036683264>"

    if (generateBar === "yesnt") { // this is when there's no rank
        startSymbol = "<:bar_start_rankless:1277779429199712317>"
    }

    // Ensure the progress is within the 0-1 range
    progress = Math.max(0, Math.min(progress, 1));
    if (progress === 1) { // this is for when the player is #1 in the world (wow)
        endSymbol = "<:bar_end_full:1278896013502976000>"
    }

    // Calculate the position of the "!" marker
    const position = Math.round(progress * length);

    // Generate the progress bar
    const bar = Array.from({ length: length }, (_, i) => (i === position ? "<:bar_half:1277463557016916010>" : (i < position ? "<:bar_full:1277463587249586269>" : "<:bar_empty:1277463572863254589>"))).join("");

    // Return the complete progress bar with symbols
    return `\n\n${symbolA} ${startSymbol}${bar}${endSymbol} ${symbolB}\n\n`;
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
    let displayCase = "\n__Displayed Achivements:__"

    // loop thru each displayed ach
    all.forEach(achievement => {
        if (displayed.includes(achievement['k'])) {
            displayCase += `\n` + getEmojiOfAch(achievementMapping[achievement['rank']])

            //wehhhhhhh
            // funny formatting
            if (achievement.vt === 4) {
                displayCase += ` **${achievement['name']}** - **Floor ${Math.floor(achievement.a)}** (${formatNumber(Math.round((achievement.v) * 100) / 100)}m) ${achievement.object}`
            } else {
                displayCase += ` **${achievement['name']}** - **${formatNumber(Math.round(achievement.v))}** ${achievement.object}`
            }

            if (achievement['rank'] === 100) {
                displayCase += ` (Issue ${achievement['pos']}/${achievement['total']})`
            } else {
                if (achievement['pos'] < 100) {
                    displayCase += ` (__#${achievement['pos'] + 1}__)`
                } else {
                    displayCase += ` (Top ${Math.round(achievement['pos'] / achievement['total'] * 10000) / 100}%)`
                }
            }
        }
    })
    // make sure the display isn't nothing
    if (displayCase != "\n__Displayed Achivements:__") return displayCase;
    return "";
}

function escapeUnderscores(input) {
    return input.replace(/_/g, '\\_');
}