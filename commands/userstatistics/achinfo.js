const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
import('node-fetch'); // Ensure 'node-fetch' is imported properly

module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievement-info')
        .setDescription('Get information about a specific user\'s achievements via their TETR.IO (or Discord) username/ID.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('tetrio')
                .setDescription('Get information about a specific user\'s achievements via their TETR.IO username/ID.')
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
                .setDescription('Get info about a user\'s achievements via their Discord, user must have linked Discord to TETR.IO')
                .addUserOption((option) =>
                    option
                        .setName('user')
                        .setDescription('the discord user to search for')
                        .setRequired(true),
                ),
        ),

    async execute(interaction) {
        // ok this one is kinda a mess so good luck

        let achs, username, statData;

        // Fetch the account with either discord or tetrio
        if (interaction.options.getSubcommand() === 'tetrio') {
            const user = interaction.options.getString('user').toLowerCase();

            let responseStats = await fetch(`https://ch.tetr.io/api/users/${user}`);
            statData = await responseStats.json();
            username = user;

            if (!statData.success) {
                if (statData.error.msg === "No such user! | Either you mistyped something, or the account no longer exists.") {
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

            const response = await fetch(`https://ch.tetr.io/api/users/${user}/summaries/achievements`);
            achs = await response.json();

            statData = statData.data;

        } else if (interaction.options.getSubcommand() === 'discord') {
            const user = interaction.options.getUser('user');

            let response = await fetch(`https://ch.tetr.io/api/users/search/discord:${user.id}`);
            statData = await response.json();

            username = statData.data.user.username;


            if (statData.data === null) {
                return await interaction.reply({
                    content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                    ephemeral: true
                });
            }

            if (!statData.success) {
                return await interaction.reply({
                    content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    ephemeral: true
                });
            }

            const tetrioID = statData.data.user._id
            statData = statData.data.user
            response = await fetch(`https://ch.tetr.io/api/users/${tetrioID}/summaries/achievements`);
            achs = await response.json();
        }

        achs = achs.data;

        username = capitalizeFirstLetter(username);

        // create a bunch of vars
        const catMap = {
            "general": "General",
            "league": "Tetra League",
            "solo": "Solo",
            "zenith": "Quick Play",
            "event": "Event",
        }
        let categories = ["general", "league", "solo", "zenith", "event"];
        let achList = {};
        let achDisplays = {};
        let pages = {};

        //magic voodoo sorting raah
        let sortedAchs = sortByAchievementRank(achs);

        sortedAchs.forEach(achievement => {
            //check if the user actually has this achievement lmao
            if (achievement.rank) {
                if (!achList[achievement.category]) {
                    achList[achievement.category] = []; // creates the list if it doesn't exist
                }
                achList[achievement.category].push(achievement);
            }

        });

        // loop thru each category
        categories.forEach(cat => {
            if (achList[cat]) { // if the achievement list exists
                var list = formatAchievementListText(achList[cat]);
                var ind = 0;
                list.forEach(text => { // go through each var in list and change the displays
                    achDisplays[`${cat}${ind}`] = text;
                    ind++;
                })
                pages[cat] = ind;
            } else {
                achDisplays[`${cat}0`] = `<:ach_none:1278178486586048575> No ${cat} achievements unlocked yet... :(`
            }
        })

        let textPages = []
        let buttons = []

        Object.entries(achDisplays).forEach(([curCat, text]) => {
            let trimmedCat = curCat.replace(/\d+/, "")

            // create the embed and respective button
            textPages.push(new EmbedBuilder()
                .setColor("#6dc971")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setTitle(`${capitalizeFirstLetter(username)}'s ${catMap[trimmedCat]} Achievements:`)
                .setURL(`https://ch.tetr.io/u/${username}`)
                .setDescription(text)
            )

            let button = new ButtonBuilder()
                .setCustomId(`achpage_${buttons.length}`)
                .setLabel(`${catMap[trimmedCat]}`)
                .setStyle(ButtonStyle.Primary)
            if (buttons.length === 0) {
                button.setDisabled(true)
            }
            if (pages[trimmedCat] > 1) {
                button.setLabel(`${catMap[trimmedCat]} (${parseInt(curCat.match(/\d+/)) + 1})`)
            }

            buttons.push(button)
        })

        // Initial row of buttons
        const rows = [];
        for (var i = 0; i < buttons.length; i++) {
            var rowind = Math.floor(i/5)
            rows[rowind] = i % 5 == 0 ? new ActionRowBuilder() : rows[rowind];
            rows[rowind].addComponents(buttons[i])
        }

        // Send the initial message with the first page and buttons
        await interaction.reply({
            embeds: [textPages[0]],
            components: rows
        });

        // Attach pages to the interaction for future reference
        interaction.client.pageData = {
            [interaction.id]: {
                textPages,
                currentPage: 0,
                buttons
            }
        };
    }
};

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
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

function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}


