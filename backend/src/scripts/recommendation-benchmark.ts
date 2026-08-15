import fs from 'fs';
import path from 'path';
import {
  runRecommendationBenchmark,
  type RecommendationBenchmarkDataset,
} from '../modules/recommendations/recommendation-benchmark';
import {
  RECOMMENDATION_SCORE_WEIGHTS,
  type RecommendationScoreWeights,
} from '../modules/recommendations/recommendation-scoring';

const getStringArg = (name: string, fallback: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
};

const getPositiveIntegerArg = (name: string, fallback: number) => {
  const value = Number(getStringArg(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
};

const run = () => {
  const defaultInput = path.resolve(
    process.cwd(),
    '..',
    'evaluation',
    'recommendation',
    'data',
    'sample-cases.json',
  );
  const defaultOutput = path.resolve(
    process.cwd(),
    '..',
    'evaluation',
    'recommendation',
    'results',
    'benchmark.json',
  );
  const inputPath = path.resolve(getStringArg('input', defaultInput));
  const outputPath = path.resolve(getStringArg('out', defaultOutput));
  const k = getPositiveIntegerArg('k', 5);
  const weightsArg = getStringArg('weights', '');
  const algorithmVersion = getStringArg('algorithm-version', '');
  const weights = weightsArg
    ? JSON.parse(fs.readFileSync(path.resolve(weightsArg), 'utf8')).weights as RecommendationScoreWeights
    : RECOMMENDATION_SCORE_WEIGHTS;
  const dataset = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as RecommendationBenchmarkDataset;
  const result = runRecommendationBenchmark(
    dataset,
    k,
    weights,
    algorithmVersion || undefined,
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  console.error(`Benchmark written to ${outputPath}`);
};

try {
  run();
} catch (error) {
  console.error('Recommendation benchmark failed:', error);
  process.exitCode = 1;
}
