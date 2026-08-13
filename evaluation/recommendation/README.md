# Recommendation benchmark

This folder contains the reproducible offline evaluation for the three deployed
recommendation contexts. Raw public datasets are downloaded locally and remain
untracked; benchmark code, configuration, compact results, and thesis charts
stay in the repository.

The thesis workflow is split into three independent notebooks because Home,
Product Detail, and Cart have different relevance definitions, candidate sets,
baselines, and primary metrics:

- `notebooks/home_recommendation_evaluation.ipynb`: Amazon chronological
  next-positive-item data; 201-point grid; Most Popular baseline.
- `notebooks/product_detail_recommendation_evaluation.ipynb`: Amazon similar
  item proxy; 672 distinct coarse/fine configurations (682 generated minus 10
  overlapping boundary points); cosine baseline.
- `notebooks/cart_recommendation_evaluation.ipynb`: Polyvore outfit completion;
  1,771-point simplex grid; Association Lift baseline and official FITB@1.

Each notebook owns its data audit, validation tuning, five-fold stability audit,
locked final evaluation, and context-specific conclusion. They use only the
Python standard library plus IPython supplied by Jupyter.

The committed `data/sample-cases.json` file is only a schema and smoke-test
fixture. Its output is not research evidence and must not be reported in the
thesis.

## What is compared

Every method receives the same candidate set, filtering, Top-K value, and
diversity reranking. Only the ranking score changes.

| Context | Traditional baseline | Project score selected on validation |
| --- | --- | --- |
| Home | Most-popular: `score(i) = normalized training popularity(i)` | Offline optimum: `1.00 preferenceMatch`; production may reserve `0.10 business` |
| Product Detail | Cosine similarity on a binary metadata vector | v7: `0.125 weightedAttributeSimilarity + 0.875 cosineSimilarity` |
| Cart | Association rule: rank by lift from training baskets | Offline optimum: `0.60 styleCompatibility + 0.40 associationLift` |

The proposed weights are imported from
`backend/src/modules/recommendations/recommendation-scoring.ts`, which is also
used by the production recommendation service. The benchmark therefore cannot
silently drift to a separately reimplemented formula.

For the Product Detail baseline, create binary item vectors from the available
Amazon attributes (inferred category/garment role, gender, brand, colors, and
price bucket) and use cosine similarity:

```text
cosine(q, i) = dot(x_q, x_i) / (norm(x_q) * norm(x_i))
```

The earlier weighted-attribute Product Detail formula was tested against this
independent implementation and lost on final HR and NDCG. V7 uses a two-stage
grid search over 672 distinct configurations on 646 validation cases: a full
simplex at step `0.05`, followed by step `0.005` refinement around the best
region. The
selected `0.125 content + 0.875 cosine` hybrid improved validation NDCG in four
of five folds and tied in one; popularity and business both selected zero.
Production builds cosine vectors from its richer category, role, gender,
brand, color, fit, and price-bucket metadata. Exact cosine remains the
do-no-harm fallback if a future validation run finds no better hybrid.

For the Cart baseline, compute support and lift using training baskets only:

```text
support(A)      = baskets containing A / all training baskets
support(A, B)   = baskets containing both A and B / all training baskets
confidence(A→B) = support(A, B) / support(A)
lift(A→B)       = support(A, B) / (support(A) * support(B))
```

For a multi-item cart, the preprocessing step should aggregate candidate
association scores across the source items using one documented rule, such as
maximum lift. The raw lift is then transformed monotonically and normalized to
`[0, 1]` using training-set statistics, for example
`log1p(lift) / log1p(maxTrainingLift)`. Record the selected transform before
running the final test. This preserves lift ordering while putting the baseline
on the same scale as the proposed score and diversity penalties.

The Cart score combines the referenced association-lift signal with the
project-specific role and style rules. A full 0.05-step simplex search on the
Polyvore validation split selected `0.60 style + 0.40 lift`; the coefficient of
the role proxy went to zero. This is an offline optimum, not a claim that roles
are useless in production: Polyvore's derived role signal may be weak. The
production fallback still matters when order history has no supported category
pair.

## Input schema

The preprocessing step converts H&M, Amazon Fashion, or another documented
dataset into a normalized JSON file:

```json
{
  "schemaVersion": 1,
  "dataset": {
    "name": "Amazon Fashion 2023 subset",
    "source": "public dataset URL and version",
    "split": "chronological train/test cutoff"
  },
  "cases": [
    {
      "caseId": "HOME-0001",
      "context": "home",
      "relevantProductIds": ["held-out-product"],
      "candidates": [
        {
          "productId": "candidate-product",
          "categoryId": "category",
          "brandId": "brand",
          "signals": {
            "preferenceMatch": 0.8,
            "popularity": 0.4,
            "business": 0.1
          }
        }
      ]
    }
  ]
}
```

Required candidate signals by context:

