const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
import('node-fetch'); // Ensure 'node-fetch' is imported properly

const { formatNumber, escapeUnderscores, getEmojiOfAch, reformatTimestamp } = require('../../helpers/functions');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievement-info')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('Get information about a specific user\'s achievements via their TETR.IO (or Discord) username/ID.')
        .addStringOption((option) =>
            option
                .setName('user')
                .setDescription('the TETR.IO username / Discord to search for')
                .setRequired(true),
        ),

    async execute(interaction) {
        // ok this one is kinda a mess so good luck

        let achs, username, stats, tetrioID;

        let user = interaction.options.getString('user').toLowerCase();    
        let discordRegex = new RegExp("[0-9]{18,}"); // regex to check if there are 18 or more numbers in the name, meaning its probably a discord username
        let isDiscordUser = false;

        if (discordRegex.test(user)) { // check if it matches
            isDiscordUser = true;
        }

        // Fetch the account with either discord or tetrio
        if (isDiscordUser) {
            let userID = interaction.options.getString('user');
                const discordMatch = userID.match(/<@(\d+)>/);
            if (discordMatch) {
                userID = discordMatch[1]
            }

            let response = await fetch(`https://ch.tetr.io/api/users/search/discord:id:${userID}`);
            stats = await response.json();


            if (stats.data.users[0] === undefined) {
                return await interaction.reply({
                    content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                    ephemeral: true
                });
            }

            username = stats.data.users[0].username;

            if (!stats.success) {
                return await interaction.reply({
                    content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    ephemeral: true
                });
            }

            tetrioID = stats.data.users[0]._id
            stats = stats.data
            response = await fetch(`https://ch.tetr.io/api/users/${tetrioID}/summaries/achievements`);
            achs = await response.json();
        } else { //tetrio user
            const user = interaction.options.getString('user').toLowerCase();

            let responseStats = await fetch(`https://ch.tetr.io/api/users/${user}`);
            stats = await responseStats.json();
            username = user;
            tetrioID = stats.data._id
            

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

            const response = await fetch(`https://ch.tetr.io/api/users/${user}/summaries/achievements`);
            achs = await response.json();

            stats = stats.data;

        } 
        achs = achs.data;

        // create a bunch of vars
        const catMap = {
            "general": "General",
            "league": "Tetra League",
            "solo": "Solo",
            "zenith": "Quick Play",
            "legacy": "Legacy",
        }
        let categories = ["general", "league", "solo", "zenith", "legacy"];
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
                .setThumbnail(`https://tetr.io/user-content/avatars/${tetrioID}.jpg`)
                .setDescription(`### __[${escapeUnderscores(username.toUpperCase())}](https://ch.tetr.io/u/${username}) -> Achievements -> ${catMap[trimmedCat]}__\n` + text)
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
        //format thing because fuck your API OSK (OSK if you're reading this please change it)
        let displayVal = formatNumber(Math.round(ach.v));
        if (ach.vt === 2) displayVal = `${formatNumber(Math.round((ach.v) / 100) / 10)}s`
        else if (ach.vt === 3) displayVal = `${formatNumber(-Math.round((ach.v) / 100) / 10)}s`
        else if (ach.vt === 4) displayVal = `${formatNumber(Math.round((ach.v) * 100) / 100)}m (Floor ${Math.floor(ach.a)})`
        else if (ach.name === "Guardian Angel") displayVal = `${formatNumber(Math.round((ach.v) * 100) / 100)}m` //fuck you OSK you bitch (jk we love you)
        else if (ach.vt === 5) displayVal = `Obtained ${reformatTimestamp(-ach.v)}`
        else if (ach.vt === 6) displayVal = formatNumber(-Math.round(ach.v))

        achText += `\n- ` + getEmojiOfAch(achievementMapping[ach['rank']])

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

        if (ach.nolb) { // if it's issued
            achText += ` (Issue ${ach['pos']}/${ach['total']})` 
        } else {
            if (ach['pos'] < 100) { // if you're in the top 100 players
                achText += ` (**#${ach['pos'] + 1}**)`
            }
            else if (ach['pos'] / ach['total'] < 0.01) { // if you're in the top 1%
                achText += ` (Top ${Math.round(ach['pos'] / ach['total'] * 100000) / 1000}%)` // literally just one extra point of precision
            } 
            else { // everything else
                achText += ` (Top ${Math.round(ach['pos'] / ach['total'] * 10000) / 100}%)`
            }
        }

        //duo achievement
        if (ach.x.ally) {
            let allyUsername = ach.x.ally.username;
            achText += ` (With [${allyUsername.toUpperCase()}](https://ch.tetr.io/u/${allyUsername}))`;
        }

        // in case it's undefined, define as ""
        allText[Math.floor(achCount / pageSize)] = allText[Math.floor(achCount / pageSize)] ?? "";
        // push the achievement text
        allText[Math.floor(achCount / pageSize)] += achText
    });

    return allText;
}
