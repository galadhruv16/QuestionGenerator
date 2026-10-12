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
  
  // Try calling get_project
  console.log('Calling get_project...');
  const projRes = await rpc('tools/call', {
    name: 'get_project',
    arguments: { name: project },
  });
  
  let screenInstances = [];
  try {
    const text = projRes.result.content[0].text;
    const parsed = JSON.parse(text);
    screenInstances = parsed.screenInstances || [];
    console.log('Project title:', parsed.title);
    console.log('Project updateTime:', parsed.updateTime);
  } catch (e) {
    console.log('Error parsing project:', e);
  }

  console.log(`Found ${screenInstances.length} screen instances in canvas.`);
  for (const inst of screenInstances) {
    console.log(`- ID: ${inst.id}, sourceScreen: ${inst.sourceScreen}, y: ${inst.y || 0}, label: ${inst.label || ''}`);
  }

  // Find screens with largest y or fetch the latest generated ones
  const candidateIds = ['48a84afe637e43cb842cb2f7e1c36d48', 'ee63e19630b847c893021496504f590c', '561668d81283454d87a0b85263094211', '22fa26f9a40d4335bce73e3d69503698'];

  for (const id of candidateIds) {
    const screenName = `${project}/screens/${id}`;
    console.log(`\nFetching screen: ${screenName}`);
    const screenRes = await rpc('tools/call', {
      name: 'get_screen',
      arguments: { name: screenName },
    });

    try {
      const text = screenRes.result.content[0].text;
      const screenObj = JSON.parse(text);
      console.log(`Screen ${id}: title="${screenObj.title}", updateTime="${screenObj.updateTime}"`);
      console.log(`HTML URL present: ${Boolean(screenObj.htmlCode?.downloadUrl)}, Screenshot URL present: ${Boolean(screenObj.screenshot?.downloadUrl)}`);
      
      // If it has html, check title or snippet
      if (screenObj.htmlCode?.downloadUrl) {
        const htmlRes = await fetch(screenObj.htmlCode.downloadUrl);
        const html = await htmlRes.text();
        console.log(`HTML snippet for ${id} (len ${html.length}):`, html.slice(0, 300).replace(/\n/g, ' '));
        
        // Save to scratch
        const filename = `screen_${id}.html`;
        fs.writeFileSync(path.resolve(`scratch/${filename}`), html);
        console.log(`Saved scratch/${filename}`);

        if (screenObj.screenshot?.downloadUrl) {
          const imgRes = await fetch(screenObj.screenshot.downloadUrl);
          const buf = Buffer.from(await imgRes.arrayBuffer());
          fs.writeFileSync(path.resolve(`scratch/screen_${id}.png`), buf);
          console.log(`Saved scratch/screen_${id}.png`);
        }

        // Check if this screen is Generation Studio
        if (html.toLowerCase().includes('generation') || html.toLowerCase().includes('blueprint') || id === candidateIds[0]) {
          console.log(`*** IDENTIFIED GENERATION SCREEN: ${id} ***`);
          fs.writeFileSync(path.resolve('scratch/generation_screen.html'), html);
          if (screenObj.screenshot?.downloadUrl) {
            const imgRes = await fetch(screenObj.screenshot.downloadUrl);
            const buf = Buffer.from(await imgRes.arrayBuffer());
            fs.writeFileSync(path.resolve('scratch/generation_screen.png'), buf);
          }
        }
      }
    } catch (e) {
      console.log(`Error reading screen ${id}:`, e.message);
    }
  }
}

main().catch(console.error);
