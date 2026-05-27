// analyse — SkyHarvest Tray Health AI
// Modern Netlify function format (ES modules)

export default async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { imageData, mediaType, crop, daysSince, totalDays } = await req.json();

    const prompt = `This is a tray of ${crop} microgreens at day ${daysSince} of approximately ${totalDays} total growing days.

Analyse this tray and return ONLY this JSON:
{
  "health_score": <0-100>,
  "health_label": "<Excellent|Good|Fair|Poor>",
  "stage": "<current growth stage>",
  "days_to_harvest": <days remaining, 0 if ready now>,
  "harvest_confidence": "<high|medium|low>",
  "primary_concern": "<main issue or null if healthy>",
  "recommendation": "<one specific action or null>"
}`;

    const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500, headers: corsHeaders,
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: corsHeaders,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    });
  }
};

export const config = {
  path: '/api/analyse',
};
