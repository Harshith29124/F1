const Parser = require('rss-parser');
const parser = new Parser();

const RSS_FEEDS = [
    {
        name: 'Autosport',
        url: 'https://www.autosport.com/rss/f1/news/',
        color: '#e8002d'
    },
    {
        name: 'BBC Sport F1',
        url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml',
        color: '#BB1919'
    },
    {
        name: 'RacingNews365',
        url: 'https://racingnews365.com/feed/news.xml',
        color: '#ff6600'
    },
    {
        name: 'The Race',
        url: 'https://the-race.com/feed/',
        color: '#0088ff'
    }
];

let articles = [];
const seenUrls = new Set();
let broadcastFn = null;
let onNewArticleFn = null;

function init(broadcast, onNewArticle) {
    broadcastFn = broadcast;
    onNewArticleFn = onNewArticle;
}

async function scrapeAll() {
    console.log('[SCRAPER] Scraping news via RSS feeds...');
    const allArticles = [];

    for (const feed of RSS_FEEDS) {
        try {
            const result = await parser.parseURL(feed.url);
            const feedArticles = result.items.slice(0, 5).map(item => ({
                headline: item.title,
                summary: item.contentSnippet || item.content || '',
                url: item.link,
                source: feed.name,
                sourceColor: feed.color,
                publishedAt: item.pubDate || new Date().toISOString(),
                id: item.link,
                timestamp: new Date().toISOString(), // Unified timestamp for internal sorting
                tweetGenerated: false
            }));
            allArticles.push(...feedArticles);
            console.log(`[SCRAPER] Scraped ${feedArticles.length} articles from ${feed.name}`);
        } catch (err) {
            console.error(`[SCRAPER] Failed to scrape ${feed.name}:`, err.message);
        }
    }

    // Sort by date, newest first
    allArticles.sort((a, b) =>
        new Date(b.publishedAt) - new Date(a.publishedAt)
    );

    // Deduplicate and update memory
    let newFound = 0;
    for (const article of allArticles) {
        if (!seenUrls.has(article.url)) {
            seenUrls.add(article.url);
            articles.unshift(article);
            newFound++;

            // Notify via callbacks
            if (broadcastFn) broadcastFn('news', article);
            if (onNewArticleFn) onNewArticleFn(article);
        }
    }

    // Keep only latest 25 articles in memory
    if (articles.length > 25) {
        articles = articles.slice(0, 25);
    }

    console.log(`[SCRAPER] Scrape complete. Added ${newFound} new articles. Total in memory: ${articles.length}`);
    return articles;
}

function getArticles() {
    return [...articles];
}

function markTweetGenerated(url) {
    const a = articles.find(a => a.url === url);
    if (a) a.tweetGenerated = true;
}

module.exports = {
    init,
    scrapeAll,
    getArticles,
    markTweetGenerated
};
