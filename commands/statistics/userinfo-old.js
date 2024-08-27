const { SlashCommandBuilder, EmbedBuilder, MessageButton } = require('discord.js');
import("node-fetch");

module.exports = {
	async execute(interaction) {
        let response;
        let stats;
        let summary;

        if (interaction.options.getSubcommand() === 'tetrio') {
			const user = interaction.options.getString('user').toLowerCase();

            response = await fetch(`https://ch.tetr.io/api/users/${user}`);
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

            response = await fetch(`https://ch.tetr.io/api/users/search/discord:${user.id}`);

            stats = await response.json();

            if (stats.data === null) {
                return await interaction.reply({
                    content: 'No such user found on TETR.IO! | Either the account no longer exists, or this person has not linked their Discord with TETR.IO.', 
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

        const statDt = stats.data
        const sumDt = summary.data

        let country = countryCodeToEmoji(statDt.country);

        let badgeArray = statDt.badges.map(badge => badge.id);


        const userEmbed = new EmbedBuilder()
        .setColor("#80bdff")
        .setThumbnail(`https://tetr.io/user-content/avatars/${statDt._id}.jpg`)
        .setTitle(`${capitalizeFirstLetter(statDt.username)}'s Profile:`)
        .setURL(`https://ch.tetr.io/u/${statDt.username}`)
        .setFooter({ text: `User ID: ${statDt._id} | Role: ${statDt.role}`})
        .setDescription(`
${statDt.bio || ""}

Account Creation: ${reformatTimestamp(statDt.ts) || "Before join dates were recorded"}
Level ${formatNumber(Math.round(calculateLevel(statDt.xp)))} (${formatNumber(Math.round(statDt.xp))} XP)
Country: ${country}
Friends: ${statDt.friend_count}
${supporterConvert(statDt.supporter, statDt.supporter_tier)}
${badgesConvert(badgeArray)}Achievement Rating: ${statDt.ar}${achievementCountsConvert(statDt.ar_counts)}${gamesPlayedConvert(statDt.gamesplayed, statDt.gameswon, statDt.gametime)}
${formatLeague(sumDt, country)}${formatZenith(sumDt, country)}${formatZenithExpert(sumDt, country)}${format40Lines(sumDt, country)}${formatBlitz(sumDt, country)}${formatZen(sumDt)}
${connectionsConvert(statDt.connections)}
            `)
        .setTimestamp();

        await interaction.reply({embeds: [userEmbed]}) 



	},
};


function gamesWonConvert(gamesWon, gamesPlayed) {
    if (gamesWon === 'Hidden' || gamesPlayed === 'Hidden' || gamesPlayed === 0) {
        return gamesWon;
    }

    return `${gamesWon} (${Math.round(10000*(gamesWon/gamesPlayed))/100}%)`
}

function badgesConvert(badgelist) {
    if (badgelist.length > 0) {
        return `**Badges**: ${badgelist.length} | `
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

    return `${Math.round(secondsToHours(playtime)*10)/10} Hours`    
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

        for (let i = 1; i < supporterTier; i++) {
            supporterString = supporterString.concat("<:supporter_star:1277300953111855231>")
            
        }
        return (`Supporter${supporterString}\n`)
    } else {
        return ""
    }
}

function achievementCountsConvert(ar_counts) {
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

    // Initialize an array to store the formatted achievements
    const formattedList = [];

    // Check if issued achievement exists and add it to the start of the list
    if (ar_counts[100]) {
        formattedList.push(`<:ach_issued:${achEmojis["ach_issued"]}> ${ar_counts[100]}`);
    }

    // Loop through the rest of the achievements (excluding issued)
    for (const [key, name] of Object.entries(achievementMapping)) {
        // Check if the achievement exists in the ar_counts object
        if (ar_counts[key]) {
            // Push the formatted string to the list with the count
            formattedList.push(`<:ach_${name}:${achEmojis["ach_"+name]}> ${ar_counts[key]}`);
        }
    }

    // If the formatted list is empty, return an empty string
    if (formattedList.length === 0) {
        return '';
    }

    // Join the list items with pipes (|) and return the formatted string
    return "\n"+formattedList.join(' | ');
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
    return "__**Connections:**__ \n"+formattedList.join('\n');
}

function reformatTimestamp(isoString) {
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

function calculateLevel(xp) {
    return ((xp/500)**0.6) + (xp/(5000+((Math.max(0, xp - (4*10**6)))/5000))) + 1
}

function format40Lines(statistics, country) {
    if (statistics['40l'].record) {
        let flStatistics = statistics['40l'];
        return `\n### <:40lines:1277298516380614786> 40 Lines:
- PB: ${convertToTimeFormat(flStatistics.record.results.stats.finaltime)}s (${Math.round(flStatistics.record.results.aggregatestats.pps*100)/100} PPS)
- Rank: #${formatNumber(flStatistics.rank)} (#${formatNumber(flStatistics.rank_local)} ${country})`
    } else {
        return ""
    }
}

function formatBlitz(statistics, country) {
    if (statistics['blitz'].record) {
        let blStatistics = statistics['blitz'];
        return `\n### <:blitz:1277298507920838718> Blitz:
- PB: ${formatNumber(blStatistics.record.results.stats.score)} (${Math.round(blStatistics.record.results.aggregatestats.pps*100)/100} PPS)
- Rank: #${formatNumber(blStatistics.rank)} (#${formatNumber(blStatistics.rank_local)} ${country})`
    } else {
        return ""
    }
}

function formatZenith(statistics, country) {
    if (statistics['zenith'].record && statistics['zenith'].best.record) {
        let zStatistics = statistics['zenith'];
        return `\n### <:quickplay:1277296551428886588> Quick Play:
- PB: ${formatNumber(Math.round(zStatistics.record.results.stats.zenith.altitude*100)/100)}m
- Rank: #${formatNumber(zStatistics.rank)} (#${formatNumber(zStatistics.rank_local)} ${country})
- All-Time Best: ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude*100)/100)}m (#${formatNumber(zStatistics.best.rank)})`
    } else if (statistics['zenith'].record) {
        let zStatistics = statistics['zenith'];
        return `\n### <:quickplay:1277296551428886588> Quick Play:
        - PB: ${formatNumber(Math.round(zStatistics.record.results.stats.zenith.altitude*100)/100)}m
        - Rank: #${formatNumber(zStatistics.rank)} (#${formatNumber(zStatistics.rank_local)} ${country})
        - All-Time Best: ${formatNumber(Math.round(zStatistics.record.results.stats.zenith.altitude*100)/100)}m`
    }
    else {
        return ""
    }
}

function formatZenithExpert(statistics, country) {
    if (statistics['zenithex'].record) {
        let zxStatistics = statistics['zenithex'];
        return `\n### <:quickplayexpert:1277351744413896724> Expert Quick Play:
- PB: ${formatNumber(Math.round(zxStatistics.record.results.stats.zenith.altitude*100)/100)}m
- Rank: #${formatNumber(zxStatistics.rank)} (#${formatNumber(zxStatistics.rank_local)} ${country})
- All-Time Best: ${formatNumber(Math.round(zxStatistics.best.record.results.stats.zenith.altitude*100)/100)}m (#${formatNumber(zxStatistics.best.rank)})`
    } else {
        return ""
    }
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

function formatLeague(statistics, country)  {
    const leagueStats = statistics['league']

    if (leagueStats.gamesplayed === 0) {
        return '';
    }

    let gamesPlayed = leagueStats.gamesplayed;
    let gamesWon = leagueStats.gameswon;
    let glicko = leagueStats.glicko;
    let ratingDeviation = leagueStats.rd;
    let rating = leagueStats.tr;
    let glixaire = leagueStats.gxe;
    let rank = leagueStats.rank;
    let rankBoolean = true;

    let progressToNextRank = (leagueStats.prev_at - leagueStats.standing)/(leagueStats.prev_at - leagueStats.next_at)

    let prevRank = leagueStats.prev_rank;
    let nextRank = leagueStats.next_rank;

    if (!nextRank && prevRank === 'x') {
        prevRank = 'x+'
        nextRank = '#1'
    }

    if (!prevRank && nextRank === 'd+') {
        prevRank = "d"
    }

    if (rating < 0) {
        rating = `${leagueStats.gamesplayed}/10 Rating Games Played`
        rankBoolean = false;
    } else if (ratingDeviation > 100) {
        rating = `Unranked`;
        rankBoolean = false;
    } else {
        rating = `${(Math.round(rating*100))/100} TR`
    }

    return `## <:league:1277378168717840497> Tetra League:
# ${getEmojiOfRank(rank)} ${formatNumber(rating)}${formatLeagueStanding(leagueStats.standing, leagueStats.standing_local, glicko, ratingDeviation, country)}
**Record: ${gamesWon}/${gamesPlayed}** (${Math.round(10000*(gamesWon/gamesPlayed))/100}%)

Attack Per Minute: ${leagueStats.apm}
Pieces Per Second: ${leagueStats.pps}
Versus Score: ${leagueStats.vs}${generateProgressBar(rankBoolean, progressToNextRank, getEmojiOfRank(prevRank), getEmojiOfRank(nextRank))}`
}

function getEmojiOfRank(rank) {
    if (!rank) {
        return;
    }

    if (rank === '#1') {
        return rank
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
        "rank_z": "1277382169538461746"
    }
    let formattedRank = 'rank_' + rank.toLowerCase().replace("+", "plus").replace("-", "minus");
    return `<:${formattedRank}:${rankEmojis[formattedRank]}>`
}


function formatLeagueStanding(standing, localStanding, glicko, ratingDeviation, country) {
    if (standing > 0) {
        return `\n**\\\#${formatNumber(standing)}** (#${formatNumber(localStanding)} ${country})
**Glicko: ${formatNumber((Math.round(glicko*100))/100)} ± ${(Math.round(ratingDeviation*100))/100}**`
    } else {
        return ''
    }
}

function generateProgressBar(generateBar, progress, symbolA, symbolB, length = 14) {
    if (!generateBar) {
        return '';
    }

    // Ensure the progress is within the 0-1 range
    progress = Math.max(0, Math.min(progress, 1));

    // Calculate the position of the "!" marker
    const position = Math.round(progress * length);

    // Generate the progress bar
    const bar = Array.from({ length: length }, (_, i) => (i === position ? "<:bar_half:1277414382795489412>" : (i < position ? "<:bar_full:1277414375988400128>" : "<:bar_empty:1277414391201005589>"))).join("");

    // Return the complete progress bar with symbols
    return `\n\n${symbolA} <:bar_start:1277414364432830545>${bar}<:bar_end:1277414398713004116> ${symbolB}\n\n`;
}

