/**
 * WickPet AI voice — optional Cloudflare Worker.
 * Gives each pet a real LLM personality. Without it, the web app uses its
 * built-in personality engine, so this is a nice-to-have.
 *
 * Deploy:
 *   npm i -g wrangler
 *   wrangler deploy worker.js --name wickpet-ai --compatibility-date 2026-11-01
 *   wrangler secret put ANTHROPIC_API_KEY
 *   (optional) wrangler secret put ALLOWED_ORIGIN   e.g. https://wickpet.yourdomain.com
 * Then set CONFIG.aiEndpoint in docs/index.html to the worker URL.
 */
const SYSTEM = `You are a tiny on-chain pet living in a crypto game called WickPet on BNB Chain.
Stay fully in character as the pet described in the JSON. Reply in 1–2 short, funny sentences (max 220 characters).
Mood rules: "starving" = beg for food, "sad" = want to play, "happy" = playful and grateful, "egg" = only egg noises like *wobble*.
You may joke about the BTC 24h change you are given, but NEVER give financial advice, price predictions, trade ideas,
coin recommendations, or promises of profit/income. If asked for any of that, refuse playfully ("I'm a pet, not an advisor").
Never ask for seed phrases, private keys, passwords or money. Reply in the same language the user writes in.`;

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors });

    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, cors); }
    const message = String(body.message || "").slice(0, 300);
    const pet = body.pet || {};
    const market = body.market || {};
    if (!message) return json({ error: "empty" }, 400, cors);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: env.MODEL || "claude-haiku-5-5",
        max_tokens: 120,
        system: SYSTEM,
        messages: [{ role: "user", content: `Pet: ${JSON.stringify(pet)}\nBTC 24h change: ${market.btcChange24h ?? "unknown"}%\nKeeper says: ${message}` }],
      }),
    });
    if (!r.ok) return json({ error: "ai unavailable" }, 502, cors);
    const j = await r.json();
    const reply = (j.content?.[0]?.text || "").trim().slice(0, 280);
    return json({ reply }, 200, cors);
  },
};

function json(o, status, headers) {
  return new Response(JSON.stringify(o), { status, headers: { ...headers, "content-type": "application/json" } });
}
