// silly little file to help with cleanliness
// if you have any questions uhhhhhh idk ask santa claus or something

const { getEmoji } = require('./emojis');

function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

// functions.js
function convertToTimeFormat(inputMs) {
    const ms = Math.abs(inputMs);           // normalize to positive
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(3); // keep milliseconds

    const [intSeconds, fracSeconds] = seconds.split('.');
    const formattedSeconds = intSeconds.padStart(2, '0') + '.' + (fracSeconds || '000').padEnd(3, '0');

    return `${minutes}:${formattedSeconds}`; // e.g., 0:40.597
}


function playtimeConvert(playtime) {
    if (playtime === 'Hidden') {
        return playtime;
    } 
    return `${Math.round((playtime/3600) * 10) / 10} Hours`
}

function getEmojiOfAch(name) { // kinda dumb but whatever, ill fix it later
    return getEmoji(`ach_${name}`)
}

function getModEmoji(emoji) {
    return getEmoji(`mod_${emoji}`)
}

function getEmojiOfRank(rank) {
    if (!rank) {
        return;
    }
    let formattedRank = 'rank_' + rank.toLowerCase().replace("+", "plus").replace("-", "minus");
    return getEmoji(formattedRank)
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

module.exports = {
    formatNumber,
    escapeUnderscores,
    countryCodeToEmoji,
    convertToTimeFormat,
    playtimeConvert,
    getEmojiOfAch,
    getEmojiOfRank,
    reformatTimestamp,
    calculateLevel,
    capitalizeFirstLetter,
    getModEmoji,
    getLeagueRankColour
}