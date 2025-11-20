# ADR-002: Parser Strategy

## Decision
Use Tree-sitter for LVGL C and Babel (or SWC) for React JSX; Sketch parsed via ZIP + JSON layer extraction.

## Status
Proposed

## Rationale
Tree-sitter offers incremental parsing; Babel ecosystem mature for JSX; Sketch format is archival (ZIP of JSON + assets).

## Trade-offs
- Tree-sitter grammar maintenance cost.
- Performance overhead initial load.
