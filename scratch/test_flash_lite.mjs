import fs from 'fs';

const envContent = fs.readFileSync('apps/api/.env', 'utf-8');
const keyMatch = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
const key = keyMatch ? keyMatch[1].trim() : '';

const models = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

for (const model of models) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  console.log('Testing model:', model);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Output JSON: {"status": "ok", "message": "hello"}' }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    console.log('Status:', res.status, 'Latency:', Date.now() - start, 'ms');
    const text = await res.text();
    console.log('Body:', text.slice(0, 200));
  } catch (err) {
    console.log('Error:', err.message);
  }
}
