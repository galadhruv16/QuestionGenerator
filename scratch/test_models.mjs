const apiKey = process.env.GEMINI_API_KEY;

const models = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-2.5-pro',
];

for (const name of models) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with JSON: {"status": "ok", "model": "' + name + '"}' }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    const data = await res.json();
    console.log(`[${name}] Status:`, res.status, data.error ? `Error: ${data.error.code} ${data.error.message.slice(0, 100)}` : `Success: ${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}`);
  } catch (err) {
    console.error(`[${name}] Failed:`, err.message);
  }
}
