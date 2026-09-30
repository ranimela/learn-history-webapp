import { WikipediaCandidate } from "./schemas";

const USER_AGENT = "LearnHistoryWebApp/1.0 (https://github.com/ranimela/learn-history-webapp; ranimel@gmail.com)";

export interface WikipediaArticleExtract {
  pageId: number;
  title: string;
  canonicalUrl: string;
  leadSummary: string;
  fullExtract: string;
  thumbnailUrl?: string;
}

/**
 * Search Wikipedia for title candidates matching the query.
 * Adheres strictly to Wikimedia API User-Agent policy.
 */
export async function searchWikipediaCandidates(query: string): Promise<WikipediaCandidate[]> {
  const url = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(query.trim())}&limit=5`;
  
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Wikimedia search API responded with status ${res.status}`);
    }

    const data = await res.json();
    const pages = data.pages || [];

    return pages.map((p: any) => ({
      pageId: p.id,
      title: p.title,
      description: p.description || p.excerpt ? (p.description || p.excerpt.replace(/<[^>]*>?/gm, "")) : "Historical topic",
      thumbnailUrl: p.thumbnail?.url ? (p.thumbnail.url.startsWith("//") ? `https:${p.thumbnail.url}` : p.thumbnail.url) : undefined,
    }));
  } catch (error) {
    console.error("Wikipedia search failed:", error);
    // Fallback search via opensearch if rest.php fails
    return fallbackSearch(query);
  }
}

async function fallbackSearch(query: string): Promise<WikipediaCandidate[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query.trim())}&limit=5&namespace=0&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    const [, titles, descriptions, urls] = await res.json();
    return titles.map((title: string, idx: number) => ({
      pageId: idx + 1,
      title,
      description: descriptions[idx] || "Historical topic",
    }));
  } catch {
    return [];
  }
}

/**
 * Fetches Wikipedia lead summary and full plain-text extract for a given pageId or title.
 */
export async function fetchWikipediaExtract(pageId: number, title: string): Promise<WikipediaArticleExtract> {
  // 1. Fetch Summary for lead overview & canonical URL
  let leadSummary = "";
  let canonicalUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  let thumbnailUrl: string | undefined;

  try {
    const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (summaryRes.ok) {
      const summaryData = await summaryRes.json();
      leadSummary = summaryData.extract || "";
      if (summaryData.content_urls?.desktop?.page) {
        canonicalUrl = summaryData.content_urls.desktop.page;
      }
      if (summaryData.thumbnail?.source) {
        thumbnailUrl = summaryData.thumbnail.source;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch page summary:", err);
  }

  // 2. Fetch full plain text extract using action=query&prop=extracts&explaintext=1
  const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&pageids=${pageId}&format=json`;
  const extractRes = await fetch(extractUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!extractRes.ok) {
    throw new Error(`Failed to fetch Wikipedia extract for page ID ${pageId}`);
  }

  const extractData = await extractRes.json();
  const pageObj = extractData.query?.pages?.[pageId];

  if (!pageObj || !pageObj.extract) {
    // If pageId query missed, try fallback by title
    const fallbackTitleUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(title)}&format=json`;
    const fallbackRes = await fetch(fallbackTitleUrl, { headers: { "User-Agent": USER_AGENT } });
    const fallbackData = await fallbackRes.json();
    const fallbackPages = fallbackData.query?.pages || {};
    const firstPageKey = Object.keys(fallbackPages)[0];
    const fallbackPage = fallbackPages[firstPageKey];

    if (!fallbackPage?.extract) {
      throw new Error(`Could not find Wikipedia content for "${title}"`);
    }
    return buildCleanExtract(fallbackPage.pageid, fallbackPage.title, canonicalUrl, leadSummary, fallbackPage.extract, thumbnailUrl);
  }

  return buildCleanExtract(pageId, pageObj.title || title, canonicalUrl, leadSummary, pageObj.extract, thumbnailUrl);
}

function buildCleanExtract(
  pageId: number,
  title: string,
  canonicalUrl: string,
  leadSummary: string,
  rawExtract: string,
  thumbnailUrl?: string
): WikipediaArticleExtract {
  // Normalize newlines and strip excessive whitespace
  let cleanExtract = rawExtract
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // If leadSummary is empty, use the first 2 paragraphs of the extract
  if (!leadSummary) {
    const paragraphs = cleanExtract.split("\n\n").filter(p => !p.startsWith("=="));
    leadSummary = paragraphs.slice(0, 2).join(" ");
  }

  // Cap total extract at ~25,000 characters (~5,000 words) while keeping the lead summary intact
  // To avoid cutting off critical sections arbitrarily for massive articles
  if (cleanExtract.length > 25000) {
    cleanExtract = cleanExtract.substring(0, 25000) + "\n\n[Excerpt condensed for quiz generation]";
  }

  return {
    pageId,
    title,
    canonicalUrl,
    leadSummary,
    fullExtract: cleanExtract,
    thumbnailUrl,
  };
}
