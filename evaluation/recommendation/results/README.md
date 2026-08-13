# Recommendation benchmark results

## Cart outfit completion: Polyvore

Polyvore is the primary Cart evaluation because it provides real outfit sets
and an official Fill-in-the-Blank (FITB) task. The official train, validation,
and test files remain separated. The exact four-choice subset contains 142 of
3,076 official questions: all four answers must have metadata in the released
21,889-outfit files and map to one of the production system's seven garment
roles. This strict filter avoids silently replacing official answer choices.

The original v5 Cart formula (`0.65 role + 0.30 style + 0.05 business`) scored
31.69% on the exact four-choice subset, below category association lift at
40.85%.
The validation search therefore tested an association hybrid. It selected the
v6 formula `0.20 role + 0.25 style + 0.50 lift + 0.05 business` on 1,000
validation cases before final evaluation.

| Final task | v6 | Lift baseline | Difference |
| --- | ---: | ---: | ---: |
| Official FITB accuracy@1 (4 candidates) | 0.3944 (56/142) | 0.4085 (58/142) | -0.0141 |
| HR@5 (200 candidates) | 0.0563 (8/142) | 0.0423 (6/142) | +0.0141 |
| NDCG@5 (200 candidates) | 0.0441 | 0.0353 | +0.0088 |
| HR@10 (200 candidates) | 0.0845 (12/142) | 0.0563 (8/142) | +0.0282 |
| Coverage@5 (200 candidates) | 0.0307 | 0.0303 | +0.0004 |

The v6 hybrid is clearly better than v5 on the same subset: +11 Top-1 hits,
+7 Top-5 hits, and +5 Top-10 hits. Against pure lift, the result is mixed: v6
loses by two questions at Top-1, then leads by two hits at Top-5 and four hits
at Top-10. With only 142 eligible official questions, this is evidence for an
engineering improvement over v5, not a statistically strong claim that v6 is
universally better than lift or that it creates commercial uplift. Polyvore
lacks production gender, brand, inventory, sale, and new-arrival fields, so
those effects require production monitoring or a user study.

A paired two-sided exact McNemar audit supports that wording. V6 versus v5 is
significant on FITB@1 (`p=0.0074`) and expanded-candidate Top-5 (`p=0.0156`),
but not Top-10 (`p=0.125`). None of the v6-versus-lift differences is
significant (`p>=0.3438`). The paired counts and exact values are stored in
`polyvore-cart-paired-significance.json`.

Machine-readable Polyvore outputs are `polyvore-cart-v6-official-fitb-k1.json`,
`polyvore-cart-v6-final-k5.json`, and `polyvore-cart-v6-final-k10.json`.

## Home and Product Detail: Amazon Fashion

The project formulas are compared with independently implemented
traditional baselines on identical candidate sets: Most Popular for Home,
binary-vector cosine similarity for Product Detail, and association-rule lift
for Cart. Product Detail v7 was selected using 646 cases from the 2021-09-11 to
2022-09-11 validation window. A two-stage grid generated 682 points and
evaluated 672 distinct configurations after removing 10 overlapping boundary
points. It
selected `0.125 weighted content + 0.875 cosine`, with popularity and business
at zero. The reported final window is the non-overlapping 2022-09-11 to
2023-09-11 period. Each case contains 200 candidates.

## Primary final test: K=5

| Context | Method | Cases | Hits | HR@5 | NDCG@5 | Coverage@5 | Category diversity |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | Project v7 | 100 | 7 | 0.070 | 0.0576 | 0.0781 | 0.472 |
| Home | Most Popular | 100 | 1 | 0.010 | 0.0063 | 0.0014 | 0.800 |
| Product Detail | Project v7 hybrid | 100 | 5 | 0.050 | 0.0282 | 0.0831 | 0.436 |
| Product Detail | Independent cosine baseline | 100 | 5 | 0.050 | 0.0282 | 0.0819 | 0.442 |
| Cart | Project v7 | 28 | 3 | 0.107 | 0.0542 | 0.0421 | 0.871 |
| Cart | Association lift | 28 | 0 | 0.000 | 0.0000 | 0.0506 | 1.000 |

Home remains the strongest positive Amazon result. Product Detail v7 corrects
the v5 regression from two to five Top-5 hits and from `0.0100` to `0.0282`
NDCG, matching the independently implemented cosine baseline on the final
window while slightly improving validation NDCG. It does not claim a final-set
win over cosine. Cart obtains three hits versus none, but 28
proxy-labelled cases are insufficient for a strong general claim.

The Product Detail gain over v5 is directionally consistent but not
statistically significant on 100 cases: paired exact McNemar `p=0.25` at K=5
and `p=0.125` at K=10. Counts are in
`amazon-fashion-v7-vs-v5-paired-significance.json`.

## Secondary sensitivity analysis: K=10

K=10 uses the same cases and 200-candidate sets. It is secondary because the
mobile rail's primary reporting value was fixed at K=5.

| Context | Method | Cases | Hits | HR@10 | NDCG@10 |
| --- | --- | ---: | ---: | ---: | ---: |
| Home | Project v7 | 100 | 12 | 0.120 | 0.0740 |
| Home | Most Popular | 100 | 1 | 0.010 | 0.0063 |
| Product Detail | Project v7 hybrid | 100 | 9 | 0.090 | 0.0414 |
| Product Detail | Independent cosine baseline | 100 | 9 | 0.090 | 0.0416 |
| Cart | Project v7 | 28 | 8 | 0.286 | 0.1145 |
| Cart | Association lift | 28 | 0 | 0.000 | 0.0000 |

The K=10 result supports the same interpretation: Home remains stronger than
Most Popular, Product Detail matches cosine's nine hits with slightly lower
NDCG (`0.0414` versus `0.0416`), and the Amazon Cart sensitivity result rises
to eight hits while lift remains at zero.

## What is original and what is referenced

- Home retains its validation-tuned score, Product Detail v7 uses the
  validation-selected `0.125 content + 0.875 cosine` hybrid, and Cart uses the
  v6 association hybrid. The signal mapping, role-compatibility matrix, and
  diversity penalties are project decisions. Weighted hybridization is the
  supporting principle, not a claim that the exact coefficients came from a
  paper.
- Most Popular is a conventional non-personalized benchmark.
- Product Detail cosine follows the standard vector-space similarity formula
  and is calculated from a separate binary metadata vector.
- Cart lift follows traditional association-rule support, confidence, and lift
  definitions using training baskets only.
- HR, Precision, Recall, MAP, MRR, NDCG, coverage, and diversity are evaluation
  measures, not components copied into the project ranking formula.

## Limitations

- Negatives are sampled from a 5,000-product popularity-limited catalog, so
  these are sampled-ranking rather than full-catalog retrieval metrics.
- Product Detail uses a next-positive-item proxy, not an explicit semantic
  similarity judgment.
- The Amazon Cart sensitivity result uses same-day co-review activity; the
  primary Cart result instead uses Polyvore outfit-completion labels.
- Amazon lacks equivalent sale/new-arrival fields, so `business = 0` offline.
- Garment roles, gender, and colors are inferred from English metadata.
- The final Amazon window was inspected during the v5-to-v7 engineering
  iteration. V7 was selected by the validation guardrail, but its final-window
  numbers should be presented as exploratory rather than a fresh blind test.

Machine-readable current results are stored in
`amazon-fashion-v7-final-k5.json` and `amazon-fashion-v7-final-k10.json`.
The v5 files remain as the before-change comparison.
Original v4 and validation outputs are retained for traceability. Dataset URLs
and checksums are in `dataset-provenance.json`.
