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

        console.log(statData)

        achs = achs.data;

        username = capitalizeFirstLetter(username);

		let categories = ["general","league","solo","zenith"];
		let achList = {};
		let achDisplays = {};

        //magic voodoo sorting raah
        let sortedAchs = sortByAchievementRank(achs);

        sortedAchs.forEach(achievement => {
            //check if the user actually has this achievement lmao
            if (achievement.rank) {
				if (!achList[achievement.category]) {
					achList[achievement.category] = [];
				}
				achList[achievement.category].push(achievement);
                //displayString += `\n` + getEmojiOfAch(achievementMapping[achievement['rank']])
                //displayString += ` **${achievement['name']}** - **${formatNumber(Math.round(achievement.v))}** ${achievement.object}` // hippity hoppity i stole your code
            }

        });

		categories.forEach(cat => {
			if (!achList[cat]) {
				achDisplays[cat] = `<:ach_none:1278178486586048575> No ${cat} achievements unlocked yet... :(`	
			}
		})
		
        const pages = [
            new EmbedBuilder()
                .setColor("#6dc971")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setTitle(`${capitalizeFirstLetter(username)}'s General Achievements:`)
                .setURL(`https://ch.tetr.io/u/${username}`)
                .setDescription(achDisplays['general']),
            new EmbedBuilder()
                .setColor("#80bdff")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setTitle(`${capitalizeFirstLetter(username)}'s Tetra League Achievements:`)
                .setURL(`https://ch.tetr.io/u/${username}`)
                .setDescription(achDisplays['league']),
            new EmbedBuilder()
                .setColor("#80bdff")
                .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setTitle(`${capitalizeFirstLetter(username)}'s Solo Achievements:`)
                .setURL(`https://ch.tetr.io/u/${username}`)
                .setDescription(achDisplays['solo']),
            new EmbedBuilder()
               .setColor("#80bdff")
               .setTitle(`${capitalizeFirstLetter(username)}'s Quick Play Achievements:`)
                .setURL(`https://ch.tetr.io/u/${username}`)
               .setThumbnail(`https://tetr.io/user-content/avatars/${statData._id}.jpg`)
                .setDescription(achDisplays['zenith']),
        ];

        // Initial row of buttons
		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('achpage_0')
				.setLabel('General')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(true), // Disable the first button initially
			new ButtonBuilder()
				.setCustomId('achpage_1')
				.setLabel('League')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId('achpage_2')
				.setLabel('Solo')
				.setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
				.setCustomId('achpage_3')
				.setLabel('Zenith')
				.setStyle(ButtonStyle.Primary),
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

function displayedAchesConvert(displayed, all) {
    const achievementMapping = {
        100: 'issued',
        1: 'bronze',
        2: 'silver',
        3: 'gold',
        4: 'platinum',
        5: 'diamond'
    };
    let displayCase = "\nDisplayed Achivements:"

    all.forEach(achievement => {
        if (displayed.includes(achievement['k'])) {
            displayCase += `\n` + getEmojiOfAch(achievementMapping[achievement['rank']])
            displayCase += ` **${achievement['name']}** - **${formatNumber(Math.round(achievement.v))}** ${achievement.object}`
            if (achievement['rank'] === 100) {
                displayCase += ` (Issue ${achievement['pos']}/${achievement['total']})`
            } else {
                if (achievement['pos'] < 100) {
                    displayCase += ` (__#${achievement['pos']+1}__)`
                } else {
                    displayCase += ` (Top ${Math.round(achievement['pos']/achievement['total']*10000)/100}%)`
                }
            }
        }
    })
    if (displayCase != "Displayed Achievements:") return displayCase;
    return "";
}


function sortByAchievementRank(items) { 
    // Create a mapping for sorting priority, lower values mean higher priority
    const sortOrder = {
        1: 1,   // bronze
        2: 2,   // silver
        3: 3,   // gold
        4: 4,   // platinum
        5: 5,   // diamond
        100: 6  // issued
    };
    return items.sort((a, b) => sortOrder[a.rank] - sortOrder[b.rank]);
}
