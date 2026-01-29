// silly little file to help with cleanliness
// if you have any questions uhhhhhh idk ask santa claus or something

const { getEmoji } = require('./emojis');

function formatNumber(num, decimalPlaces = 0) {
    let numStr = Math.floor(num).toString();
    numStr = numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (decimalPlaces > 0) {
        const decimal = num - Math.floor(num);
        const decimalStr = decimal.toFixed(decimalPlaces).substring(2);
        numStr += '.' + decimalStr;
    }
    return numStr;
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

function formatTime(inputMs) {
    const ms = Math.abs(inputMs);           // normalize to positive
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(3); // keep milliseconds

    const [intSeconds, fracSeconds] = seconds.split('.');
    const formattedSeconds = intSeconds.padStart(2, '0') + '.' + (fracSeconds || '000').padEnd(3, '0');

    return `${minutes}:${formattedSeconds}`; // e.g., 0:40.597
}

function formatPlaytime(playtime) {
    if (playtime === 'Hidden') {
        return playtime;
    } 

    const hours = playtime % 24;
    const days = Math.floor(hours / 24);

    let result = '';
    if (days > 0) {
        result += `${formatNumber(days)} Days and `;
    }
    result += `${formatNumber(hours, 2)} Hours`;
    return result;
}

function getEmojiOfRank(rank) {
    let formattedRank = 'rank_' + rank.toLowerCase().replace("+", "plus").replace("-", "minus");
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
    return ((xp / 500) ** 0.6) + (xp / (5000 + ((Math.max(0, xp - (4 * 10 ** 6))) / 5000))) + 1
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function getLeagueRankColour(rank) {
    const ratingColours = {
        "z": "#7d7d7d",
        "d": "#846b83",
        "d+": "#8a5d8b",
        "c-": "#755188",
        "c": "#733e8f", 
        "c+": "#562a89",
        "b-": "#5550c5",
        "b": "#4f65cb",
        "b+": "#4e99c0",
        "a-": "#45ca7f",
        "a": "#6bcb55",
        "a+": "#4fca18",
        "s-": "#c8b82d",
        "s": "#e8b215",
        "s+": "#ffec0e",
        "ss": "#feaf1b",
        "u": "#ff2713",
        "x": "#fd73fc",
        "x+": "#f018d0"
    }

    return ratingColours[rank]
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
    return { emojis: emojis, mods: mods };
}

function formatUsername(name, asLink = false) {
    const formatted = escapeUnderscores(name.toUpperCase());

    if (asLink) {
        return `[${formatted}](https://ch.tetr.io/u/${formatted})`;
    }
    return formatted;
}

module.exports = {
    formatNumber,
    escapeUnderscores,
    countryCodeToEmoji,
    formatTime,
    formatPlaytime,
    getEmojiOfRank,
    formatISOString,
    calculateLevel,
    capitalizeFirstLetter,
    getLeagueRankColour,
    getModCombos,
    formatUsername
}