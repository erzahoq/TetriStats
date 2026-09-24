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

function getBarEmoji(rank, ar, leagueRank, top = false) {
    if (leagueRank) {
        return getEmoji(`${top ? 'top' : 'mid'}_${leagueRank}`);
    }

    if (ar === 0) {
        return getEmoji(top ? 'top' : 'mid');
    }

    const competitive = ar === 1 ? 'u_' : '';
    if (top) return getEmoji('top_1st');
    if (rank > 100) return getEmoji('mid');
    if (rank > 25) return getEmoji(`mid_${competitive}t100`);
    if (rank > 10) return getEmoji(`mid_${competitive}t25`);
    if (rank > 5) return getEmoji(`mid_${competitive}t10`);
    if (rank > 3) return getEmoji(`mid_${competitive}t5`);
    if (rank > 0) return getEmoji(`mid_${competitive}t3`);
    return getEmoji('mid');
}

module.exports = { initEmojis, getEmoji, getBarEmoji };