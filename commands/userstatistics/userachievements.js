const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
import('node-fetch'); // Ensure 'node-fetch' is imported properly

const { formatNumber, escapeUnderscores, getEmojiOfAch, reformatTimestamp, convertToTimeFormat } = require('../../helpers/functions');
const { getUser } = require('../../helpers/getuser');
const { getEmoji } = require('../../helpers/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userachievements')
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

        let textPages = []
        let pageAchsByPageIndex = []
        let buttons = []

        categories.forEach(cat => {
            if (achList[cat]) { // if the achievement list exists
                const { pageTexts, pageAchs } = paginateAchievements(achList[cat]);

                for (let ind = 0; ind < pageTexts.length; ind++) {
                    textPages.push(new EmbedBuilder()
                        .setColor(colourMapping[cat])
                        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
                        .setDescription(`### __[${escapeUnderscores(username.toUpperCase())}](https://ch.tetr.io/u/${username}) -> Achievements -> ${catMap[cat]}__\n` + pageTexts[ind])
                    )

                    pageAchsByPageIndex.push(pageAchs[ind] ?? []);

                    let button = new ButtonBuilder()
                        .setCustomId(`achpage_${buttons.length}`)
                        .setLabel(`${catMap[cat]}`)
                        .setStyle(ButtonStyle.Primary)

                    if (buttons.length === 0) {
                        button.setDisabled(true)
                    }
                    if (pageTexts.length > 1) {
                        button.setLabel(`${catMap[cat]} (${ind + 1})`)
                    }

                    buttons.push(button)
                }
            } else {
                if (cat === "event") return; // no text or button if no event achievements
                textPages.push(new EmbedBuilder()
                    .setColor(colourMapping[cat])
                    .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
                    .setDescription(`### __[${escapeUnderscores(username.toUpperCase())}](https://ch.tetr.io/u/${username}) -> Achievements -> ${catMap[cat]}__\n` + `${getEmoji("ach_none")} No ${cat} achievements unlocked yet... :(`)
                )
                pageAchsByPageIndex.push([]);

                let button = new ButtonBuilder()
                    .setCustomId(`achpage_${buttons.length}`)
                    .setLabel(`${catMap[cat]}`)
                    .setStyle(ButtonStyle.Primary)

                if (buttons.length === 0) {
                    button.setDisabled(true)
                }

                buttons.push(button)
            }
        })

        // Initial row of buttons
        const rows = [];
        for (var i = 0; i < buttons.length; i++) {
            var rowind = Math.floor(i/5)
            rows[rowind] = i % 5 == 0 ? new ActionRowBuilder() : rows[rowind];
            rows[rowind].addComponents(buttons[i])
        }

        const messageKey = interaction.id;
        const selectRow = buildAchSelectRow(messageKey, 0, pageAchsByPageIndex[0]);

        // Send the initial message with the first page and buttons
        await interaction.editReply({
            embeds: [textPages[0]],
            components: [...rows, selectRow]
        });

        // Attach pages to the interaction for future reference
        interaction.client.pageData = {
            ...(interaction.client.pageData ?? {}),
            [interaction.id]: {
                textPages,
                pageAchsByPageIndex,
                currentPage: 0,
                view: "list",
                lastListPage: 0,
                buttons,
                username
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

function paginateAchievements(achlist) {
    const achievementMapping = {
        100: 'issued',
        1: 'bronze',
        2: 'silver',
        3: 'gold',
        4: 'platinum',
        5: 'diamond'
    };

    const pageSize = 15;
    const pageTexts = [];
    const pageAchs = [];

    if (!achlist) return {pageTexts: [], pageAchs: []};

    for (let i = 0; i < achlist.length; i++) {
        const ach = achlist[i];
        const pageIndex = Math.floor(i / pageSize);

        pageTexts[pageIndex] ??= "";
        pageAchs[pageIndex] ??= [];
        pageAchs[pageIndex].push(ach);

        let achText = ""

        //ok this is the same achtext shit
        //format thing because api silly
        let displayVal = formatNumber(Math.round(ach.v));
        if (ach.vt === 2) displayVal = `${convertToTimeFormat(ach.v)}`
        else if (ach.vt === 3) displayVal = `${convertToTimeFormat(-ach.v)}`
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
        if (ach.x?.ally) {
            let allyUsername = ach.x.ally.username;
            achText += ` (With [${escapeUnderscores(allyUsername).toUpperCase()}](https://ch.tetr.io/u/${allyUsername}))`;
        }

        //why is it like this i could just like do this in 1 line lmao but whatever
        if (ach.event) {
            let eventName = ach.event;
            achText += ` (${eventName})`
        }

        pageTexts[pageIndex] += achText;
    }

    return {pageTexts, pageAchs};
}


function buildAchSelectRow(messageKey, pageIndex, pageAchs) {
    const list = pageAchs ?? [];

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`achselect_${messageKey}`)
        .setMinValues(1)
        .setMaxValues(1);

    if (list.length === 0) {
        menu
            .setPlaceholder("No achievements on this page")
            .setDisabled(true)
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel("No achievements available")
                    .setValue("achd_none") // wait doesnt this just never trigger? nvm
            );
    } else {
        const opts = list.slice(0, 25).map((ach, i) =>
            new StringSelectMenuOptionBuilder()
                .setLabel(ach.name.length > 100 ? ach.name.slice(0, 97) + "..." : ach.name)
                .setValue(`achd_${pageIndex}_${i}`)
        );

        menu
            .setPlaceholder("View an achievement…")
            .setDisabled(false)
            .addOptions(opts);
    }

    return new ActionRowBuilder().addComponents(menu);
}

