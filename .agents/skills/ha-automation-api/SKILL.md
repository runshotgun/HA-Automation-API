---
name: ha-automation-api
description: Call the HA Automation API to list, read, edit, or delete Home Assistant automations. Use when integrating with Home Assistant automations, building scripts that manage automations, or when the user mentions the HA Automation API add-on.
---

# HA Automation API

REST API for managing Home Assistant automations. Requires the [HA Automation API add-on](https://github.com/runshotgun/HA-Automation-API) installed in Home Assistant.

## Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check (no auth) |
| `/automations` | GET | List all automations |
| `/automations/:id` | GET | Read one automation |
| `/automations/:id` | PUT | Update automation |
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

{"automation": {"alias": "New name", "description": "..."}}
```

Or send the automation object directly (without `automation` wrapper). Response: `{ "automation": {...} }`

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
| 429 | Write lock active (retry after current PUT/DELETE completes) |
| 500 | Internal error |

Error body: `{ "error": "message", "details": {...} }`

## Constraints

- **IP whitelist**: Add-on option `allowed_ips` must include caller IP. Empty list = no access.
- **Permissions**: Add-on options `allow_list`, `allow_read`, `allow_edit`, `allow_delete` gate each operation.
- **Concurrency**: Only one PUT or DELETE at a time. Second write returns 429.

## Example (curl)

```bash
# List
curl -H "Authorization: Bearer $TOKEN" http://homeassistant.local:8099/automations

# Update
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
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
