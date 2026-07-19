// silly little file to help with cleanliness
// if you have any questions uhhhhhh idk ask santa claus or something
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MessageFlags,
    SectionBuilder,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} = require("discord.js");
const { getEmoji } = require('./emojis');
const { database } = require('../database');

const _leagueStatCache = new Map(); // dbKey -> { thresholds, seen }

const RANK_ORDER = [
    'd','d+','c-','c','c+','b-','b','b+',
    'a-','a','a+','s-','s','s+','ss','u','x','x+'
];

function formatNumber(num, decimalPlaces = 0) {
    const isNegative = num < 0;
    const absNum = Math.abs(num);

    const factor = 10 ** decimalPlaces;
    const rounded = Math.round(absNum * factor) / factor;

    let [integerPart, decimalPart] = rounded.toString().split('.');

    // Add commas
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (decimalPlaces > 0) {
        decimalPart = (decimalPart || '').padEnd(decimalPlaces, '0');
        return `${isNegative ? '-' : ''}${integerPart}.${decimalPart}`;
    }

    return `${isNegative ? '-' : ''}${integerPart}`;
}

function escapeUnderscores(input) {
    const underscoreCount = (input.match(/_/g) || []).length;
    
    // Only escape if the count is a multiple of 2
    if (underscoreCount % 2 === 0 && underscoreCount > 0) {
        return input.replace(/_/g, '\\_');
    }
    
    return input;
}

function countryCodeToEmoji(countryCode) {
    if (countryCode === 'XM') return (getEmoji("flag_xm")); // XM is a special case for TETR.IO's own flag
    if (!countryCode) return ("❔"); //if a country isn't set i guess
    const codePoints = countryCode
        .toUpperCase() // Make sure the code is uppercase
        .split('')     // Split the letters
        .map(char => 127397 + char.charCodeAt()); // Convert to regional indicator symbol

    return String.fromCodePoint(...codePoints);
}

