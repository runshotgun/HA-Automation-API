# Changelog

## 0.1.4

- Added `PATCH /automations/:id` for partial top-level automation updates.
- Changed `PUT /automations/:id` to full replacement behavior (fields omitted from payload are removed).
- Updated API documentation, skill docs, and translation labels to reflect `PUT`/`PATCH` semantics and write concurrency behavior.

## 0.1.3

- Updated `GET /automations` to return metadata-only automation objects by excluding automation content fields.
- Aligned list behavior with `GET /automations/search`, including the same metadata filtering query parameters.

## 0.1.2

- Added `GET /automations/search` to search automations without returning full automation content.
- Added a new `allow_search` option to enable or disable the search endpoint.
- Improved search responses to return automation metadata with content fields excluded.
