# UI IR Schema Details

Refer to `src/core/ui-ir/ui-ir-schema.json` for machine-readable version.

Key Fields:
- version
- screenId
- widgets[] (id, type, children, layout, style, events, assets, text)
- assets{images[], fonts[]}
- meta{generatedAt}

Extension plan: accessibility, interactions, data binding.
