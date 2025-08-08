// Require the necessary discord.js classes
const { Client, Collection, Events, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { token } = require('./config.json');
const { database } = require('./database.js');
const { Op } = require('sequelize');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

/**
 * Generalized page handler for button interactions.
 * Thanks AI :3
 * @param {Object} params
 * @param {Object} params.interaction - The Discord interaction object.
 * @param {string} params.buttonId - The customId of the button.
 * @param {string} params.interactionId - The interaction id for pageData.
 * @param {string} params.prefix - The button customId prefix (e.g. 'profilepage').
 * @param {string} params.pageKey - The key in pageData to use ('pages' or 'textPages').
 * @param {Array<string>} params.labels - The button labels.
 */
async function handlePageButtons({ interaction, buttonId, interactionId, prefix, pageKey, labels }) {
    if (interaction.user.id !== interaction.message.interaction.user.id) {
        return await interaction.reply({ content: 'You cannot interact with this!', ephemeral: true });
    }

    const pageData = interaction.client.pageData?.[interactionId];
    if (!pageData) return;

    const newPageIndex = parseInt(buttonId.split('_')[1]);
    const buttons = labels.map((label, i) =>
        new ButtonBuilder()
            .setCustomId(`${prefix}_${i}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(newPageIndex === i)
    );

    // For achievements, buttons may be split into multiple rows
    let components;
    if (prefix === 'achpage') {
        const rows = [];
        for (let i = 0; i < buttons.length; i++) {
            const rowind = Math.floor(i / 5);
            rows[rowind] = i % 5 === 0 ? new ActionRowBuilder() : rows[rowind];
            rows[rowind].addComponents(buttons[i]);
        }
        components = rows;
    } else {
        components = [new ActionRowBuilder().addComponents(buttons)];
    }

    await interaction.update({
        embeds: [pageData[pageKey][newPageIndex]],
        components
    });

    pageData.currentPage = newPageIndex;
}

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
			} else {
				await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
			}
		}
	} else if (interaction.isButton()) {
        const buttonId = interaction.customId;
        const interactionId = interaction.message.interaction.id;

        // Regexes
        let profilePageRegex = /^profilepage_[0-2]$/;
        let topNewsRegex = /^topnewspage_[0-3]$/;
        let allNewsRegex = /^allnewspage_[0-3]$/;
        let achPageRegex = /^achpage_[0-9]$/;
        let recordsPageRegex = /^recordspage_.*$/;
        let replayPageRegex = /^replaypage_[0-9]$/;

        // Profile pages
        if (profilePageRegex.test(buttonId)) {
            await handlePageButtons({
                interaction, buttonId, interactionId,
                prefix: 'profilepage',
                pageKey: 'pages',
                labels: ['Profile', 'General', 'Gameplay']
            });
        }

        // Records pages
        else if (recordsPageRegex.test(buttonId)) {
            const pageData = interaction.client.pageData?.[interactionId];
            if (!pageData) return;
            const newPageIndex = buttonId.split('_')[1];
            const newPageButtonIndex = parseInt(buttonId.split('_')[2]);
            // Update button states
            for (let i = 0; i < pageData.buttons.length; i++) {
                pageData.buttons[i].setDisabled(newPageButtonIndex === i);
            }
            const row = new ActionRowBuilder();
            pageData.buttons.forEach(but => row.addComponents(but));
            await interaction.update({
                embeds: [pageData.pages[newPageIndex]],
                components: [row]
            });
            pageData.currentPage = newPageIndex;
        }

        // Achievements pages
        else if (achPageRegex.test(buttonId)) {
            const pageData = interaction.client.pageData?.[interactionId];
            if (!pageData) return;
            const newPageIndex = parseInt(buttonId.split('_')[1]);
            for (let i = 0; i < pageData.buttons.length; i++) {
                pageData.buttons[i].setDisabled(newPageIndex === i);
            }
            const rows = [];
            for (let i = 0; i < pageData.buttons.length; i++) {
                const rowind = Math.floor(i / 5);
                rows[rowind] = i % 5 === 0 ? new ActionRowBuilder() : rows[rowind];
                rows[rowind].addComponents(pageData.buttons[i]);
            }
            await interaction.update({
                embeds: [pageData.textPages[newPageIndex]],
                components: rows
            });
            pageData.currentPage = newPageIndex;
        }

        // Top news pages
        else if (topNewsRegex.test(buttonId)) {
            await handlePageButtons({
                interaction, buttonId, interactionId,
                prefix: 'topnewspage',
                pageKey: 'pages',
                labels: ['Page 1', 'Page 2', 'Page 3', 'Page 4']
            });
        }

        // All news pages
        else if (allNewsRegex.test(buttonId)) {
            await handlePageButtons({
                interaction, buttonId, interactionId,
                prefix: 'allnewspage',
                pageKey: 'pages',
                labels: ['Page 1', 'Page 2', 'Page 3', 'Page 4']
            });
        }

        // Replay pages
        else if (replayPageRegex.test(buttonId)) {
            await handlePageButtons({
                interaction, buttonId, interactionId,
                prefix: 'replaypage',
                pageKey: 'pages',
                labels: ['General', 'Stats', 'Tetra League', '4']
            });
        }
    }
});

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    status();
    checkRdAlerts(); 
});

// Log in to Discord with your client's token
client.login(token);

async function checkRdAlerts() {
    console.log('Checking RD alerts...');
    const userList = await database.User.findAll();
    let resp;
    for (const user of userList) {
        resp = await user.checkAlert(); // check if alert is needed
        // console.log(`Checked for ${user.userId}, got ${resp}`);
        if (!(resp instanceof Error) && resp) { // make sure it doesn't error, and also is true
            console.log('Alerting ' + user.userId);
            const userToMessage = await client.users.fetch(user.userId);
            userToMessage.send({
                embeds: [
                    new EmbedBuilder()
                    .setColor('ffdd22')
                    .setDescription('Your Tetra League rating deviation has begun rising!')
                    .setTitle('RD Alert')
            ]}).catch(
                (err) => console.log(`Couldn't alert user ${user.userId}! ${err.message}`) // means we can't DM user, cope
            )
        }
        if (resp instanceof Error) {
            console.log(`RD alert check errored for ${user.userId}! ${resp.message}`);
        }
    }
    console.log('Finished checking RD alerts!');
}

setInterval(checkRdAlerts, 1800000) // every half hour



function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

async function status() {
    try {
        const response = await fetch('https://ch.tetr.io/api/general/stats'); // Get stats data
        let responseData = await response.json();
        let totalAccounts = responseData.data.usercount;

        // console.log('Successfully fetched player count!');
        client.user.setActivity(`${formatNumber(totalAccounts)} players`, { type: ActivityType.Watching });
    } catch (error) {
        console.log(`Couldn't fetch player count! ${error.message}`);
    }
}

// Then set the interval to repeat every 5 minutes
setInterval(status, 300000);
