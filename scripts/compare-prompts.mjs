// Task #04: compare prompts A/B/C for clarity, consistency and factual agreement.
// Default: scores the recorded outputs in docs/prompt-eval/outputs.json.
// --live: regenerates outputs with the real API (needs ANTHROPIC_API_KEY), 3 runs per prompt.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseModelJson, createLiveModel, withTimeout } from '../src/explain/adapter.js';
import { validateExplanation, countSentences } from '../src/explain/validateExplanation.js';
import { SYSTEM_PROMPTS } from '../src/explain/prompts.js';

const DATA = 'docs/prompt-eval/outputs.json';
const data = JSON.parse(readFileSync(DATA, 'utf8'));

if (process.argv.includes('--live')) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }
  for (const p of Object.keys(SYSTEM_PROMPTS)) {
    const model = createLiveModel({ apiKey, model: process.env.LLM_MODEL || 'claude-haiku-5-5', promptVariant: p });
    data.outputs[p] = [];
    for (const s of data.scenarios) data.outputs[p].push(await withTimeout((sig) => model(s.facts, sig), 10000));
  }
  data.note = `Live run ${new Date().toISOString()}`;
  writeFileSync(DATA, JSON.stringify(data, null, 2));
}

const rows = [];
const summary = {};
for (const [prompt, outputs] of Object.entries(data.outputs)) {
  const lengths = [];
  let contractOk = 0;
  let factualOk = 0;
  let twoSentences = 0;
  outputs.forEach((raw, i) => {
    const facts = data.scenarios[i].facts;
    let text = raw;
    let contract = 'ok';
    try { text = parseModelJson(raw); contractOk++; } catch { contract = 'not JSON'; }
    const v = validateExplanation(text, facts);
    if (v.ok) factualOk++;
    const sentences = countSentences(text);
    if (sentences <= 2) twoSentences++;
    lengths.push(text.length);
    rows.push(`| ${prompt} | ${data.scenarios[i].name} | ${contract} | ${v.ok ? 'pass' : v.reason} | ${sentences} | ${text.length} |`);
  });
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length);
  summary[prompt] = { contractOk, factualOk, twoSentences, n: outputs.length, mean: Math.round(mean), sd: Math.round(sd) };
}

const md = [
  `Source: ${data.note}`,
  '',
  '| Prompt | Scenario | JSON contract | Validator (fact agreement) | Sentences | Chars |',
  '|---|---|---|---|---|---|',
  ...rows,
  '',
  '| Prompt | JSON contract | Factual agreement | ≤ 2 sentences | Mean length (chars) | Length SD |',
  '|---|---|---|---|---|---|',
  ...Object.entries(summary).map(([p, s]) =>
    `| ${p} | ${s.contractOk}/${s.n} | ${s.factualOk}/${s.n} | ${s.twoSentences}/${s.n} | ${s.mean} | ${s.sd} |`)
].join('\n');
writeFileSync('docs/prompt-eval/results.md', `${md}\n`);
console.log(md);
