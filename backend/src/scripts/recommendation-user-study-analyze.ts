import fs from 'fs';
import path from 'path';

type RatingRow = {
  participantId: string;
  scenarioId: string;
  methodCode: string;
  rank: number;
  relevanceRating: number;
  outfitCompatibilityRating: number;
  wouldAddToCart: number;
};

const getStringArg = (name: string, fallback: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
};

const parseRating = (value: string, name: string, line: number) => {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error(`Line ${line}: ${name} must be an integer from 1 to 5`);
  }
  return rating;
};

const parseBinary = (value: string, name: string, line: number) => {
  const binary = Number(value);
  if (binary !== 0 && binary !== 1) throw new Error(`Line ${line}: ${name} must be 0 or 1`);
  return binary;
};

const parseCsv = (filePath: string): RatingRow[] => {
  const [header, ...lines] = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const expectedHeader = [
    'participant_id',
    'scenario_id',
    'method_code',
    'rank',
    'product_id',
    'relevance_rating',
    'outfit_compatibility_rating',
    'would_add_to_cart',
  ].join(',');
  if (header !== expectedHeader) throw new Error(`Unexpected CSV header; expected ${expectedHeader}`);

  return lines.filter(Boolean).map((line, index) => {
    const lineNumber = index + 2;
    const values = line.split(',').map((value) => value.trim());
    if (values.length !== 8) throw new Error(`Line ${lineNumber}: expected 8 comma-separated fields`);
    const [participantId, scenarioId, methodCode, rankValue, productId, relevance, compatibility, add] = values;
    const rank = Number(rankValue);
    if (!participantId || !scenarioId || !methodCode || !productId) {
      throw new Error(`Line ${lineNumber}: identifiers cannot be empty`);
    }
    if (!Number.isInteger(rank) || rank < 1 || rank > 5) {
      throw new Error(`Line ${lineNumber}: rank must be an integer from 1 to 5`);
    }
    return {
      participantId,
      scenarioId,
      methodCode,
      rank,
      relevanceRating: parseRating(relevance, 'relevance_rating', lineNumber),
      outfitCompatibilityRating: parseRating(
        compatibility,
        'outfit_compatibility_rating',
        lineNumber,
      ),
      wouldAddToCart: parseBinary(add, 'would_add_to_cart', lineNumber),
    };
  });
};

const mean = (values: number[]) => (
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
);

const round = (value: number) => Number(value.toFixed(4));

const run = () => {
  const defaultInput = path.resolve(
    process.cwd(),
    '..',
    'evaluation',
    'recommendation',
    'user-study',
    'cart-ratings.csv',
  );
  const inputPath = path.resolve(getStringArg('input', defaultInput));
  const rows = parseCsv(inputPath);
  if (!rows.length) throw new Error('The rating CSV contains no observations');

  const methods = [...new Set(rows.map((row) => row.methodCode))].sort();
  const summaries = methods.map((methodCode) => {
    const methodRows = rows.filter((row) => row.methodCode === methodCode);
    return {
      methodCode,
      observations: methodRows.length,
      participants: new Set(methodRows.map((row) => row.participantId)).size,
      scenarios: new Set(methodRows.map((row) => row.scenarioId)).size,
      meanRelevance: round(mean(methodRows.map((row) => row.relevanceRating))),
      meanOutfitCompatibility: round(mean(
        methodRows.map((row) => row.outfitCompatibilityRating),
      )),
      precisionAt5CompatibilityRatingAtLeast4: round(
        methodRows.filter((row) => row.outfitCompatibilityRating >= 4).length / methodRows.length,
      ),
      addToCartIntentRate: round(mean(methodRows.map((row) => row.wouldAddToCart))),
    };
  });

  const listScores = new Map<string, number[]>();
  rows.forEach((row) => {
    const key = `${row.participantId}\u0000${row.scenarioId}\u0000${row.methodCode}`;
    const scores = listScores.get(key) ?? [];
    scores.push(row.outfitCompatibilityRating);
    listScores.set(key, scores);
  });
  const pairedKeys = new Set(rows.map((row) => `${row.participantId}\u0000${row.scenarioId}`));
  const pairedComparisons = [...pairedKeys].flatMap((key) => {
    if (methods.length !== 2) return [];
    const left = listScores.get(`${key}\u0000${methods[0]}`);
    const right = listScores.get(`${key}\u0000${methods[1]}`);
    if (!left?.length || !right?.length) return [];
    return [mean(left) - mean(right)];
  });

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    input: inputPath,
    summaries,
    pairedComparison: methods.length === 2 ? {
      difference: `${methods[0]} minus ${methods[1]}`,
      completeParticipantScenarios: pairedComparisons.length,
      meanCompatibilityDifference: round(mean(pairedComparisons)),
      firstMethodWins: pairedComparisons.filter((value) => value > 0).length,
      ties: pairedComparisons.filter((value) => value === 0).length,
      secondMethodWins: pairedComparisons.filter((value) => value < 0).length,
    } : null,
  }, null, 2));
};

try {
  run();
} catch (error) {
  console.error('User-study analysis failed:', error);
  process.exitCode = 1;
}