function formatPreciseTime(ms, endPadding = 3) {
    ms = Math.abs(ms);           // normalize to positive
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = formatNumber(totalSeconds % 60, endPadding); // keep milliseconds

    const [intSeconds, fracSeconds] = seconds.split('.');
    const formattedSeconds = intSeconds.padStart(2, '0') + '.' + (fracSeconds || '000').padEnd(endPadding, '0');

    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${formattedSeconds}`; // e.g., 1:02:40.597
    }

    return `${minutes}:${formattedSeconds}`; // e.g., 0:40.597
}

function formatLongTime(seconds, hoursOnly = false) {
    if (seconds === 'Hidden') {
        return seconds;
    } 

    const hours = seconds / 60 / 60;
    if (hoursOnly) {
        return formatNumber(hours, 1) + ' hours';
    }

    const formattedHours = hours % 24;
    const days = Math.floor(hours / 24);

    let result = '';
    if (days > 0) {
        result += `${formatNumber(days)} days, `;
    }
    result += `${formatNumber(formattedHours, 0)} hours`;

    if (hours < 1) {
        const minutes = seconds / 60;
        result = `${formatNumber(minutes, 0)} minutes`;
    }
    return result;
}

function formatGamesPlayed(gamesplayed, gameswon, gamestime) {
    if (gamesplayed > -1) {
        return `\n- Played ${gamesplayed} games
    - Won ${gamesWonConvert(gameswon, gamesplayed)} of them
    -  ${formatLongTime(gamestime, true)} played (${formatLongTime(gamestime)})`;
    }
    return "\n- Has hidden games played";
}

function gamesWonConvert(gamesWon, gamesPlayed) {
    if (
        gamesWon === "Hidden" ||
        gamesPlayed === "Hidden" ||
        gamesPlayed === 0
    ) {
        return gamesWon;
    }

    return `${gamesWon} (${formatNumber((100 * gamesWon) / gamesPlayed, 2)}%)`;
}

function getEmojiOfRank(rank) {
    if (!rank) return;
    const formattedRank = 'rank_' + rank.toLowerCase().replace("+", "plus").replace("-", "minus");
    return getEmoji(formattedRank)
}

function formatISOString(isoString, accountCreation = false) {
    if (!isoString && accountCreation) {
        return "before account creation was tracked"
    } else if (!isoString) {
        return "who knows when"
    }

    const date = new Date(isoString);
    return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

// a magic formula stolen from somewhere online
function calculateLevel(xp) {
    if (xp < 0) return 0;
    return ((xp / 500) ** 0.6) + (xp / (5000 + ((Math.max(0, xp - (4 * 10 ** 6))) / 5000))) + 1
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function getLeagueRankColour(rank) {
    const ratingColours = {
        "z": 0x7d7d7d,
        "d": 0x846b83,
        "d+": 0x8a5d8b,
        "c-": 0x755188,
        "c": 0x733e8f,
        "c+": 0x562a89,
        "b-": 0x5550c5,
        "b": 0x4f65cb,
        "b+": 0x4e99c0,
        "a-": 0x45ca7f,
        "a": 0x6bcb55,
        "a+": 0x4fca18,
        "s-": 0xc8b82d,
        "s": 0xe8b215,
        "s+": 0xffec0e,
        "ss": 0xfeaf1b,
        "u": 0xff2713,
        "x": 0xfd73fc,
        "x+": 0xffbdf5
    };

    return ratingColours[rank];
}

function getModCombos(mods) {
    if (!mods || mods.length === 0) {
        return [];
    }

    let foundEntry = null;

    // define combos
    const combos = [
        //single mods
        { name: "Temperance", mods: ['nohold'], flavour: "Use each piece as they come and embrace the natural flow of stacking." },
        { name: "The Tower", mods: ['gravity'], flavour: "What will you do when it all comes crumbling down?" },
        { name: "The Hermit", mods: ['invisible'], flavour: "When the outside world fails you, trust the voice within to light a path." },
        { name: "Wheel of Fortune", mods: ['messy'], flavour: "The only constant in life is change." },
        { name: "The Magician", mods: ['allspin'], flavour: "Inspiration is nothing short of magic." },
        { name: "The Devil", mods: ['doublehole'], flavour: "Redefine your limits or succumb to his chains." },
        { name: "Strength", mods: ['volatile'], flavour: "Match great obstacles with greater determination." },
        { name: "The Emperor", mods: ['expert'], flavour: "A display of power for those willing to bear its burden." },
        { name: "Rolling the Snowman", mods: ['snowman'], flavour: "\"No matter how many times you've rolled, we all melt in the end.\" - Snowcrates" },
        { name: "Mutation", mods: ['pento'], flavour: "Only a fool would commit heresy this blatantly."},


        //mod combos
        { name: "Deadlock", mods: ['nohold', 'doublehole', 'messy'], flavour: "\"Escape has become a distant dream, yet still we struggle...\"" },
        { name: "The Starving Artist", mods: ['nohold', 'allspin'], flavour: "Creativity cultivated through limitation." },
        { name: "The Grandmaster", mods: ['gravity', 'invisible'], flavour: "When the world descends into chaos, the grandmaster remains at peace." },
        { name: "The Con Artist", mods: ['expert', 'volatile', 'allspin'], flavour: "Would the perfect lie not be an art worthy of admiration?" },
        { name: "Divine Mastery", mods: ['expert', 'doublehole', 'volatile', 'messy'], flavour: "The universe is yours." },
        { name: "A Modern Classic", mods: ['nohold', 'gravity'], flavour: "Times were different back then..." },
        { name: "The Escape Artist", mods: ['doublehole', 'messy', 'allspin'], flavour: "\"An impossible situation! A daring illusionist! Will he make it out alive?\"" },
        { name: "Block Rationing", mods: ['expert', 'messy'], flavour: "Adversity favours the resourceful." },
        { name: "Emperor's Decadence", mods: ['expert', 'doublehole', 'nohold'], flavour: "The Devil's lesson in humility." },
        //any 7 of the 8 mods
        { name: "Swamp Water Lite", allowedMods: ['nohold', 'doublehole', 'messy', 'allspin', 'gravity', 'invisible', 'expert', 'volatile'], count: 7, flavour: "Comes in 8 different flavors!" },
        { name: "Swamp Water", mods: ['nohold', 'doublehole', 'messy', 'allspin', 'gravity', 'invisible', 'expert', 'volatile'], flavour: "The worst of all worlds." },
        { name: "why", mods: ['nohold', 'doublehole', 'messy', 'allspin', 'gravity', 'invisible', 'expert', 'volatile', 'pento'], flavour: "why" },

        //reversed mods
        { name: "Asceticism", mods: ["nohold_reversed"], flavour: "A detachment from even that which is moderate." },
        { name: "Freefall", mods: ["gravity_reversed"], flavour: "In retrospect, the ground you stood on never existed in the first place." },
        { name: "The Exile", mods: ["invisible_reversed"], flavour: "Never underestimate blind faith." },
        { name: "Loaded Dice", mods: ["messy_reversed"], flavour: "In a rigged game, your mind is the only fair advantage." },
        { name: "The Warlock", mods: ["allspin_reversed"], flavour: "Into realms beyond heaven and earth." },
        { name: "Damnation", mods: ["doublehole_reversed"], flavour: "Neither the freedom of life or peace of death." },
        { name: "Last Stand", mods: ["volatile_reversed"], flavour: "Strength isn't necessary for those with nothing to lose." },
        { name: "The Tyrant", mods: ["expert_reversed"], flavour: "Fear, oppression, and limitless ambition." },
        { name: "Permafrost Board", mods: ["snowman_reversed"], flavour: "Immortality achieved through a refusal to melt." },
    ];

    const modsSet = new Set(mods);

    for (const entry of combos) {
        if (entry.mods) {
            const reqSet = new Set(entry.mods);
            if (modsSet.size === reqSet.size && entry.mods.every(m => modsSet.has(m))) {
                foundEntry = entry;
                break;
            }
        } else if (entry.allowedMods && Number.isInteger(entry.count)) {
            // match when mods contains exactly `count` items in allowedMods
            if (modsSet.size === entry.count && [...modsSet].every(m => entry.allowedMods.includes(m))) {
                foundEntry = entry;
                break;
            }
        }
    }

    const emojis = mods
        .map(mod => getEmoji("mod_" + mod))
        .reverse()
        .join(""); // reverse the list and join

    if (foundEntry) {
        // return object
        return { emojis: emojis, name: foundEntry.name, flavour: foundEntry.flavour, mods: mods };
    }

    // no combo matched
    return { emojis: emojis, mods: mods};
}

async function getClosestRank(
    value,
    dbStatKey,
    { lowerIsBetter = false } = {}
) {

    if (value === null || !isFinite(Number(value))) return null;

    // fetch + cache
    if (!getClosestRank._cache) getClosestRank._cache = {};
    if (!getClosestRank._cache[dbStatKey]) {
        const row = await database.LeagueStat.findByPk(dbStatKey);

        // row missing → cache empty
        if (!row || !row.values || Object.keys(row.values).length === 0) {
            console.warn(`[getClosestRank] missing LeagueStat row for ${dbStatKey}`);
            getClosestRank._cache[dbStatKey] = { thresholds: null, seen: null };
            return null;
        }
        getClosestRank._cache[dbStatKey] = {
            thresholds: row?.values ?? {},
            seen: row?.seenCount ?? {}
        };
    }

    const { thresholds, seen } = getClosestRank._cache[dbStatKey];

    let bestRank = null;
    let bestDiff = Infinity;

    for (const rank of RANK_ORDER) {
        const ref = thresholds[rank];
        if (ref === null || ref === undefined || !isFinite(Number(ref))) continue;

        const diff = Math.abs(Number(value) - Number(ref));

        if (diff < bestDiff) {
            bestDiff = diff;
            bestRank = rank;
            continue;
        }

        // tie-break: bias toward better rank
        if (diff === bestDiff && bestRank) {
            const currentRef = thresholds[bestRank];
            const better =
            (!lowerIsBetter && ref > currentRef) ||
            (lowerIsBetter && ref < currentRef);

            if (better) bestRank = rank;
        }
    }

    if (!bestRank) return null;

    const refValue = Number(thresholds[bestRank]);
    const delta = lowerIsBetter
        ? refValue - Number(value)
        : Number(value) - refValue;

    return {
        rank: bestRank,
        refValue,
        delta,              // positive = better
        seen: seen?.[bestRank] ?? null
    };
}

async function getLeagueStatThresholds(dbStatKey) {
    if (!_leagueStatCache.has(dbStatKey)) {
        const row = await database.LeagueStat.findByPk(dbStatKey);
        _leagueStatCache.set(dbStatKey, {
            thresholds: row?.values ?? {},
            seen: row?.seenCount ?? {},
        });
    }
    return _leagueStatCache.get(dbStatKey).thresholds;
}

function getNextRank(rank) {
    const i = RANK_ORDER.indexOf(rank);
    if (i < 0 || i + 1 >= RANK_ORDER.length) return null;
    return RANK_ORDER[i + 1];
}

async function buildStatComparisonLines(
    dbStatKey,
    statName,
    statValue,
    effectiveRank,
    extras = { lowerIsBetter: false, isTime: false, decimals: 2, isPercentage: false }
) {
    if (statValue === null || !isFinite(Number(statValue))) return null;

    const lowerIsBetter = !!extras.lowerIsBetter;
    const decimals = Number.isInteger(extras.decimals) ? extras.decimals : 2;

    const deltaFn = (x, ref) => (lowerIsBetter ? (ref - x) : (x - ref));

    const fmtValue = (value) => {
        if (extras.isTime) {
            const seconds = value / 1000;
            if (value >= 60000) return `${formatPreciseTime(value, 2)}`;
            return formatNumber(seconds, 2) + 's';
        }
        if (extras.isPercentage) return formatNumber(value * 100, 2) + '%';
        return formatNumber(value, decimals);
    };

    const fmtDelta = (deltaValue) => {
        let signWord = deltaValue > 0 ? 'less' : deltaValue === 0 ? '' : 'more';
        if (lowerIsBetter) {
            signWord = deltaValue > 0 ? 'more' : deltaValue === 0 ? '' : 'less';
        }
        if (extras.isTime) return `${formatNumber(Math.abs(deltaValue) / 1000, 2)}s ${signWord}`;
        if (extras.isPercentage) return `${formatNumber(Math.abs(deltaValue * 100), 2)}% ${signWord}`;
        return `${formatNumber(Math.abs(deltaValue), decimals)} ${signWord}`;
    };

    const thresholds = await getLeagueStatThresholds(dbStatKey);

    const around = await getClosestRank(statValue, dbStatKey, { lowerIsBetter });
    const avgRank = around?.rank ?? null;
    const deltaToAvg = around ? deltaFn(statValue, around.refValue) : null;

    let userRankLabel = 'Unranked';
    let userRankValue = null;

    if (effectiveRank && effectiveRank !== 'z') {
        userRankLabel = effectiveRank;
        userRankValue = thresholds?.[effectiveRank];
    }

    const deltaToUser =
    userRankValue !== null && userRankValue !== undefined && isFinite(Number(userRankValue))
        ? deltaFn(statValue, Number(userRankValue))
        : null;

    const displayValue = fmtValue(statValue);

    const lines = [`${getEmojiOfRank(avgRank)} **${displayValue} ${statName}**`];

    const userRankLetter = effectiveRank || null;

    // 1) around line
    if (avgRank && deltaToAvg !== null && avgRank !== userRankLetter) {
        lines.push(`- Closest rank is ${avgRank.toUpperCase()}, with ${fmtDelta(deltaToAvg)}`);
    }

    // 3) next rank line
    if (avgRank && avgRank !== 'x+') {
        const nextRow = getNextRank(avgRank);
        const isRedundant = nextRow && nextRow === userRankLetter;

        if (nextRow && !isRedundant) {
            const nextAvg = thresholds?.[nextRow];
            if (nextAvg !== null && nextAvg !== undefined && isFinite(Number(nextAvg))) {
                lines.push(`- ${nextRow.toUpperCase()} rank has ${fmtDelta(deltaFn(statValue, Number(nextAvg)))}`);
            }
        }
    }

    // 2) compared to current rank
    if (userRankLabel !== 'Unranked') {
        if (deltaToUser !== null) lines.push(`- ${userRankLabel.toUpperCase()} rank has ${fmtDelta(deltaToUser)}`);
        else lines.push(`- wee woo wee woo ${userRankLabel.toUpperCase()}`); // i dont think this ever triggers but if it does uhhhhh :)
    }

    return lines;
}

async function addStatComparisonField(
    target,
    dbStatKey,
    statName,
    statValue,
    effectiveRank,
    extras,
) {
    const lines = await buildStatComparisonLines(
        dbStatKey,
        statName,
        statValue,
        effectiveRank,
        extras,
    );

    if (!lines) return;

    const content = lines.join("\n");

    //components V2 container
    if (
        typeof target.addTextDisplayComponents ===
        "function"
    ) {
        target
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(content),
            )
            .addSeparatorComponents(
                new SeparatorBuilder(),
            );

        return;
    }

    //keep old embed commands working
    if (typeof target.addFields === "function") {
        target.addFields({
            name: "\u200b",
            value: content,
            inline: true,
        });

        return;
    }

    throw new TypeError(
        "addStatComparisonField expected an EmbedBuilder or ContainerBuilder",
    );
}

function formatUsername(name, asLink = true) {
    const formatted = escapeUnderscores(name.toUpperCase());

    if (asLink) {
        return `[${formatted}](https://ch.tetr.io/u/${formatted})`;
    }
    return formatted;
}

