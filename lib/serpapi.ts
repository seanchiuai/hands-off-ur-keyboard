const SERPAPI_BASE = "https://serpapi.com/search.json";

const getApiKey = () => {
  const key = process.env.SERPAPI_KEY;
  if (!key) {
    throw new Error("SERPAPI_KEY is not configured.");
  }
  return key;
};

export async function searchGoogleShopping(query: string) {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    api_key: apiKey,
    num: "10",
  });

  const res = await fetch(`${SERPAPI_BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`SerpAPI shopping request failed: ${res.status}`);
  }
  return await res.json();
}

export async function searchReviewsRedditYouTube(query: string) {
  const apiKey = getApiKey();
  const base = `${SERPAPI_BASE}?api_key=${apiKey}&num=6`;

  const [redditRes, youtubeRes] = await Promise.all([
    fetch(`${base}&engine=google&q=${encodeURIComponent(`site:reddit.com ${query}`)}`),
    fetch(`${base}&engine=youtube&q=${encodeURIComponent(query)}`),
  ]);

  if (!redditRes.ok || !youtubeRes.ok) {
    throw new Error("SerpAPI review search failed");
  }

  const [reddit, youtube] = await Promise.all([
    redditRes.json(),
    youtubeRes.json(),
  ]);

  return { reddit, youtube };
}