- Home: `preferenceMatch`, `popularity`, `business`.
- Product Detail: project-specific `contentSimilarity`, independent
  `cosineSimilarity`, `popularity`, and `business`.
- Cart: `complementaryRole`, `styleCompatibility`, `popularity`, `business`,
  and training-only `associationLift` for the baseline.

All candidate signals, including the transformed association-lift signal, must
be normalized to `[0, 1]` by preprocessing. Relevant products may be absent
from the candidate set; that case correctly receives zero ranking credit and
exposes candidate-generation failures.

## Run

Prepare two non-overlapping chronological windows. The older window is used
only for selecting weights; the newer window is opened once for final testing:

```powershell
npm run recommendations:amazon:prepare -- --test-from=2021-09-11T03:24:38.515Z --test-to=2022-09-11T03:24:38.515Z --out=../evaluation/recommendation/data/processed/amazon-fashion-validation.json --cases=100 --candidates=200 --catalog=5000
npm run recommendations:tune -- --input=../evaluation/recommendation/data/processed/amazon-fashion-validation.json --out=../evaluation/recommendation/configs/v5-validation-tuned.json --k=5
npm run recommendations:amazon:prepare -- --test-from=2022-09-11T03:24:38.515Z --test-to=2023-09-11T03:24:38.516Z --out=../evaluation/recommendation/data/processed/amazon-fashion-final-test.json --cases=100 --candidates=200 --catalog=5000
npm run recommendations:benchmark -- --input=../evaluation/recommendation/data/processed/amazon-fashion-final-test.json --weights=../evaluation/recommendation/configs/v5-validation-tuned.json --out=../evaluation/recommendation/results/amazon-fashion-v5-final-k5.json --k=5
```

The preparer uses verified purchases with rating at least four. Home relevance
is the first positive item in the held-out period. Product Detail uses the same
item as a documented next-positive-item proxy, anchored on the user's latest
training item. Cart uses a held-out same-day multi-item review basket as a
co-purchase proxy. These proxies are suitable for offline comparison but must
not be described as explicit semantic-similarity or outfit-quality labels.

From `backend/`:

```powershell
npm run recommendations:benchmark -- --input=../evaluation/recommendation/data/processed/cases.json --out=../evaluation/recommendation/results/benchmark.json --k=5
```

To verify the harness with the committed non-research fixture:

```powershell
npm run recommendations:benchmark -- --input=../evaluation/recommendation/data/sample-cases.json --out=../evaluation/recommendation/results/sample-benchmark.json --k=1
```

The grid search maximizes validation NDCG@5 with deterministic tie-breaks. It
uses a 0.05 step and keeps business weights fixed because the public data has
no equivalent business signal. The final test is not used to revise weights.

The output reports Hit Rate, Precision, Recall, MAP, MRR, NDCG, catalog
coverage, category diversity, and brand diversity for the proposed method and
its context-specific baseline, plus paired metric deltas.

For the Polyvore secondary analysis, paired Top-K successes are also compared
with the two-sided exact McNemar test. Only discordant cases contribute: under
the null hypothesis, either method is equally likely to own each discordant
hit, so the exact p-value is calculated from `Binomial(b + c, 0.5)`.

## Experimental rules

1. Split interactions chronologically. Never calculate popularity, profiles,
   content vocabularies, or association lift from the held-out test period.
2. Use one fixed active candidate catalog for both methods in each case.
3. Report the number of users/cases, products, interactions, cold-start
   exclusions, and candidate-generation failures.
4. Select `K` before running the final test. Use `K=5` for the mobile rail; an
   additional public-benchmark value may be reported separately.
5. Do not report the sample fixture or developer-generated clicks as user
   evaluation data.
6. Keep raw data out of Git. Commit the exact dataset URL/version, preprocessing
   configuration, final compact metrics, and charts.

## Method references

- Pazzani, M. J., and Billsus, D. (2007), *Content-Based Recommendation
  Systems*, DOI: <https://doi.org/10.1007/978-3-540-72079-9_10>.
- Agrawal, R., Imielinski, T., and Swami, A. (1993), *Mining Association Rules
  between Sets of Items in Large Databases*, DOI:
  <https://doi.org/10.1145/170035.170072>.
- Herlocker, J. L., Konstan, J. A., Terveen, L. G., and Riedl, J. T. (2004),
  *Evaluating Collaborative Filtering Recommender Systems*, DOI:
  <https://doi.org/10.1145/963770.963772>.
- Jarvelin, K., and Kekalainen, J. (2002), *Cumulated Gain-Based Evaluation of
  IR Techniques*, DOI: <https://doi.org/10.1145/582415.582418>.
- H&M Personalized Fashion Recommendations data and official prediction task:
  <https://www.kaggle.com/competitions/h-and-m-personalized-fashion-recommendations/data>.
- Amazon Fashion review/metadata source maintained by McAuley Lab:
  <https://amazon-reviews-2023.github.io/>.