function getAvatarUrl(userData) {
    if (userData?.avatar_revision !== undefined) {
        return `https://tetr.io/user-content/avatars/${userData._id}.jpg?rv=${userData.avatar_revision}`;
    }

    return "https://tetr.io/res/avatar.png";
}

function formatAchievementVal(ach, value, val2) {
    if (ach.name === "Guardian Angel") {
        return `${formatNumber(value, 2)}m`;
    }

    switch (ach.vt) {
        case 0:
            return "—";
        case 1:
            return formatNumber(Math.round(value));
        case 2:
            return formatPreciseTime(value);
        case 3:
            return formatPreciseTime(-value);
        case 4:
            return typeof val2 === "number"
                ? `${formatNumber(value, 2)}m (Floor ${Math.floor(val2)})`
                : `${formatNumber(value, 2)}m`;
        case 5:
            return `Obtained ${formatISOString(-value)}`;
        case 6:
            return formatNumber(-Math.round(value));
        default:
            return formatNumber(Math.round(value));
    }
}
function formatAchievement(ach) {
    const achievementMapping = {
        100: 'issued',
        1: 'bronze',
        2: 'silver',
        3: 'gold',
        4: 'platinum',
        5: 'diamond'
    };

    //format thing because api silly
    const displayVal = formatAchievementVal(ach, ach.v, ach.a)
    let achText = getEmoji('ach_' + achievementMapping[ach.rank])

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

    achText += ` **${ach.name}** - **${displayVal}** ${ach.object}` // show the main info

    if (ach.rank === 100) { // if it's issued
        achText += ` (Issue ${ach.pos + 1}/${ach.total})` 
    } else {
        if (ach.pos < 100) { // if you're in the top 100 players
            achText += ` (**#${ach.pos + 1}**)`
        }
        else if (ach.pos / ach.total < 0.01) { // if you're in the top 1%
            achText += ` (Top ${formatNumber(100 * ach.pos / ach.total, 3)}%, #${ach.pos})` // literally just one extra point of precision
        } 
        else { // everything else
            achText += ` (Top ${formatNumber(100 * ach.pos / ach.total, 2)}%)`
        }
    }

    //duo achievement
    if (ach.x?.ally) {
        const allyUsername = ach.x.ally.username;
        achText += ` (With ${formatUsername(allyUsername)})`;
    }

    if (ach.event) {
        const eventName = ach.event;
        achText += ` (${eventName})`
    }

    return achText;
}

