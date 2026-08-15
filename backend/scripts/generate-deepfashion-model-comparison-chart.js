const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const subsetDir = path.join(backendRoot, 'docs_vs', 'deepfashion-subset');

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=') || ''];
  }),
);

const clipPath = path.resolve(backendRoot, args.get('clip') || 'docs_vs/deepfashion-subset/results-clip.csv');
const fashionClipPath = path.resolve(
  backendRoot,
  args.get('fashionclip') || 'docs_vs/deepfashion-subset/results-fashionclip.csv',
);
const outputPath = path.resolve(
  backendRoot,
  args.get('output') || 'docs_vs/deepfashion-subset/deepfashion-model-comparison-chart.svg',
);

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function readSingleResult(csvPath) {
  const lines = fs
    .readFileSync(csvPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(`CSV does not contain a result row: ${csvPath}`);
  }

  const headers = parseCsvLine(lines[0]);
  const values = parseCsvLine(lines[1]);
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));

  for (const [key, value] of Object.entries(row)) {
    const numberValue = Number(value);
    if (value !== '' && Number.isFinite(numberValue)) {
      row[key] = numberValue;
    }
  }

  return row;
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatScore(value) {
  return (Math.round((value + 1e-9) * 1000) / 1000).toFixed(3);
}

const clip = readSingleResult(clipPath);
const fashion = readSingleResult(fashionClipPath);
const queryCount = fashion.queryCount || clip.queryCount || 0;

const width = 1200;
const height = 760;
const quality = {
  x: 60,
  y: 96,
  w: 1080,
  h: 374,
  plotX: 90,
  plotY: 140,
  plotW: 1020,
  plotH: 280,
};
const latency = {
  x: 60,
  y: 506,
  w: 1080,
  h: 204,
  plotX: 220,
  plotY: 550,
  plotW: 760,
  plotH: 130,
};

const qualityMetrics = [
  ['recallAt1', 'Recall@1'],
  ['recallAt5', 'Recall@5'],
  ['recallAt10', 'Recall@10'],
  ['precisionAt5', 'Precision@5'],
  ['precisionAt10', 'Precision@10'],
  ['mrr', 'MRR'],
  ['ndcgAt10', 'NDCG@10'],
];

const qualityBars = qualityMetrics
  .map(([key, label], index) => {
    const groupX = 125 + index * 140;
    const fashionValue = Number(fashion[key]);
    const clipValue = Number(clip[key]);
    const fashionH = Math.round(fashionValue * quality.plotH);
    const clipH = Math.round(clipValue * quality.plotH);
    const fashionY = quality.plotY + quality.plotH - fashionH;
    const clipY = quality.plotY + quality.plotH - clipH;

    return `  <g>
    <rect x="${groupX}" y="${fashionY}" width="24" height="${fashionH}" class="fashion"/>
    <rect x="${groupX + 30}" y="${clipY}" width="24" height="${clipH}" class="clip"/>
    <text x="${groupX + 12}" y="${fashionY - 8}" text-anchor="middle" class="value">${formatScore(fashionValue)}</text>
    <text x="${groupX + 42}" y="${clipY - 8}" text-anchor="middle" class="value">${formatScore(clipValue)}</text>
    <text x="${groupX + 27}" y="444" text-anchor="middle" class="label">${esc(label)}</text>
  </g>`;
  })
  .join('\n');

const maxLatency = Math.max(200, Math.ceil(Math.max(fashion.avgLatencyMs, clip.avgLatencyMs) / 50) * 50);
const latencyTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxLatency * ratio));

function latencyBar(x, row, label, className) {
  const value = Number(row.avgLatencyMs);
  const barH = Math.round((value / maxLatency) * latency.plotH);
  const y = latency.plotY + latency.plotH - barH;

  return `  <g>
    <rect x="${x}" y="${y}" width="70" height="${barH}" class="${className}"/>
    <text x="${x + 35}" y="${y - 8}" text-anchor="middle" class="value">${value.toFixed(1)} ms</text>
    <text x="${x + 35}" y="704" text-anchor="middle" class="label">${esc(label)}</text>
  </g>`;
}

