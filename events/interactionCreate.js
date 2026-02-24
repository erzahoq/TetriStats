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
const { buildPageButtonRows, formatUsername, formatNumber, formatPreciseTime, formatISOString, getClosestRank, getEmojiOfRank, getLeagueStatThresholds, getNextRank } = require("../helpers/formatters");
const { getEmoji } = require("../helpers/emojis");

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
            }
        } catch (error) {
            // unknown interaction, unknown message
            // these are usually discord's fault bc of API latency and stuff
            const ignoredCodes = [10062, 10008];
            if (error instanceof DiscordAPIError && ignoredCodes.includes(error.code)) {
                return;
            }

            console.error(
                error +
                `\nextra info:
    caused by ${interaction.user.username} (${interaction.user.id}) in ${interaction.guild?.name} (${interaction.guild?.id})
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


async function buildAchievementDetailEmbed(ach, listEmbed, username) {
    const lowerIsBetter = (ach.vt === 2 || ach.vt === 3); // time-like
    const closestRank = await getClosestRank(ach.v, `achievements/${ach.n}`, { lowerIsBetter });
    
    const achievementMapping = {
        100: 'issued',
        1: 'bronze',
        2: 'silver',
        3: 'gold',
        4: 'platinum',
        5: 'diamond'
    };


    const e = new EmbedBuilder().setColor(listEmbed?.data?.color || 'ffffff');
    if (listEmbed?.data?.color) {
        e.setColor(listEmbed.data.color);
    }

    const lines = [];

    if (ach.category) lines.push(`### __${formatUsername(username)} -> Achievements -> ${ach.name}__`);

    let achText = ""

    //ok this is the same achtext shit
    //format thing because api silly
    let displayVal = formatNumber(Math.round(ach.v));
    if (ach.vt === 2) displayVal = `${formatPreciseTime(ach.v)}`
    else if (ach.vt === 3) displayVal = `${formatPreciseTime(-ach.v)}`
    else if (ach.vt === 4) displayVal = `${formatNumber(ach.v)}m (Floor ${Math.floor(ach.a)})`
    else if (ach.name === "Guardian Angel") displayVal = `${formatNumber(ach.v)}m` //removed hate speech :3
    else if (ach.vt === 5) displayVal = `Obtained ${formatISOString(new Date(-ach.v).toISOString())}`
    else if (ach.vt === 6) displayVal = formatNumber(-Math.round(ach.v))

    achText += `\n` + getEmoji("ach_" + achievementMapping[ach.rank])

    achText += ` **${displayVal}** ${ach.object} \n` // show the main info

    if (ach.vt === 5) { // if it's issued
        achText += `Issue ${ach.pos}/${ach.total}` 
    } else {
        if (ach.pos < 100) { // if you're in the top 100 players
            achText += `**#${ach.pos + 1}** in the world`
        }
        else {
            let precision = 2;
            const achPercentile = ach.pos / ach.total * 100
            if (achPercentile < 0.01) precision = 3;

            achText += `**#${ach.pos + 1}** in the world (Top ${formatNumber(achPercentile, precision)}%)` // literally just one extra point of precision
        } 
    }

    //duo achievement
    if (ach.x?.ally) {
        const allyUsername = ach.x.ally.username;
        achText += `\n With ${formatUsername(allyUsername)}`;
    }

    achText += `\nAchieved ${formatISOString(new Date(ach.t).toISOString(), true)}`

    //if its not issued:
    if (ach.rank !== 100 && closestRank) {
        //show closest rank and data
        achText += `\n\n**Performance**\nAround ${getEmojiOfRank(closestRank.rank)}`;

        const deltaText = formatAchievementDelta(closestRank.delta, ach);
        if (deltaText) {
            achText += ` (${deltaText})`;
        }

        const nextRank = getNextRank(closestRank.rank);
        if (nextRank) {
            const thresholds = await getLeagueStatThresholds(`achievements/${ach.n}`);

            const rawNext = thresholds?.[nextRank];
            if (rawNext !== undefined && isFinite(Number(rawNext))) {
                const displayV =
                    (ach.vt === 3 || ach.vt === 5 || ach.vt === 6) ? -ach.v : ach.v;
                const nextDisplay =
                    (ach.vt === 3 || ach.vt === 5 || ach.vt === 6) ? -rawNext : rawNext;

                const need = lowerIsBetter
                    ? (displayV - nextDisplay)
                    : (nextDisplay - displayV);

                if (need > 0) {
                    const needText = formatAchievementDelta(need, ach);
                    if (needText) {
                        achText += `\n${needText} to ${getEmojiOfRank(nextRank)} rank`;
                    }
                }
            }
        }
    }


    //check for attributes and format
    if (ach.art > -1) achText += "\n" //sorry (???)
    if (ach.art === 0) {
        achText += `\n${getEmoji('au')} **UNRANKED** / This achievement does not contribute to your Achievement Rating.`
    } else if (ach.art === 2) {
        achText += `\n${getEmoji('ac')} **COMPETITIVE** / This achievement grants extra Achievement Rating to those who place in its Top 100 leaderboard.`
    }
    if (ach.hidden) {
        achText += `\n${getEmoji('ah')} **HIDDEN** / This achievement is only visible to the worthy.`
    }
    if (ach.event) {
        const eventName = ach.event;
        let extraText = '';
        if (ach.category === 'legacy') extraText = " It is no longer available."
        let currentText = 'is part';
        if (ach.category === 'legacy') currentText = "was part"
        achText += `\n${getEmoji('ae')} **EVENT** / This achievement ${currentText} of the ${eventName} event.${extraText}`;
    }

    if (ach.desc) {
        achText += `\n-# *${ach.desc}*`;
    }

    lines.push(achText);

    e.setDescription(lines.join('\n') || 'No extra info available.');

    return e;
};

//stupid vt again aysm
function formatAchievementDelta(delta, ach) {
  if (delta === null || delta === undefined || !isFinite(Number(delta))) return null;

  //vt = ISSUE or NONE, meaning delta is meaningless
  if (ach.vt === 0 || ach.vt === 5) return null;

  const d = Number(delta);
  const sign = d > 0 ? '+' : d < 0 ? '-' : '±';
  const abs = Math.abs(d);

  switch (ach.vt) {
    //TIME (ms, lower is better)
    case 2:
    //TIME_INV (stored negative, but delta already normalized)
    // eslint-disable-next-line no-fallthrough
    case 3:
      return `${sign}${formatNumber(abs / 1000, 2)}s`;

    //FLOOR / altitude (meters)
    case 4:
      return `${sign}${formatNumber(abs, 1)}m`;

    //NUMBER_INV (stored negative, display positive)
    case 6:
      return `${sign}${formatNumber(abs, 0)}`;

    //NUMBER (plain numeric)
    case 1:
    default:
      return `${sign}${formatNumber(abs, 1)}`;
  }
}

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
        await interaction.reply({ content: "This menu expired (or I restarted). Run the command again.", flags: MessageFlags.Ephemeral });
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
