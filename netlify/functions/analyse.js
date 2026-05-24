exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  try {
    const { imageData, mediaType, crop, daysSince, totalDays } = JSON.parse(event.body);
    const prompt = `This is a tray of ${crop} microgreens at day ${daysSince} of approximately ${totalDays} total growing days.\n\nAnalyse this tray and return ONLY this JSON:\n{\n  "health_score": <0-100>,\n  "health_label": "<Excellent|Good|Fair|Poor>",\n  "stage": "<current growth stage>",\n  "days_to_harvest": <days remaining, 0 if ready now>,\n  "harvest_confidence": "<high|medium|low>",\n  "problems": [<issue strings, empty array if none>],\n  "recommendations": [<actionable strings>],\n  "observations": "<2-3 sentences on density, colour, height, uniformity, moisture>",\n  "pack_ready": <true/false>,\n  "yield_estimate": "<brief yield quality note>"\n}`;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'You are an expert microgreens agronomist for Sky Harvest, a premium microgreens farm in Vancouver BC. Analyse growing tray photos with professional precision. Respond ONLY with valid JSON — no markdown, no text outside the JSON object.',
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
          { type: 'text', text: prompt }
        ]}]
      })
    });
    const data = await response.json();
    if (data.error) return { statusCode: 400, body: JSON.stringify({ error: data.error.message }) };
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: clean };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