function sortByAchievementRank(items) {
    // Create a mapping for sorting priority, lower values mean higher priority
    const sortOrder = {
        1: 6,   // bronze
        2: 5,   // silver
        3: 4,   // gold
        4: 3,   // platinum
        5: 2,   // diamond
        100: 1  // issued
    };
    return items.sort((a, b) => sortOrder[a.rank] - sortOrder[b.rank]);
}

function formatAchievementListText(achlist) {
    const achievementMapping = {
        100: 'issued',
        1: 'bronze',
        2: 'silver',
        3: 'gold',
        4: 'platinum',
        5: 'diamond'
    };

    var allText = []
    var achCount = 0;
    const pageSize = 15

    if (!achlist) return null;

    // for every achievement...
    achlist.forEach(ach => {
        var achText = ""
        achCount++;
        //format thing because fuck your API OSK
        let displayVal = formatNumber(Math.round(ach.v));
        if (ach.vt === 2) displayVal = `${formatNumber(Math.round((ach.v) / 100) / 10)}s`
        else if (ach.vt === 3) displayVal = `${formatNumber(-Math.round((ach.v) / 100) / 10)}s`
        else if (ach.vt === 4) displayVal = `${formatNumber(Math.round((ach.v) * 100) / 100)}m (Floor ${Math.floor(ach.a)})`
        else if (ach.name === "Guardian Angel") displayVal = `${formatNumber(Math.round((ach.v) * 100) / 100)}m` //fuck you OSK you bitch
        else if (ach.vt === 5) displayVal = `Obtained ${reformatTimestamp(-ach.v)}`
        else if (ach.vt === 6) displayVal = formatNumber(-Math.round(ach.v))

        achText += `\n` + getEmojiOfAch(achievementMapping[ach['rank']])

        //check for attributes and format
        if (ach.art === 0) {
            achText += "<:au:1278179023188398211>"
        } else if (ach.art === 2) {
            achText += "<:ac:1278179007468277770>"
        }
        if (ach.hidden) {
            achText += "<:ah:1278179015156432978>"
        }
        if (ach.event) {
            achText += "<:ae:1314829710550630501>"
        }
        // i didn't like this formatting it was ugly imo

        achText += ` **${ach['name']}** - **${displayVal}** ${ach['object']}` // show the main info

        if (ach['rank'] === 100) { // if it's issued
            achText += ` (Issue ${ach['pos']}/${ach['total']})` 
        } else {
            if (ach['pos'] < 100) { // if you're in the top 100 players
                achText += ` (__#${ach['pos'] + 1}__)`
            } else { // everything else
                achText += ` (Top ${Math.round(ach['pos'] / ach['total'] * 10000) / 100}%)`
            }
        }

        // in case it's undefined, define as ""
        allText[Math.floor(achCount / pageSize)] = allText[Math.floor(achCount / pageSize)] ?? "";
        // push the achievement text
        allText[Math.floor(achCount / pageSize)] += achText
    });

    return allText;
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
