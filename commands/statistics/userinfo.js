const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
import("node-fetch");

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
        .setFooter({ text: `User ID: ${statDt._id} | Role: ${statDt.role}`})
        .setDescription(`
${statDt.bio || ""}

Account Creation: ${reformatTimestamp(statDt.ts) || "Before join dates were recorded"}
Level ${formatNumber(Math.round(calculateLevel(statDt.xp)))} (${formatNumber(Math.round(statDt.xp))} XP)
Country: ${country}
Friends: ${statDt.friend_count}
${supporterConvert(statDt.supporter, statDt.supporter_tier)}
${badgesConvert(badgeArray)}Achievement Rating: ${statDt.ar}
${achievementCountsConvert(statDt.ar_counts)}${gamesPlayedConvert(statDt.gamesplayed, statDt.gameswon, statDt.gametime)}
${formatZenith(sumDt, country)}
${formatZenithExpert(sumDt, country)}
${format40Lines(sumDt, country)}
${formatBlitz(sumDt, country)}
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
        return (`Supporter:${supporterString}\n`)
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
    return formattedList.join(' | ');
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
    return "__**Connections:**__\n"+formattedList.join('\n');
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
        return `### <:40lines:1277298516380614786> 40 Lines:
- PB: ${convertToTimeFormat(flStatistics.record.results.stats.finaltime)}s (${Math.round(flStatistics.record.results.aggregatestats.pps*100)/100} PPS)
- Rank: #${formatNumber(flStatistics.rank)} (#${formatNumber(flStatistics.rank_local)} ${country})`
    } else {
        return ""
    }
}

function formatBlitz(statistics, country) {
    if (statistics['blitz'].record) {
        let blStatistics = statistics['blitz'];
        return `### <:blitz:1277298507920838718> Blitz:
- PB: ${formatNumber(blStatistics.record.results.stats.score)} (${Math.round(blStatistics.record.results.aggregatestats.pps*100)/100} PPS)
- Rank: #${formatNumber(blStatistics.rank)} (#${formatNumber(blStatistics.rank_local)} ${country})`
    } else {
        return ""
    }
}

function formatZenith(statistics, country) {
    if (statistics['zenith'].record) {
        let zStatistics = statistics['zenith'];
        return `### <:quickplay:1277296551428886588> Quick Play:
- PB: ${formatNumber(Math.round(zStatistics.record.results.stats.zenith.altitude*100)/100)}m
- Rank: #${formatNumber(zStatistics.rank)} (#${formatNumber(zStatistics.rank_local)} ${country})
- All-Time Best: ${formatNumber(Math.round(zStatistics.best.record.results.stats.zenith.altitude*100)/100)}m (#${formatNumber(zStatistics.best.rank)})`
    } else {
        return ""
    }
}

function formatZenithExpert(statistics, country) {
    if (statistics['zenithex'].record) {
        let zxStatistics = statistics['zenithex'];
        return `### <:quickplayexpert:1277351744413896724> Expert Quick Play:
- PB: ${formatNumber(Math.round(zxStatistics.record.results.stats.zenith.altitude*100)/100)}m
- Rank: #${formatNumber(zxStatistics.rank)} (#${formatNumber(zxStatistics.rank_local)} ${country})
- All-Time Best: ${formatNumber(Math.round(zxStatistics.best.record.results.stats.zenith.altitude*100)/100)}m (#${formatNumber(zxStatistics.best.rank)})`
    } else {
        return ""
    }
}