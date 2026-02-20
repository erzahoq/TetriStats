// Require the necessary discord.js classes
const { Client, Collection, Events, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder  } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { token } = require('./config.json');
const { getEmoji } = require('./helpers/emojis');
const { formatNumber, escapeUnderscores, convertToTimeFormat, reformatTimestamp, formatUsername, buildPageButtonRows } = require('./helpers/formatters');

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

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
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
	} else if (interaction.isStringSelectMenu()) {
        const menuId = interaction.customId;

        // Achievements dropdown
        if (menuId.startsWith("achselect_")) {
            const interactionId = menuId.split("achselect_")[1];
            const pageData = interaction.client.pageData.get(interactionId);
            if (!pageData) return;

            const chosen = interaction.values?.[0];
            if (!chosen || chosen === "achd_none") return;


            const [, pageStr, itemStr] = chosen.split("_");
            const pageIndex = Number(pageStr);
            const itemIndex = Number(itemStr);

            const ach = pageData.pageAchsByPageIndex?.[pageIndex]?.[itemIndex];
            if (!ach) return;

            // make sure not to forgor
            pageData.view = "detail";
            pageData.lastListPage = pageData.currentPage ?? 0;
            pageData.currentPage = pageIndex;

            const detailEmbed = buildAchievementDetailEmbed(ach, pageData.textPages?.[pageIndex], pageData.username);

            const deleteRow = buildDeleteRow(interactionId, pageData.ownerId);

            await interaction.reply({
                embeds: [detailEmbed],
                components: [deleteRow],
            });
        }
    } else if (interaction.isButton()) {
        //generic paging system (yay)
        if (parsePageCustomId(interaction.customId)) {
            const handled = await handleGenericPageButton(interaction);
            if (handled) return;
        }

        const buttonId = interaction.customId;
        const interactionId = interaction.message.interaction?.id;

        // Achievements delete
        if (buttonId.startsWith("achdelete")) {
            const ownerId = buttonId.split("_")[2];
            if (interaction.user.id !== ownerId) {
                return await interaction.reply({ content: 'You cannot interact with this!', ephemeral: true });
            }

            await interaction.deferUpdate();
            await interaction.message.delete().catch(() => {}); // in case message already deleted by user, don't care about error
            return;
        }


        else if (achPageRegex.test(buttonId)) {
            const pageData = interaction.client.pageData?.[interactionId];
            if (!pageData) return;
            const newPageIndex = parseInt(buttonId.split('_')[1]);

            pageData.view = "list";
            pageData.lastListPage = newPageIndex;
            pageData.currentPage = newPageIndex;

            const buttonRows = buildAchButtonRows(pageData, newPageIndex);
            const selectRow = buildAchSelectRow(interactionId, newPageIndex, pageData.pageAchsByPageIndex?.[newPageIndex]);

            await interaction.update({
                embeds: [pageData.textPages[newPageIndex]],
                components: [...buttonRows, selectRow]
            });
        }
    }
});

// Log in to Discord with your client's token
client.login(token);


//Error handling
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

//achievement info stupid stuff (im sorry morky)
function buildAchButtonRows(pageData, activeIndex) {
    for (let i = 0; i < pageData.buttons.length; i++) {
        pageData.buttons[i].setDisabled(activeIndex === i);
    }

    const rows = [];
    for (let i = 0; i < pageData.buttons.length; i++) {
        const rowind = Math.floor(i / 5);
        rows[rowind] = i % 5 === 0 ? new ActionRowBuilder() : rows[rowind];
        rows[rowind].addComponents(pageData.buttons[i]);
    }
    return rows;
}

