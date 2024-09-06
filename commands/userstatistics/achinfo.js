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
        let achs, username;
        let statData;
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

        const catMap = {
            "general": "General",
            "league": "Tetra League",
            "solo": "Solo",
            "zenith": "Quick Play"
        }
		let categories = ["general","league","solo","zenith"];
		let achList = {};
		let achDisplays = {};
        let pages = {};

        //magic voodoo sorting raah
        let sortedAchs = sortByAchievementRank(achs);

        

        sortedAchs.forEach(achievement => {
            //check if the user actually has this achievement lmao
            if (achievement.rank) {
				if (!achList[achievement.category]) {
					achList[achievement.category] = [];
				}
				achList[achievement.category].push(achievement);
            }

        });

		categories.forEach(cat => {
			if (achList[cat]) {
                var list = formatAchievementListText(achList[cat]);
                var ind = 0;
                list.forEach(text => {
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

        Object.entries(achDisplays).forEach(([curCat,text]) => {
            let trimmedCat = curCat.replace(/\d*/,"")
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
                button.setLabel(`${catMap[trimmedCat]} (${curCat.match(/\d*/)})`)
            }
        })

        // Initial row of buttons
		const row = new ActionRowBuilder();
        buttons.forEach(but => {
            row.addComponents(but);
        })

        // Send the initial message with the first page and buttons
		await interaction.reply({
			embeds: [pages[0]],
			components: [row]
		});

		// Attach pages to the interaction for future reference
		interaction.client.pageData = {
			[interaction.id]: {
				pages,
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
    return `<:ach_${name}:${achEmojis["ach_"+name]}>`
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

    achlist.forEach(ach => {
        var achText = ""
        achCount++;
        //format thing because fuck your API OSK
        let displayVal = formatNumber(Math.round(ach.v));
        if (ach.vt === 2) displayVal = `${formatNumber(Math.round((ach.v)/100)/10)}s`
        else if (ach.vt === 3) displayVal = `${formatNumber(-Math.round((ach.v)/100)/10)}s`
        else if (ach.vt === 4) displayVal = `${formatNumber(Math.round((ach.v)*100)/100)}m (Floor ${Math.floor(ach.a)})`
        else if (ach.name === "Guardian Angel") displayVal = `${formatNumber(Math.round((ach.v)*100)/100)}m` //fuck you OSK you bitch
        else if (ach.vt === 5) displayVal = `Obtained ${reformatTimestamp(-ach.v)}`
        else if (ach.vt === 6) displayVal = formatNumber(-Math.round(ach.v))

        achText += `\n` + getEmojiOfAch(achievementMapping[ach['rank']])

        //check for attributes
        let attCount = 0;
        if (ach.art === 0) {
            achText += "<:au:1278179023188398211>"
            attCount++;
        } else if (ach.art === 2) {
            achText += "<:ac:1278179007468277770>"
            attCount++;
        }
        if (ach.hidden) {
            achText += "<:ah:1278179015156432978>"
            attCount++;
        }

        while (attCount !== 2) {
            attCount++;
            achText += "<:na:1278856076955222027>"
        }
        
        achText += ` **${ach['name']}** - **${displayVal}**`

        //something something rank
        if (ach['rank'] === 100) {
            achText += ` (Issue ${ach['pos']}/${ach['total']})`
        } else {
            if (ach['pos'] < 100) {
                achText += ` (__#${ach['pos']+1}__)`
            } else {
                achText += ` (Top ${Math.round(ach['pos']/ach['total']*10000)/100}%)`
            }
        }
        allText[Math.floor(achCount/pageSize)] += achText
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
