// ── Netlify Function: load-drive-harvest ─────────────────────────────────────
// Uses Claude API + Google Drive MCP to fetch the two harvest xlsx files
// and return them as base64 to the browser.
// File IDs are fixed — same files Chris has always used.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const DRIVE_FILES = [
  {
    id: "1dXNt1uPxqznitpAzUK0xY52L380y04-t",
    name: "Wednesday Harvest List.xlsx",
  },
  {
    id: "1yVE7Cw6VPyYN34mQvfasTXSlPGzvmWcS",
    name: "Friday Harvest List.xlsx",
  },
];

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const results = [];

    for (const file of DRIVE_FILES) {
      // Call Claude API with Google Drive MCP to download the file
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "mcp-client-2025-04-04",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          mcp_servers: [
            {
              type: "url",
              url: "https://drivemcp.googleapis.com/mcp/v1",
              name: "google-drive",
            },
          ],
          messages: [
            {
              role: "user",
              content: `Download the file with ID "${file.id}" from Google Drive and return ONLY the base64 encoded content of the file, nothing else. No explanation, no markdown, just the raw base64 string.`,
            },
          ],
        }),
      });

      const data = await response.json();

      // Extract the base64 content from the response
      const textContent = data.content
        ?.filter((b) => b.type === "text")
        ?.map((b) => b.text)
        ?.join("")
        ?.trim();

      if (textContent) {
        results.push({ name: file.name, data: textContent });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
