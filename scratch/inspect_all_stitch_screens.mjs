import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.resolve('c:/Users/Dhruv Gala/Desktop/QuestionGeneration/.env'), 'utf8');
let apiKey = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('STITCH_API_KEY=')) {
    apiKey = line.split('=')[1].trim();
  }
}

async function rpc(method, params = {}) {
  const res = await fetch('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });
  return await res.json();
}

async function main() {
  const project = 'projects/18159740072409548895';
  const projRes = await rpc('tools/call', {
    name: 'get_project',
    arguments: { name: project },
  });
  
  const text = projRes.result.content[0].text;
  const parsed = JSON.parse(text);
  const instances = parsed.screenInstances || [];

  for (const inst of instances) {
    if (!inst.sourceScreen) continue;
    const sRes = await rpc('tools/call', {
      name: 'get_screen',
      arguments: { name: inst.sourceScreen },
    });
    const sText = sRes.result.content[0].text;
    const sObj = JSON.parse(sText);
    console.log(`\n=== Screen ID: ${inst.id} ===`);
    console.log(`Title: ${sObj.title}`);
    console.log(`Description: ${sObj.description?.slice(0, 100)}`);
    console.log(`Create: ${sObj.createTime}, Update: ${sObj.updateTime}`);
    
    if (sObj.htmlCode?.downloadUrl) {
      const hRes = await fetch(sObj.htmlCode.downloadUrl);
      const html = await hRes.text();
      // Search for keywords
      const hasGenerationTab = html.includes('Generation');
      const hasBlueprint = html.includes('Blueprint') || html.includes('blueprint');
      const hasBloom = html.includes('Bloom') || html.includes('bloom');
      console.log(`HTML size: ${html.length}, hasBlueprint: ${hasBlueprint}, hasBloom: ${hasBloom}`);
      
      const saveFile = `scratch/screen_${inst.id}.html`;
      fs.writeFileSync(path.resolve(saveFile), html);

      if (hasBloom && hasBlueprint) {
        console.log(`🎯 FOUND GENERATION STUDIO SCREEN! -> saving to scratch/generation_screen.html`);
        fs.writeFileSync(path.resolve('scratch/generation_screen.html'), html);
        if (sObj.screenshot?.downloadUrl) {
          const imgRes = await fetch(sObj.screenshot.downloadUrl);
          const buf = Buffer.from(await imgRes.arrayBuffer());
          fs.writeFileSync(path.resolve('scratch/generation_screen.png'), buf);
        }
      }
    }
  }
}

main().catch(console.error);
