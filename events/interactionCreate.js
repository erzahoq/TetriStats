const {
    AutocompleteInteraction,
    DiscordAPIError,
    Events,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const { buildPageButtonRows } = require("../helpers/formatters");
const { buildAchievementDetailEmbed } = require("../commands/userstatistics/userachievements");

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);

                if (!command) {
                    console.error(`No command matching ${interaction.commandName} was found.`);
                    return;
                }

                await command.execute(interaction);
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

                    const detailEmbed = await buildAchievementDetailEmbed(ach, pageData.textPages?.[pageIndex], pageData.username);

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

                // Achievements delete
                if (buttonId.startsWith("achdelete")) {
                    const ownerId = buttonId.split("_")[2];
                    if (interaction.user.id !== ownerId) {
                        return await interaction.reply({ content: 'You cannot interact with this!', flags: MessageFlags.Ephemeral });
                    }

                    await interaction.deferUpdate();
                    await interaction.message.delete().catch(() => {}); // in case message already deleted by user, don't care about error
                    return;
                }
            } else if (interaction.isAutocomplete()) {
                const command = interaction.client.commands.get(interaction.commandName);

                if (!command || typeof command.autocomplete !== 'function') {
                    console.error(`No autocomplete handler for ${interaction.commandName} was found.`);
                    return;
                }

                await command.autocomplete(interaction);
            }
        } catch (error) {
            // unknown interaction, unknown message
            // these are usually discord's fault bc of API latency and stuff
            const ignoredCodes = [10062, 10008];
            if (error instanceof DiscordAPIError && ignoredCodes.includes(error.code)) {
                return;
            }

            console.error(error);
            console.error(
                `    caused by ${interaction.user.username} (${interaction.user.id}) in ${interaction.guild?.name} (${interaction.guild?.id})
    ${error.requestBody && error.requestBody.json && error.requestBody.json.data ? JSON.stringify(error.requestBody.json.data) : "no request body available"}`,
            );

            const reply = {
                embeds: [
                    new EmbedBuilder()
                        .setTitle("An error occurred!")
                        .setDescription(
                            `Something went wrong!`
                        )
                        .setColor("#ff5757"),
                ],
                flags: MessageFlags.Ephemeral,
            };
            try {
                if (!(interaction instanceof AutocompleteInteraction)) {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(reply);
                    } else {
                        await interaction.reply(reply);
                    }
                }
            } catch {
                // message was deleted or something
            }
        }
    },
};

//these should be in a helper file but im lazy so

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
        await interaction.reply({ content: "This menu expired! Run the command again.", flags: MessageFlags.Ephemeral });
        return true;
    }

    if (session.commandName !== commandName) {
        await interaction.reply({ content: "This button doesn't match this message.", flags: MessageFlags.Ephemeral });
        // this shouldnt ever happen if i did everything correctly but just in case :woomy:
        return true;
    }

    // check owner (surely this works this time)
    if (interaction.user.id !== session.ownerId) {
        await interaction.reply({ content: "You can't interact with this.", flags: MessageFlags.Ephemeral });
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
