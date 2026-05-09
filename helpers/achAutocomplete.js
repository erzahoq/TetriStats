const { database } = require("../database");

const searchStrings = {};
const idToName = {};

async function autocomplete(interaction) { 
    const focusedValue = interaction.options.getFocused();
    const filtered = await autocompleteResults(focusedValue);
    
    const limited = filtered.slice(0, 25);
    const response = limited.map(id => ({ name: idToName[id], value: id }));

    await interaction.respond(response)
}

async function getChoice(value) {
    if (Number(value)) {
        return value;
    }

    const results = await autocompleteResults(value);
    if (results.length === 0) return null;
    return results[0];
}

async function autocompleteResults(search) {
    if (Object.keys(searchStrings).length === 0) await getAchievementSearchStrings();

    let correctedValue = search.toLowerCase();
    const corrections = {
        "hfd": "highest floor discovered",
        "40l": "40 lines",
        "qp2": "zenith",
        "qp": "zenith",
        "kill": "KO",

        "back to back": "btb",
        "b2b": "btb",
        "btb": "back-to-back",

        "exp": "xp",
        "experience": "xp",
    }
    for (const [key, value] of Object.entries(corrections)) {
        correctedValue = correctedValue.replace(key, value);
    }
    
    const filtered = [];
    for (let i = 0; i < 3; i++) {
        for (const [id, strings] of Object.entries(searchStrings)) {
            if (
                strings[i].toLowerCase().includes(correctedValue.toLowerCase()) 
                && !filtered.some(([filteredId]) => filteredId === id)
            ) filtered.push(id);
        }
    }

    return filtered;
}


async function getAchievementSearchStrings() {
    const aches = await database.Achievement.findAll();
    for (const ach of aches) {
        searchStrings[ach.id] = [ach.name, ach.shortname, ach.objective];
        idToName[ach.id] = ach.name;
    }
}

module.exports = { autocomplete, getChoice }