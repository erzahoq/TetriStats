const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ComponentType, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
import('node-fetch'); // Ensure 'node-fetch' is imported properly

const { formatNumber, escapeUnderscores, getEmojiOfAch, reformatTimestamp } = require('../../helpers/functions');
const { getUser } = require('../../helpers/getuser');
const { getEmoji } = require('../../helpers/emojis');

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
        const user = await getUser(interaction.options.getString('user').toLowerCase());

        if (user === "no such user") {
            return await interaction.reply({
                    content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                    flags: MessageFlags.Ephemeral
            });
        } else if (user === "server error") {
            return await interaction.reply({
                    content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    flags: MessageFlags.Ephemeral
            });
        }

        const username = user.username;

        const response = await fetch(`https://ch.tetr.io/api/users/${user._id}/summaries/achievements`);
        let achs = await response.json();

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

        const colourMapping = {
            "general": "#6dc971",
            "league": "#c51111",
            "solo": "#ff7024",
            "zenith": "#ffc800",
            "legacy": "#d384f5"
        };

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
                achDisplays[`${cat}0`] = `${getEmoji(ach_none)} No ${cat} achievements unlocked yet... :(`
            }
        })

        let textPages = []
        let buttons = []

        Object.entries(achDisplays).forEach(([curCat, text]) => {
            let trimmedCat = curCat.replace(/\d+/, "")

            // create the embed and respective button
            textPages.push(new EmbedBuilder()
                .setColor(colourMapping[trimmedCat])
                .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
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
        //format thing because api silly
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
            achText += getEmoji('au')
        } else if (ach.art === 2) {
            achText += getEmoji('ac')
        }
        if (ach.hidden) {
            achText += getEmoji('ah')
        }
        if (ach.event) {
            achText += getEmoji('ae')
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
            achText += ` (With [${escapeUnderscores(allyUsername).toUpperCase()}](https://ch.tetr.io/u/${allyUsername}))`;
        }

        // in case it's undefined, define as ""
        allText[Math.floor(achCount / pageSize)] = allText[Math.floor(achCount / pageSize)] ?? "";
        // push the achievement text
        allText[Math.floor(achCount / pageSize)] += achText
    });

    return allText;
}