// helper to build button rows for paged messages, given the command name, session key, labels, and active index
function buildPageButtonRows({ commandName, key, labels, activeIndex = 0 }) {
    const buttons = labels.map((label, i) =>
        new ButtonBuilder()
            .setCustomId(`${commandName}:page-${key}-${i}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(i === activeIndex)
    );

    const rows = [];
    for (let i = 0; i < buttons.length; i++) {
        const rowIndex = Math.floor(i / 5);
        if (!rows[rowIndex]) rows[rowIndex] = new ActionRowBuilder();
        rows[rowIndex].addComponents(buttons[i]);
    }
    return rows;
}

function buildPageSelectRow({ commandName, key, labels, activeIndex = 0 }) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${commandName}:page-${key}`)
        .setPlaceholder("Select a page")
        .addOptions(
            labels.map((label, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(label)
                    .setValue(String(i))
                    .setDefault(i === activeIndex),
            ),
        );

    return new ActionRowBuilder().addComponents(selectMenu);
}

function buildComponentsV2Page({ commandName, key, labels, activeIndex = 0, content, components = [] }) {
    const container = new ContainerBuilder().setAccentColor(0x80bdff);

    const pageContent = typeof content === "string" ? content : content?.content;
    if (pageContent) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(pageContent),
        );
    }

    const extraComponents = Array.isArray(components) && components.length > 0
        ? components
        : (content?.components ?? []);
    for (const component of extraComponents) {
        if (!component) continue;

        const builderName = component?.constructor?.name;
        switch (builderName) {
            case "ActionRowBuilder":
                container.addActionRowComponents(component);
                break;
            case "SectionBuilder":
                container.addSectionComponents(component);
                break;
            case "SeparatorBuilder":
                container.addSeparatorComponents(component);
                break;
            case "TextDisplayBuilder":
                container.addTextDisplayComponents(component);
                break;
            default:
                break;
        }
    }

    container.addActionRowComponents(
        buildPageSelectRow({ commandName, key, labels, activeIndex }),
    );

    return container;
}

