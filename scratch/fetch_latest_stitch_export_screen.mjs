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
  console.log('Fetching project details...');
  const projRes = await rpc('tools/call', {
    name: 'get_project',
    arguments: { name: project },
  });

  const projectData = projRes.result.project || (projRes.result.content?.[0]?.text ? JSON.parse(projRes.result.content[0].text) : projRes.result);
  const instances = projectData.screenInstances || [];
  console.log(`Total screen instances: ${instances.length}`);

  const screensInfo = [];

  for (const inst of instances) {
    if (!inst.sourceScreen) continue;
    try {
      const sRes = await rpc('tools/call', {
        name: 'get_screen',
        arguments: { name: inst.sourceScreen },
      });
      const sObj = sRes.result.screen || (sRes.result.content?.[0]?.text ? JSON.parse(sRes.result.content[0].text) : sRes.result);
      screensInfo.push({
        id: inst.id,
        sourceScreen: inst.sourceScreen,
        title: sObj.title || inst.label,
        description: sObj.description,
        createTime: sObj.createTime,
        updateTime: sObj.updateTime,
        htmlUrl: sObj.htmlCode?.downloadUrl,
        screenshotUrl: sObj.screenshot?.downloadUrl,
      });
    } catch (e) {
      console.error(`Failed to fetch ${inst.sourceScreen}:`, e.message);
    }

  }

  // Sort by updateTime descending
  screensInfo.sort((a, b) => new Date(b.updateTime || 0).getTime() - new Date(a.updateTime || 0).getTime());

  console.log('\n=== Top 5 Most Recently Updated Screens ===');
  for (let i = 0; i < Math.min(screensInfo.length, 5); i++) {
    const s = screensInfo[i];
    console.log(`\n#${i + 1}: ${s.title} (ID: ${s.id})`);
    console.log(`Updated: ${s.updateTime}`);
    console.log(`Desc: ${s.description?.slice(0, 120)}`);
    console.log(`Has HTML: ${Boolean(s.htmlUrl)}, Has PNG: ${Boolean(s.screenshotUrl)}`);
  }

  // Download the newest screen
  if (screensInfo.length > 0 && screensInfo[0].htmlUrl) {
    const newest = screensInfo[0];
    console.log(`\nDownloading newest screen (${newest.id})...`);
    const hRes = await fetch(newest.htmlUrl);
    const html = await hRes.text();
    fs.writeFileSync(path.resolve('scratch/export_studio_screen.html'), html);
    console.log(`Saved scratch/export_studio_screen.html (${html.length} bytes)`);

    if (newest.screenshotUrl) {
      const imgRes = await fetch(newest.screenshotUrl);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(path.resolve('scratch/export_studio_screen.png'), buf);
      console.log(`Saved scratch/export_studio_screen.png (${buf.length} bytes)`);
    }
  }
}

main().catch(console.error);
