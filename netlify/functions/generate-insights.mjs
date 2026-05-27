// generate-insights — SkyHarvest AI narrative proxy
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: corsHeaders,
    });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'No prompt provided' }), {
        status: 400, headers: corsHeaders,
      });
    }

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
        max_tokens: 1600,
        messages: [{ role: 'user', content: prompt }],
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
  path: '/api/generate-insights',
};
