export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { employerDescription, sponsorsCerts, offersApprenticeships } = req.body;

  if (!employerDescription) {
    return res.status(400).json({ error: 'employerDescription is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable not set' });
  }

  const sponsorLine = sponsorsCerts
    ? 'This employer sponsors certifications for new hires — mention this naturally since it matters a lot to young people who do not have all the required skills yet.'
    : '';
  const apprenticeLine = offersApprenticeships
    ? 'This employer offers apprenticeships and on the job training — mention this naturally as it is a key benefit for someone just starting out.'
    : '';

  const prompt = `You are a career counselor helping rural young adults understand job opportunities. Transform this employer job description into 2-3 sentences that feel honest, human, and accessible to someone who is 17-22 years old considering their first career move. Focus on what the day to day actually feels like. Use plain language, no corporate jargon. Sound like a trusted local adult who knows the employer personally. ${sponsorLine} ${apprenticeLine}

Employer description: ${employerDescription}

Return only the transformed description, nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(500).json({ error: 'Anthropic API error', details: data });
    }

    const studentDescription = data.content?.[0]?.text || null;
    return res.status(200).json({ studentDescription });
  } catch (err) {
    console.error('Transform error:', err);
    return res.status(500).json({ error: err.message });
  }
}
