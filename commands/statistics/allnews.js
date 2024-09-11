const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
import("node-fetch");

const itemsPerPage = 15;
const pageCount = 4;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('news-all')
		.setDescription('Fetches all the latest Tetra News.'),
	async execute(interaction) {        
        const response = await fetch(`https://ch.tetr.io/api/news/?limit=${itemsPerPage * pageCount}`);
        const stats = await response.json(); // Use .json() to parse the response as JSON
        
        if (!stats.success) {
            return await interaction.reply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.', 
                ephemeral: true
            });
        }

        //get the news info more cleanly
        const data = stats.data.news;

        const gametypeMapping = {
            '40l': '40 Lines',
            'blitz': "Blitz",
            'zenith': 'Quick Play',
            'zenithex': 'Expert Quick Play'
        }

        // Initialize message
        let pageData = [];
        for (let i = 0; i < pageCount; i++) {
            pageData.push([]);
        }


        for (let i = 0; i < data.length; i++) {
            let message = "";  // Reset the message for each user
            const user = data[i];
            const userData = user.data;

            

            if (user.type === 'personalbest') {
                message += `<:news_lblocal:1280356184640983122> [${capitalizeFirstLetter(userData.username)}](https://ch.tetr.io/u/${userData.username}) got a new PB in ${gametypeMapping[userData.gametype]}!`

                if (userData.gametype === 'zenith' || userData.gametype === 'zenithex') {
                    message += ` (${Math.round(userData.result*10)/10}m)`
                } else {
                    message += ` (${convertToTimeFormat(userData.result)})`
                } 
            } else if (user.type === 'supporter') {
                message += `<:supporter_star:1277300953111855231> [${userData.username}](https://ch.tetr.io/u/${userData.username}) has become a **TETR.IO Supporter!**`
            } else if (user.type === 'rankup') {
                message += `${getEmojiOfRank(userData.rank)} [${userData.username}](https://ch.tetr.io/u/${userData.username}) achieved ${capitalizeFirstLetter(userData.rank) /*me when i reuse code :3*/} rank!`
            } else {
                message += user.type;
            }
            message += ` (${reformatTimestamp(user.ts)})`;

            

            pageData[Math.floor(i / itemsPerPage)].push(message);
        }

        const pages = [
            new EmbedBuilder()
                .setColor("#d384f5")
                .setTitle(`All News (1)`)
                .setDescription(pageData[0].join('\n')),
            new EmbedBuilder()
                .setColor("#d384f5")
                .setTitle(`All News (2)`)
                .setDescription(pageData[1].join('\n')),
            new EmbedBuilder()
                .setColor("#d384f5")
                .setTitle(`All News (3)`)
                .setDescription(pageData[2].join('\n')),
                new EmbedBuilder()
                .setColor("#d384f5")
                .setTitle(`All News (4)`)
                .setDescription(pageData[3].join('\n')),
            ];

        // Initial row of buttons
		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('allnewspage_0')
				.setLabel('Page 1')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(true), // Disable the first button initially
			new ButtonBuilder()
				.setCustomId('allnewspage_1')
				.setLabel('Page 2')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId('allnewspage_2')
				.setLabel('Page 3')
				.setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
				.setCustomId('allnewspage_3')
				.setLabel('Page 4')
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


function reformatTimestamp(isoString) {
    // Create a Date object from the ISO string
    const date = new Date(isoString);

    // Return the Unix timestamp by dividing the milliseconds by 1000
    return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
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