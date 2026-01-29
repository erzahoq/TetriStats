const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

const { formatNumber, formatISOString, formatTime, formatUsername, formatAchievement } = require('../../helpers/formatters');
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
        // Defer reply immediately to avoid timeout
        await interaction.deferReply();

        const user = await getUser(interaction.options.getString('user').toLowerCase());

        if (user === "no such user") {
            return await interaction.editReply({
                content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
            });
        } else if (user === "server error") {
            return await interaction.editReply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
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
            "event": "Event"
        }
        let categories = ["general", "league", "solo", "zenith", "legacy", "event"];
        let achList = {};
        let achDisplays = {};
        let pages = {};

        const colourMapping = {
            "general": "#6dc971",
            "league": "#c51111",
            "solo": "#ff7024",
            "zenith": "#ffc800",
            "legacy": "#ac64ca",
            "event": "#f892a3"
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
                if (cat === "event") return; // no text or button if no event achievements
                achDisplays[`${cat}0`] = `${getEmoji("ach_none")} No ${cat} achievements unlocked yet... :(`
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
                .setDescription(`### __${formatUsername(username)} -> Achievements -> ${catMap[trimmedCat]}__\n` + text)
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
        await interaction.editReply({
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

    achlist.forEach(ach => {
        achCount++;
        achText = "\n- " + formatAchievement(ach);

        // in case it's undefined, define as ""
        allText[Math.floor(achCount / pageSize)] = allText[Math.floor(achCount / pageSize)] ?? "";
        // push the achievement text
        allText[Math.floor(achCount / pageSize)] += achText
    });

    return allText;
}
