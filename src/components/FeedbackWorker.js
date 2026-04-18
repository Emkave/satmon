const COOLDOWN_SECONDS   = 30;
const MAX_MESSAGE_LENGTH = 1000;

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";

    // ── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/feedback") {
      return jsonResponse({ error: "Not found" }, 404, origin);
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    let body;
    try { 
        body = await request.json(); 
    }
    catch { 
        return jsonResponse({ error: "Invalid JSON" }, 400, origin); 
    }

    const message = (body.message || "").trim();
    if (!message)
      return jsonResponse({ error: "Message is required" }, 400, origin);
    if (message.length > MAX_MESSAGE_LENGTH)
      return jsonResponse({ error: "Message too long (max 1000 chars)" }, 400, origin);

    const VALID_LABELS = ["bug", "question", "feedback"];
    const label = VALID_LABELS.includes(body.label) ? body.label : "feedback";

    // ── IP-based rate limiting ──────────────────────────────────────────────
    const ip = request.headers.get("CF-Connecting-IP")
            || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
            || "unknown";

    const kvKey  = `rl:${ip}`;
    const lastTs = await env.RATE_LIMIT.get(kvKey);
    if (lastTs) {
      const elapsed = Date.now() - parseInt(lastTs, 10);
      if (elapsed < COOLDOWN_SECONDS * 1000) {
        const wait = Math.ceil((COOLDOWN_SECONDS * 1000 - elapsed) / 1000);
        return jsonResponse(
          { error: `Rate limited. Please wait ${wait}s before sending another message.` },
          429, origin
        );
      }
    }

    // ── Create GitHub issue ─────────────────────────────────────────────────
    const { GITHUB_TOKEN: token, GITHUB_OWNER: owner, GITHUB_REPO: repo } = env;
    if (!token || !owner || !repo)
      return jsonResponse({ error: "Server misconfiguration" }, 500, origin);

    const issueRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: "POST",
        headers: {
          "Authorization":        `Bearer ${token}`,
          "Accept":               "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent":           "satmon-feedback-worker",
          "Content-Type":         "application/json",
        },
        body: JSON.stringify({
          title:  `[${label}] ${message.slice(0, 72)}${message.length > 72 ? "…" : ""}`,
          body:   message,
          labels: [label],
        }),
      }
    );

    if (!issueRes.ok) {
      const err = await issueRes.json().catch(() => ({}));
      console.error("GitHub Issues error:", issueRes.status, err);
      return jsonResponse({ error: "Failed to submit feedback" }, 502, origin);
    }

    const issue = await issueRes.json();

    // ── Record rate-limit timestamp ─────────────────────────────────────────
    await env.RATE_LIMIT.put(kvKey, String(Date.now()), {
      expirationTtl: COOLDOWN_SECONDS + 5,
    });

    return jsonResponse({ ok: true, id: issue.number, url: issue.html_url }, 200, origin);
  },
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}