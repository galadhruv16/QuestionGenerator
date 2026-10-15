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

  console.log('\n=== All Screen Instances ===');
  for (let i = 0; i < screensInfo.length; i++) {
    const s = screensInfo[i];
    console.log(`[${i}] ID: ${s.id} | Title: "${s.title}" | SourceScreen: ${s.sourceScreen}`);
  }

  // Find screens with 'Practice' or 'Mock' or 'Exam' or 'Student' or check the last screen instances
  const match = screensInfo.find(s => /practice|mock|student|exam studio/i.test(s.title)) || screensInfo[screensInfo.length - 1];
  console.log(`\nSelected match: ${match.title} (${match.id})`);

  // Download the matched screen
  if (match && match.htmlUrl) {
    console.log(`\nDownloading matched screen (${match.id}: ${match.title})...`);
    const hRes = await fetch(match.htmlUrl);
    const html = await hRes.text();
    fs.writeFileSync(path.resolve('scratch/practice_studio_screen.html'), html);
    console.log(`Saved scratch/practice_studio_screen.html (${html.length} bytes)`);

    if (match.screenshotUrl) {
      const imgRes = await fetch(match.screenshotUrl);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(path.resolve('scratch/practice_studio_screen.png'), buf);
      console.log(`Saved scratch/practice_studio_screen.png (${buf.length} bytes)`);
    }
  }
}

main().catch(console.error);
