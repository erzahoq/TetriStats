const { uuid } = require('uuid');

// according to the API, X-Session-ID is a good idea, but also not sometimes (??) https://tetr.io/about/api/
// i think it's smth to do with caching but we're already handling it clientside so idk
let sessionId;
const cache = {};

// using this also has the advantage that we can implement ratelimiting later if we need to
async function fetchCached(url) {
    if (cache[url] && cache[url].cache.cached_until > Date.now()) {
        return cache[url];
    }
    if (!sessionId) {
        sessionId = uuid.v4();
    }

    const response = await fetch(url, {
        headers: {
            'X-Session-ID': sessionId,
            'User-Agent': "TetriStats-Discord-Bot/0.1 by @erzahoq"
        }
    });
    const data = await response.json();

    if (data.cache && data.cache.cached_until && data.success) {
        cache[url] = data;
    }

    return response;
}

function cleanCache() {
    const now = Date.now();
    for (const url in cache) {
        if (cache[url].cache.cached_until < now) {
            delete cache[url];
        }
    }
}

function startCacheCleaner() {
    setInterval(cleanCache, 1000 * 60 * 5);
}

module.exports = {
    fetchCached,
    startCacheCleaner
};