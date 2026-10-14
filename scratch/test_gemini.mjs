const apiKey = process.env.GEMINI_API_KEY;

for (const model of ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash']) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with JSON: {"status": "ok", "tested_model": "' + model + '"}' }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    const data = await res.json();
    console.log(`Model ${model} Status:`, res.status, 'Response:', data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
  } catch (err) {
    console.error(`Error with ${model}:`, err.message);
  }
}
