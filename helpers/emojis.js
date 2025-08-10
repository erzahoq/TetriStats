//definitely my code and not copied from anywhere else yep mmhmm i would never do that (thanks morky)
let emojiCache = null;

async function initEmojis(client) {
    if (!client.application.name) {
        await client.application.fetch();
    }

    const emojis = await client.application.emojis.fetch();
    emojiCache = new Map();
    let emojiCount = 0;
    emojis.forEach(emoji => {
        emojiCache.set(emoji.name, `<:${emoji.name}:${emoji.id}>`);

        emojiCount++;
    });

    console.log(`Loaded ${emojiCount} emojis into cache.`);
}

function getEmoji(name, alternate = null) {
    if (!emojiCache) {
        return `⬛`; // if emojis aren't initialized yet somehow
    }
    return emojiCache.get(name) || alternate || `:${name}:`;
}

module.exports = { initEmojis, getEmoji };