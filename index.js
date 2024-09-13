// Require the necessary discord.js classes
const { Client, Collection, Events, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { token } = require('./config.json');

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
        
        //regex thing
        let profilePageRegex = new RegExp('profilepage_[0-2]');
        let topNewsRegex = new RegExp('topnewspage_[0-3]');
        let allNewsRegex = new RegExp('allnewspage_[0-3]');
        let achPageRegex = new RegExp('achpage_[0-9]'); //good job morky
        let recordsPageRegex = new RegExp('recordspage_[0-9]');
        //handle "userinfo.js" buttons
        if (profilePageRegex.test(buttonId)) {
            if (interaction.user.id !== interaction.message.interaction.user.id) {
                return await interaction.reply({content: 'You cannot interact with this!', ephemeral: true});
            }

            // Retrieve stored page data
            const pageData = interaction.client.pageData?.[interactionId];
            if (!pageData) return; // Exit if no page data is found

            const { pages, currentPage } = pageData;
            const newPageIndex = parseInt(buttonId.split('_')[1]);

            // Create updated buttons with the correct page disabled
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('profilepage_0')
                    .setLabel('General')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 0),
                new ButtonBuilder()
                    .setCustomId('profilepage_1')
                    .setLabel('Records')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 1),
                new ButtonBuilder()
                    .setCustomId('profilepage_2')
                    .setLabel('Tetra League')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 2)
            );

            // Update interaction with the selected page
            await interaction.update({
                embeds: [pages[newPageIndex]],
                components: [row]
            });

            // Update current page index
            interaction.client.pageData[interactionId].currentPage = newPageIndex;
        }

        if (recordsPageRegex.test(buttonId)) {
            if (interaction.user.id !== interaction.message.interaction.user.id) {
                return await interaction.reply({content: 'You cannot interact with this!', ephemeral: true});
            }

            // Retrieve stored page data
            const pageData = interaction.client.pageData?.[interactionId];

            if (!pageData) return; // Exit if no page data is found

            const { pages, currentPage, buttons } = pageData;
            const newPageIndex = parseInt(buttonId.split('_')[1]);

            // Create updated buttons with the correct page disabled
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].setDisabled(newPageIndex === i);
            }

            const row = new ActionRowBuilder();
            buttons.forEach(but => {
                row.addComponents(but);
            })

            // Update interaction with the selected page
            await interaction.update({
                embeds: [textPages[newPageIndex]],
                components: [row]
            });

            // Update current page index
            interaction.client.pageData[interactionId].currentPage = newPageIndex;
        }

        //handle "achinfo.js" buttons
        if (achPageRegex.test(buttonId)) {
            if (interaction.user.id !== interaction.message.interaction.user.id) {
                return await interaction.reply({content: 'You cannot interact with this!', ephemeral: true});
            }

            // Retrieve stored page data
            const pageData = interaction.client.pageData?.[interactionId];

            if (!pageData) return; // Exit if no page data is found

            const { textPages, currentPage, buttons } = pageData;
            const newPageIndex = parseInt(buttonId.split('_')[1]);

            // Create updated buttons with the correct page disabled
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].setDisabled(newPageIndex === i);
            }

            const row = new ActionRowBuilder();
            buttons.forEach(but => {
                row.addComponents(but);
            })


            // Update interaction with the selected page
            await interaction.update({
                embeds: [textPages[newPageIndex]],
                components: [row]
            });

            // Update current page index
            interaction.client.pageData[interactionId].currentPage = newPageIndex;
        }

        //handle "topnews.js" buttons
        if (topNewsRegex.test(buttonId)) {
            if (interaction.user.id !== interaction.message.interaction.user.id) {
                return await interaction.reply({content: 'You cannot interact with this!', ephemeral: true});
            }

            // Retrieve stored page data
            const pageData = interaction.client.pageData?.[interactionId];
            if (!pageData) return; // Exit if no page data is found

            const { pages, currentPage } = pageData;
            const newPageIndex = parseInt(buttonId.split('_')[1]);

            // Create updated buttons with the correct page disabled
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('topnewspage_0')
                    .setLabel('Page 1')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 0),
                new ButtonBuilder()
                    .setCustomId('topnewspage_1')
                    .setLabel('Page 2')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 1),
                new ButtonBuilder()
                    .setCustomId('topnewspage_2')
                    .setLabel('Page 3')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 2),
                new ButtonBuilder()
                    .setCustomId('topnewspage_3')
                    .setLabel('Page 4')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 3)
                
            );

            // Update interaction with the selected page
            await interaction.update({
                embeds: [pages[newPageIndex]],
                components: [row]
            });

            // Update current page index
            interaction.client.pageData[interactionId].currentPage = newPageIndex;
        }

        //handle "allnews.js" buttons
        if (allNewsRegex.test(buttonId)) {
            if (interaction.user.id !== interaction.message.interaction.user.id) {
                return await interaction.reply({content: 'You cannot interact with this!', ephemeral: true});
            }

            // Retrieve stored page data
            const pageData = interaction.client.pageData?.[interactionId];
            if (!pageData) return; // Exit if no page data is found

            const { pages, currentPage } = pageData;
            const newPageIndex = parseInt(buttonId.split('_')[1]);

            // Create updated buttons with the correct page disabled
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('allnewspage_0')
                    .setLabel('Page 1')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 0),
                new ButtonBuilder()
                    .setCustomId('allnewspage_1')
                    .setLabel('Page 2')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 1),
                new ButtonBuilder()
                    .setCustomId('allnewspage_2')
                    .setLabel('Page 3')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 2),
                new ButtonBuilder()
                    .setCustomId('allnewspage_3')
                    .setLabel('Page 4')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPageIndex === 3)
                
            );

            // Update interaction with the selected page
            await interaction.update({
                embeds: [pages[newPageIndex]],
                components: [row]
            });

            // Update current page index
            interaction.client.pageData[interactionId].currentPage = newPageIndex;
        }
	}
});

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
client.login(token);
