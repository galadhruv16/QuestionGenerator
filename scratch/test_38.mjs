const apiKey = process.env.GEMINI_API_KEY;
const model = 'gemini-3.8-flash';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: 'Respond with JSON: {"status": "ok", "message": "Gemini 3.8 Flash is working"}' }] }],
    generationConfig: { responseMimeType: 'application/json' },
  }),
});

const data = await res.json();
console.log('Status:', res.status);
console.log('Result:', data.candidates?.[0]?.content?.parts?.[0]?.text);