function specialUserContainers(statData, user) {
    const role = statData?.role;
    const username = user?.username;

    if (role === "anon") {
        const section = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`
### __${formatUsername(username)}__
## ANONYMOUS
${escapeUnderscores(username).toUpperCase()} is anonymous, which means they have no statistics, and cannot save replays. Only first seen date is known.

- About:
    - First seen ${formatISOString(statData.ts)}
`),
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder().setURL("https://tetr.io/res/avatar.png"),
            );

        const container = new ContainerBuilder()
            .setAccentColor(0x80bdff)
            .addSectionComponents(section);

        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container],
        };
    }

    if (role === "bot") {
        const embed = new EmbedBuilder()
            .setColor("#80bdff")
            .setThumbnail(
                `https://tetr.io/user-content/avatars/${statData._id}.jpg`,
            )
            .setFooter({ text: `User ID: ${statData._id}` })
            .setDescription(`
### __${formatUsername(username)} -> Quick Look__
## BOT
${escapeUnderscores(username).toUpperCase()} is a known bot, owned by ${String(statData.botmaster || "unknown").toLowerCase()}. Their records are not available, but some general information can be shown.

- About:
    - Account created ${formatISOString(statData.ts)}
    - Level ${formatNumber(Math.floor(calculateLevel(statData.xp)))} (${formatNumber(Math.floor(statData.xp))} XP)
    - Has ${formatNumber(statData.friend_count)} friends
${formatGamesPlayed(statData.gamesplayed, statData.gameswon, statData.gametime) || ""}
`);

        return { embeds: [embed] };
    }

    if (role === "banned") {
        const embed = new EmbedBuilder()
            .setColor("#ff0000")
            .setThumbnail("https://tetr.io/res/avatar-banned.png")
            .setFooter({ text: `User ID: ${statData._id}` })
            .setDescription(`
### __${formatUsername(username)} -> Quick Look__
## BANNED
${escapeUnderscores(username).toUpperCase()} is banned, which means they have no statistics, and cannot save replays. Only first seen date is known.

- About:
    - Account created ${formatISOString(statData.ts)}
`);

        return { embeds: [embed] };
    }

    return null;
}

module.exports = {
    formatNumber,
    escapeUnderscores,
    countryCodeToEmoji,
    formatPreciseTime,
    formatLongTime,
    getEmojiOfRank,
    formatISOString,
    calculateLevel,
    capitalizeFirstLetter,
    getLeagueRankColour,
    getModCombos,
    getClosestRank,
    getLeagueStatThresholds,
    getNextRank,
    formatUsername,
    formatAchievement,
    buildPageButtonRows,
    buildPageSelectRow,
    buildComponentsV2Page,
    buildStatComparisonLines,
    addStatComparisonField,
    formatAchievementVal,
    specialUserContainers,
    getAvatarUrl
}
