// silly little file to help with cleanliness
// if you have any questions uhhhhhh idk ask santa claus or something

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
    if (countryCode === 'XM') return ("<:flag_xm:1310891739078328374>");
    if (!countryCode) return ("❔"); //if a country isn't set i guess
    const codePoints = countryCode
        .toUpperCase() // Make sure the code is uppercase
        .split('')     // Split the letters
        .map(char => 127397 + char.charCodeAt()); // Convert to regional indicator symbol

    return String.fromCodePoint(...codePoints);
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

function playtimeConvert(playtime) {
    if (playtime === 'Hidden') {
        return playtime;
    } 
    return `${Math.round((playtime/3600) * 10) / 10} Hours`
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
    return `<:ach_${name}:${achEmojis["ach_" + name]}>`
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
    capitalizeFirstLetter
}