const latencyGrid = latencyTicks
  .map((tick) => {
    const y = latency.plotY + latency.plotH - (tick / maxLatency) * latency.plotH;
    return `  <line x1="${latency.plotX}" y1="${y}" x2="${latency.plotX + latency.plotW}" y2="${y}" class="grid"/>
  <text x="172" y="${y + 4}" class="tick">${tick}</text>`;
  })
  .join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">DeepFashion visual retrieval comparison</title>
  <desc id="desc">Grouped bar charts comparing FashionCLIP and CLIP ViT-B/32 on retrieval quality metrics and offline embedding latency.</desc>
  <defs>
    <style>
      .title { font: 600 28px Arial, sans-serif; fill: #172033; }
      .subtitle { font: 400 15px Arial, sans-serif; fill: #526071; }
      .panel-title { font: 600 18px Arial, sans-serif; fill: #172033; }
      .axis { stroke: #2c3442; stroke-width: 1.2; }
      .grid { stroke: #d9dee7; stroke-width: 1; }
      .tick { font: 400 12px Arial, sans-serif; fill: #526071; }
      .label { font: 500 12px Arial, sans-serif; fill: #263244; }
      .value { font: 600 11px Arial, sans-serif; fill: #172033; }
      .legend { font: 500 13px Arial, sans-serif; fill: #263244; }
      .fashion { fill: #2f855a; }
      .clip { fill: #2b6cb0; }
      .frame { fill: none; stroke: #c7cfda; stroke-width: 1; }
    </style>
  </defs>

  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="60" y="46" class="title">DeepFashion Image Retrieval: FashionCLIP vs CLIP</text>
  <text x="60" y="74" class="subtitle">Subset: ${queryCount} queries, 1,000 gallery images. Higher is better for retrieval metrics; lower is better for latency.</text>

  <rect x="${quality.x}" y="${quality.y}" width="${quality.w}" height="${quality.h}" class="frame"/>
  <text x="80" y="124" class="panel-title">Retrieval quality metrics</text>

  <rect x="882" y="108" width="14" height="14" class="fashion"/>
  <text x="904" y="120" class="legend">FashionCLIP</text>
  <rect x="1004" y="108" width="14" height="14" class="clip"/>
  <text x="1026" y="120" class="legend">CLIP ViT-B/32</text>

  <line x1="${quality.plotX}" y1="${quality.plotY + quality.plotH}" x2="${quality.plotX + quality.plotW}" y2="${quality.plotY + quality.plotH}" class="axis"/>
  <line x1="${quality.plotX}" y1="${quality.plotY}" x2="${quality.plotX}" y2="${quality.plotY + quality.plotH}" class="axis"/>
  <line x1="90" y1="420" x2="1110" y2="420" class="grid"/>
  <line x1="90" y1="350" x2="1110" y2="350" class="grid"/>
  <line x1="90" y1="280" x2="1110" y2="280" class="grid"/>
  <line x1="90" y1="210" x2="1110" y2="210" class="grid"/>
  <line x1="90" y1="140" x2="1110" y2="140" class="grid"/>
  <text x="58" y="424" class="tick">0.00</text>
  <text x="58" y="354" class="tick">0.25</text>
  <text x="58" y="284" class="tick">0.50</text>
  <text x="58" y="214" class="tick">0.75</text>
  <text x="58" y="144" class="tick">1.00</text>
  <text x="74" y="132" class="tick" transform="rotate(-90 74 132)">score</text>

${qualityBars}

  <rect x="${latency.x}" y="${latency.y}" width="${latency.w}" height="${latency.h}" class="frame"/>
  <text x="80" y="534" class="panel-title">Offline embedding latency</text>
  <text x="80" y="558" class="subtitle">Measured during offline evaluation. Lower is better.</text>

  <line x1="${latency.plotX}" y1="${latency.plotY + latency.plotH}" x2="${latency.plotX + latency.plotW}" y2="${latency.plotY + latency.plotH}" class="axis"/>
  <line x1="${latency.plotX}" y1="${latency.plotY}" x2="${latency.plotX}" y2="${latency.plotY + latency.plotH}" class="axis"/>
${latencyGrid}
  <text x="204" y="542" class="tick" transform="rotate(-90 204 542)">milliseconds</text>

${latencyBar(430, fashion, 'FashionCLIP', 'fashion')}
${latencyBar(700, clip, 'CLIP ViT-B/32', 'clip')}
</svg>
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, svg, 'utf8');

console.log(`Generated ${path.relative(process.cwd(), outputPath)}`);