function buildAchievementDetailEmbed(ach, listEmbed, username) {
    console.log(ach)

    const achievementMapping = {
        100: 'issued',
        1: 'bronze',
        2: 'silver',
        3: 'gold',
        4: 'platinum',
        5: 'diamond'
    };


    const e = new EmbedBuilder().setColor(listEmbed.data.color || 'ffffff');
    if (listEmbed?.data?.color) {
        e.setColor(listEmbed.data.color);
    }

    const lines = [];

    if (ach.rank != null) {
        emoji = getEmoji("ach_" + achievementMapping[ach['rank']]);
    }

    if (ach.category) lines.push(`### __${formatUsername(username)} -> Achievements -> ${ach.name}__`);

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

    achText += `\n` + getEmoji("ach_" + achievementMapping[ach['rank']])

    achText += ` **${displayVal}** ${ach['object']} \n` // show the main info

    if (ach.nolb) { // if it's issued
        achText += `Issue ${ach['pos']}/${ach['total']}` 
    } else {
        if (ach['pos'] < 100) { // if you're in the top 100 players
            achText += `**#${ach['pos'] + 1}** in the world`
        }
        else if (ach['pos'] / ach['total'] < 0.01) { // if you're in the top 1%
            achText += `**#${ach['pos'] + 1}** in the world (Top ${Math.round(ach['pos'] / ach['total'] * 100000) / 1000}%)` // literally just one extra point of precision
        } 
        else { // everything else
            achText += `**#${ach['pos'] + 1}** in the world (Top ${Math.round(ach['pos'] / ach['total'] * 10000) / 100}%)`
        }
    }

    //duo achievement
    if (ach.x?.ally) {
        let allyUsername = ach.x.ally.username;
        achText += `\n With [${escapeUnderscores(allyUsername).toUpperCase()}](https://ch.tetr.io/u/${allyUsername})`;
    }

    //check for attributes and format
    if (ach.art > -1) achText += "\n" //sorry
    if (ach.art === 0) {
        achText += `\n${getEmoji('au')} **UNRANKED** / This achievement does not contribute to your Achievement Rating.`
    } else if (ach.art === 2) {
        achText += `\n${getEmoji('ac')} **COMPETITIVE** / This achievement grants extra Achievement Rating to those who place in its Top 100 leaderboard.`
    }
    if (ach.hidden) {
        achText += `\n${getEmoji('ah')} **HIDDEN** / This achievement is only visible to the worthy.`
    }
    if (ach.event) {
        let eventName = ach.event;
        let extraText = '';
        if (ach.category === 'legacy') extraText = " It is no longer available."
        let currentText = 'is part';
        if (ach.category === 'legacy') currentText = "was part"
        achText += `\n${getEmoji('ae')} **EVENT** / This achievement ${currentText} of the ${eventName} event.${extraText}`;
    }
    // i didn't like this formatting it was ugly imo

    if (ach.desc) {
        achText += `\n\n-# *${ach.desc}*`;
    }

    lines.push(achText);

    e.setDescription(lines.join('\n') || 'No extra info available.');

    return e;
}

//these should be in a helper file but im lazy so
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
                    .setValue("achd_none")
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

function buildDeleteRow(interactionId, ownerId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`achdelete_${interactionId}_${ownerId}`)
            .setLabel("Delete")
            .setStyle(ButtonStyle.Secondary)
    );
}

// ==== new (!) page system ====

// get custom id commandName:page-key-index
function parsePageCustomId(customId) {
    // for example: "league:page-<key>-<pageIndex>"
    const [commandName, rest] = customId.split(':');
    if (!commandName || !rest) return null;

    const parts = rest.split('-');
    if (parts[0] !== 'page') return null;
    if (parts.length < 3) return null;

    const pageIndexStr = parts[parts.length - 1];
    const pageIndex = Number(pageIndexStr);
    if (!Number.isInteger(pageIndex)) return null;

    const key = parts.slice(1, -1).join('-');

    return { commandName, key, pageIndex };
}

async function handleGenericPageButton(interaction) {
    const parsed = parsePageCustomId(interaction.customId);
    if (!parsed) return false;

    const { commandName, key, pageIndex } = parsed;

    const session = interaction.client.pageData.get(key);
    if (!session) {
        await interaction.reply({ content: "This menu expired (or I restarted). Run the command again.", ephemeral: true });
        return true;
    }

    if (session.commandName !== commandName) {
        await interaction.reply({ content: "This button doesn't match this message.", ephemeral: true });
        // this shouldnt ever happen if i did everything correctly but just in case :woomy:
        return true;
    }

    // check owner (surely this works this time)
    if (interaction.user.id !== session.ownerId) {
        await interaction.reply({ content: "You can't interact with this.", ephemeral: true });
        return true;
    }

    if (!session.pages?.[pageIndex]) return true;

    session.currentPage = pageIndex;
    session.expiresAt = Date.now() + (session.ttlMs ?? 10 * 60 * 1000);

    const rows = buildPageButtonRows({
        commandName: session.commandName,
        key,
        labels: session.labels,
        activeIndex: pageIndex
    });

    //let some commands append extra components (e.g. the achievements menu)
    const extra = typeof session.getExtraComponents === 'function'
        ? await session.getExtraComponents(pageIndex)
        : [];

    await interaction.update({
        embeds: [session.pages[pageIndex]],
        components: [...rows, ...extra]
    });

    return true;
}
