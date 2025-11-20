# ADR-001: UI IR Schema Selection

## Decision
Adopt a JSON-based schema validated with Ajv (draft-07) for portability and ease of evolution.

## Status
Accepted

## Context
Multiple sources (LVGL/React/Sketch) require a unified intermediate form. JSON is widely supported across Node/Python.

## Alternatives
- Protobuf: Strong typing but less human-readable.
- Custom DSL: Flexible but higher maintenance.

## Consequences
- Easy validation and diffing.
- Need versioning field and migration strategy for breaking changes.
