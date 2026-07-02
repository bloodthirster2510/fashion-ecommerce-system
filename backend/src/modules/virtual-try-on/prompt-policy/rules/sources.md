# Prompt Policy Rule Sources

These rule files are curated seed data for virtual try-on prompts. They are not full copies of external word lists.

## Internal sources

- Virtual try-on business rules: prompts may describe fashion context, style, color, occasion, and vibe.
- Existing request fields: `contextPrompt`, `contextPreset`, `outfitMode`, and `selectedItems`.
- Existing job error fields: `virtualtryonjobs.errorCode`, `virtualtryonjobs.errorMessage`, and `virtualtryonjobs.providerMetadata`.

## External references

- Vietnamese offensive word reference: https://github.com/blue-eyes-vn/vietnamese-offensive-words
- English profanity JSON/plain-text structure: https://github.com/dsojevic/profanity-list
- English/multilingual profanity reference: https://github.com/LDNOOBWV2/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words_V2
- Prompt injection examples: https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Prompt%20Injection
- OWASP prompt injection testing guidance: https://github.com/OWASP/www-project-ai-testing-guide/blob/main/Document/content/tests/AITG-APP-01_Testing_for_Prompt_Injection.md

## Curation rules

- Keep only terms related to virtual try-on safety.
- Prefer clear phrases over short ambiguous terms.
- Include Vietnamese accented and unaccented forms when helpful.
- Do not add broad lists wholesale without manual review.
- Do not create a database collection for MVP prompt rules.
