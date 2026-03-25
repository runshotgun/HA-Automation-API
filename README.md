# HA Automation REST API Add-on

This Home Assistant add-on exposes your `automations.yaml` and `scripts.yaml` through a secure REST API so external tools can manage them safely.

It is designed for integrations such as OpenClaw, custom control panels, internal tooling, and automation pipelines that need to read, search, or update Home Assistant automations/scripts over HTTP.

## What This Add-on Enables

- **Read access** to automations and scripts (`list`, `search`, `read`)
- **Write access** when enabled (`edit`, `delete`)
- **Secure access controls** with:
  - API key authentication with Supervisor-managed Home Assistant auth
  - source IP allowlist enforcement
  - per-operation permission toggles
- **Safe file updates** with validation, backups, restore-on-failure, and Home Assistant reload calls
- **Write locking** so only one write operation runs at a time

## Install (Step by Step)

### 1) Add This Repository to Home Assistant

1. Open Home Assistant.
2. Go to **Settings -> Add-ons -> Add-on Store**.
3. Open the menu (top-right) and click **Repositories**.
4. Add:

```text
https://github.com/runshotgun/HA-Automation-API
```

5. Refresh add-ons.

### 2) Install the Add-on

1. Open **HA Automation REST API**.
2. Click **Install**.

### 3) Configure the Add-on

In the add-on **Configuration** tab, set these values:

**Important:** Allowed IP addresses are mandatory for real use.  
If this list is empty, authenticated API calls are blocked with `403`.

| Setting | What to choose | Why it matters |
| --- | --- | --- |
| API key | Set manually, or leave blank for auto-generation | Your app sends this on every request (`X-API-Key` or bearer); empty/invalid keys are automatically replaced and saved |
| Allow listing | On | Lets clients list automations and scripts |
| Allow reading | On | Lets clients read one automation/script by ID |
| Allow searching | On | Lets clients search automations/scripts |
| Allow editing | On only if needed | Required for updates (`PUT`/`PATCH`) |
| Allow deleting | On only if needed | Required for deletes (`DELETE`) |
| Allowed IP addresses | Add all trusted client IPs (example: `192.168.1.25`) | Blocks unknown callers even with valid credentials |
| Automations file path | Usually `/config/automations.yaml` | Source file used for automation operations |
| Scripts file path | Usually `/config/scripts.yaml` | Source file used for script operations |
| Backups to keep | `10` recommended | Controls how many rollback backups are retained |

### 4) Start and Verify

1. Click **Start**.
2. Open the add-on **Logs** and confirm startup succeeds.
3. Check health endpoint:

```bash
curl http://homeassistant.local:8099/health
```

Expected:

```json
{
  "status": "ok",
  "service": "ha-automation-api"
}
```

## Use It

For request examples and integration patterns, use the skill guide:

- [`HA Automation API Skill`](.agents/skills/ha-automation-api/SKILL.md)

The skill guide includes:

- authentication header format (`X-API-Key` or bearer with your app API key)
- list/search/read/update/delete request patterns
- Node.js and Python examples
- common error handling guidance

## Payload Rules for Writes

For both automations and scripts, `PUT` and `PATCH` accept either:

1. Wrapped payload:

```json
{
  "automation": {
    "alias": "Updated alias"
  }
}
```

2. Direct object:

```json
{
  "alias": "Updated alias"
}
```

`PUT` replaces the object.  
`PATCH` merges top-level fields.

## Endpoint Reference

All endpoints except `/health` require authentication:

- `X-API-Key: <YOUR_APP_API_KEY>` (or `Authorization: Bearer <YOUR_APP_API_KEY>`)

### Health

- `GET /health` (no auth required)

### Automations

- `GET /automations` (requires **Allow listing**)
- `GET /automations/search` (requires **Allow searching**)
- `GET /automations/:id` (requires **Allow reading**)
- `PUT /automations/:id` (requires **Allow editing**)
- `PATCH /automations/:id` (requires **Allow editing**)
- `DELETE /automations/:id` (requires **Allow deleting**)

### Scripts

- `GET /scripts` (requires **Allow listing**)
- `GET /scripts/search` (requires **Allow searching**)
- `GET /scripts/:id` (requires **Allow reading**)
- `PUT /scripts/:id` (requires **Allow editing**)
- `PATCH /scripts/:id` (requires **Allow editing**)
- `DELETE /scripts/:id` (requires **Allow deleting**)

## Safety and Concurrency

For `PUT`, `PATCH`, and `DELETE`, the add-on:

1. Validates YAML in memory.
2. Writes to a temp file.
3. Validates the temp file on disk.
4. Creates timestamped backup(s).
5. Atomically swaps file.
6. Reloads automations/scripts via Home Assistant API.
7. Restores backup automatically if something fails.

Only one write request runs at a time.  
Concurrent write requests return `429 Too Many Requests`.

## Error Codes

- `401` missing/invalid API key
- `403` IP not allowlisted or permission disabled
- `404` automation/script ID not found
- `422` invalid payload/YAML structure
- `429` another write is in progress
- `500` internal failure (check add-on logs)

## Troubleshooting

### 403 Errors

- Confirm your client IP is in the **Allowed IP addresses** list.
- Confirm the needed permission setting is enabled (listing, reading, searching, editing, or deleting).

### 401 Errors

- Verify your app sends the correct API key (`X-API-Key` or bearer).

### 422 Errors

- Validate request JSON.
- Confirm URL `:id` matches your target object.

### 429 Errors

- Wait for current write operation to finish.
- Retry once lock is released.

### 500 Errors

- Confirm **API key** is set in add-on configuration.
- To rotate the key, set a new value in **API key** and save configuration.
- Confirm the add-on is running with Home Assistant API access enabled.
