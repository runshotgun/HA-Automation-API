---
name: ha-automation-api
description: Call the HA Automation REST API to list, read, edit, or delete Home Assistant automations. Use when integrating with Home Assistant automations, building scripts that manage automations, or when the user mentions the HA Automation REST API add-on.
---

# HA Automation REST API

REST API for managing Home Assistant automations. Requires the [HA Automation REST API add-on](https://github.com/runshotgun/HA-Automation-API) installed in Home Assistant.

## Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check (no auth) |
| `/automations` | GET | List automations (metadata only) |
| `/automations/search` | GET | Search automations metadata (same shape as `/automations`) |
| `/automations/:id` | GET | Read one automation |
| `/automations/:id` | PUT | Replace automation (full replacement) |
| `/automations/:id` | PATCH | Partially update automation (top-level merge) |
| `/automations/:id` | DELETE | Delete automation |

## Authentication

All endpoints except `/health` require:

```
Authorization: Bearer <HOME_ASSISTANT_LONG_LIVED_TOKEN>
```

Token is validated against Home Assistant `/api/`. Create tokens in HA: Profile → Long-Lived Access Tokens.

## Base URL

Typically `http://homeassistant.local:8099` or `http://<ha-host>:8099`. Port 8099 is default.

## Request Patterns

### List automations

```http
GET /automations
Authorization: Bearer <TOKEN>
```

Response: `{ "count": N, "automations": [...] }`

Returns metadata-only automation objects (content fields excluded):

- `trigger`, `condition`, `action`
- `triggers`, `conditions`, `actions`
- `sequence`

Supports filters via query params:

- text: `q`, `id`, `name`, `area`, `floor`, `label`, `entity_id`, `icon`
- boolean: `visible`, `enabled`

### Search automations metadata

```http
GET /automations/search?q=bedroom&enabled=true
Authorization: Bearer <TOKEN>
```

Returns the same metadata-only response shape as `GET /automations`, with the same supported filters.

### Read one automation

```http
GET /automations/{id}
Authorization: Bearer <TOKEN>
```

Response: `{ "automation": { "id", "alias", "triggers", "actions", ... } }`

### Update automation

```http
PUT /automations/{id}
Authorization: Bearer <TOKEN>
Content-Type: application/json

{"automation": {"id": "1673577999532", "alias": "New name", "trigger": [...], "condition": [], "action": [...]} }
```

Or send the automation object directly (without `automation` wrapper). `PUT` replaces the automation object (id is always forced to URL id). Response: `{ "automation": {...} }`

### Patch automation

```http
PATCH /automations/{id}
Authorization: Bearer <TOKEN>
Content-Type: application/json

{"automation": {"alias": "New name"}}
```

Or send the automation object directly. `PATCH` merges top-level fields only (nested objects/arrays are replaced as a whole when provided). Response: `{ "automation": {...} }`

### Delete automation

```http
DELETE /automations/{id}
Authorization: Bearer <TOKEN>
```

Response: `{ "deleted": true, "automation": {...} }`

## Error Handling

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid token |
| 403 | IP not in `allowed_ips` whitelist, or operation disabled by add-on config |
| 404 | Automation ID not found |
| 422 | Invalid YAML or payload |
| 429 | Write lock active (retry after current PUT/PATCH/DELETE completes) |
| 500 | Internal error |

Error body: `{ "error": "message", "details": {...} }`

## Constraints

- **IP whitelist**: Add-on option `allowed_ips` must include caller IP. Empty list = no access.
- **Permissions**: Add-on options `allow_list`, `allow_read`, `allow_search`, `allow_edit` (`PUT` + `PATCH`), `allow_delete` gate each operation.
- **Concurrency**: Only one PUT, PATCH, or DELETE at a time. Second write returns 429.

## Example (curl)

```bash
# List
curl -H "Authorization: Bearer $TOKEN" http://homeassistant.local:8099/automations

# Update
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"automation":{"id":"1673577999532","alias":"Updated","trigger":[...],"condition":[],"action":[...]}}' \
  http://homeassistant.local:8099/automations/1673577999532

# Patch
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"automation":{"alias":"Updated"}}' \
  http://homeassistant.local:8099/automations/1673577999532
```

## Example (Node.js)

```javascript
const baseUrl = "http://homeassistant.local:8099";
const token = process.env.HA_TOKEN;

const res = await fetch(`${baseUrl}/automations`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { automations } = await res.json();
```

## Example (Python)

```python
import os
import requests

base_url = "http://homeassistant.local:8099"
token = os.environ["HA_TOKEN"]
headers = {"Authorization": f"Bearer {token}"}

r = requests.get(f"{base_url}/automations", headers=headers)
data = r.json()
automations = data["automations"]
```
