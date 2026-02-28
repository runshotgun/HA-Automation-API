# Changelog

## 0.1.3

- Updated `GET /automations` to return metadata-only automation objects by excluding automation content fields.
- Aligned list behavior with `GET /automations/search`, including the same metadata filtering query parameters.

## 0.1.2

- Added `GET /automations/search` to search automations without returning full automation content.
- Added a new `allow_search` option to enable or disable the search endpoint.
- Improved search responses to return automation metadata with content fields excluded.
