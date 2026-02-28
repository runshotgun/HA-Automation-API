# HA Automation API Add-on

This repository contains a Home Assistant add-on that exposes automation management over HTTP.

## What It Does

The add-on provides these endpoints:

- `GET /health`
- `GET /automations`
- `GET /automations/search`
- `GET /automations/:id`
- `PUT /automations/:id`
- `PATCH /automations/:id`
- `DELETE /automations/:id`

### Core Features

- **Long-lived token authentication**: Uses Home Assistant long-lived access tokens for every API call
- **Token validation**: Validates caller tokens against Home Assistant `/api/`
- **IP allowlist enforcement**: Requests are allowed only when source IP matches `allowed_ips`
- **Permission locks**: Per-operation permission controls (`list`, `read`, `search`, `edit`, `delete`) via add-on options
- **Safe write operations**: 
  - Validates YAML before touching disk
  - Writes to temp copy first
  - Validates temp copy after writing
  - Creates timestamped backups
  - Deletes old file, then renames temp file atomically
  - Reloads automations through Home Assistant API
  - Restores from backup if reload/write fails
- **Concurrency control**: Only one mutating request (`PUT`/`PATCH`/`DELETE`) at a time; concurrent writes return `429`

## Add This Add-on To Home Assistant

### 1) Add the Repository

1. Open Home Assistant
2. Go to **Settings -> Add-ons -> Add-on Store**
3. Open the menu (top-right) and click **Repositories**
4. Add this URL:

```
https://github.com/runshotgun/HA-Automation-API
```

5. Refresh add-ons

### 2) Install and Start

1. Open the **HA Automation API** add-on
2. Click **Install**
3. In the add-on **Configuration** tab, use the generated option fields/lists (see example below)
4. Click **Start**
5. Check **Logs** for startup success

## Add-on Configuration

Example configuration:

```yaml
allow_list: true
allow_read: true
allow_search: true
allow_edit: false
allow_delete: false
allowed_ips: []
automations_file: /config/automations.yaml
backup_keep: 10
home_assistant_url: http://homeassistant:8123
```

### Configuration Options

- `allow_list`: Enable `GET /automations` (list automation metadata)
- `allow_read`: Enable `GET /automations/:id` (read one automation)
- `allow_search`: Enable `GET /automations/search` (search automations metadata)
- `allow_edit`: Enable `PUT`/`PATCH /automations/:id` (edit one automation)
- `allow_delete`: Enable `DELETE /automations/:id` (delete one automation)
- `allowed_ips`: Whitelist of client source IPs allowed to call the API. Default `[]` (enabled, no IPs allowed until configured).
- `automations_file`: Path to the automation YAML file (default `/config/automations.yaml`)
- `backup_keep`: Number of timestamped backups to keep (default `10`)
- `home_assistant_url`: Home Assistant URL used for token validation and automation reload calls

## Authentication

All endpoints require a Home Assistant long-lived access token:

```
Authorization: Bearer <YOUR_LONG_LIVED_TOKEN>
```

### Creating a Long-Lived Token

1. In Home Assistant, click your profile avatar (bottom-left in sidebar)
2. Scroll to **Long-Lived Access Tokens**
3. Click **Create Token**
4. Give it a name (e.g., "Automation API")
5. Copy the token and store it securely

The token is validated by calling Home Assistant `/api/` before any endpoint logic executes.

## API Endpoints

### `GET /health`

Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "ok",
  "service": "ha-automation-api"
}
```

### `GET /automations`

List automation metadata and exclude automation content fields (same behavior as `GET /automations/search`).

Excluded fields:

- `trigger`, `condition`, `action`
- `triggers`, `conditions`, `actions`
- `sequence`

All other top-level fields are returned as-is. The response also guarantees normalized `name`, `visible`, and `enabled` fields.

Supported query params:

- `q`: text search across metadata fields
- `id`, `name`, `area`, `floor`, `label`, `entity_id`, `icon`: field-specific contains filters
- `visible`, `enabled`: boolean filters (`true`/`false`, also accepts `1`/`0`, `on`/`off`)

**Response:**
```json
{
  "count": 2,
  "automations": [
    {
      "id": "1673577999532",
      "alias": "Bedroom Shades",
      ...
    },
    ...
  ]
}
```

### `GET /automations/search`

Search automations and return metadata-only automation objects (same response shape as `GET /automations`).

Excluded fields:

- `trigger`, `condition`, `action`
- `triggers`, `conditions`, `actions`
- `sequence`

All other top-level fields are returned as-is. The response also guarantees normalized `name`, `visible`, and `enabled` fields.

Supported query params:

- `q`: text search across metadata fields
- `id`, `name`, `area`, `floor`, `label`, `entity_id`, `icon`: field-specific contains filters
- `visible`, `enabled`: boolean filters (`true`/`false`, also accepts `1`/`0`, `on`/`off`)

**Response:**
```json
{
  "count": 2,
  "automations": [
    {
      "id": "1673577999532",
      "alias": "Bedroom Shades",
      "name": "Bedroom Shades",
      "area": "Bedroom",
      "floor": "Second",
      "label": "Climate",
      "entity_id": "automation.bedroom_shades",
      "icon": "mdi:blinds",
      "mode": "single",
      "visible": true,
      "enabled": true
    }
  ]
}
```

### `GET /automations/:id`

Read a specific automation by ID.

**Response:**
```json
{
  "automation": {
    "id": "1673577999532",
    "alias": "Bedroom Shades",
    ...
  }
}
```

### `PUT /automations/:id`

Replace an automation (full replacement). You can send either:

**Option 1:** Wrapped in `automation` key:
```json
{
  "automation": {
    "alias": "Updated alias",
    "description": "Updated by API"
  }
}
```

**Option 2:** Direct automation object (if `automation` key is omitted, the request body itself is treated as the automation object):
```json
{
  "alias": "Updated alias",
  "description": "Updated by API"
}
```

`PUT` replaces the stored automation object with the payload (and forces `id` to match `:id`).
Fields omitted from the payload are removed from the automation.

### `PATCH /automations/:id`

Partially update an automation (top-level merge). You can send either:

**Option 1:** Wrapped in `automation` key:
```json
{
  "automation": {
    "alias": "Updated alias"
  }
}
```

**Option 2:** Direct automation object:
```json
{
  "alias": "Updated alias"
}
```

`PATCH` merges top-level fields into the existing automation (and forces `id` to match `:id`).
Nested structures like `trigger`, `condition`, and `action` are replaced as whole fields when provided.

**Response:**
```json
{
  "automation": {
    "id": "1673577999532",
    "alias": "Updated alias",
    ...
  }
}
```

### `DELETE /automations/:id`

Delete an automation by ID.

**Response:**
```json
{
  "deleted": true,
  "automation": {
    "id": "1673577999532",
    "alias": "Bedroom Shades",
    ...
  }
}
```

## Quick API Examples

### List Automations

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  http://homeassistant.local:8099/automations
```

### Read One Automation

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  http://homeassistant.local:8099/automations/1673577999532
```

### Search Automation Metadata

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://homeassistant.local:8099/automations/search?q=bedroom&enabled=true"
```

### Update One Automation

```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"automation":{"id":"1673577999532","alias":"Bedroom Shades Updated","trigger":[...],"condition":[],"action":[...]}}' \
  http://homeassistant.local:8099/automations/1673577999532
```

### Patch One Automation

```bash
curl -X PATCH \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"automation":{"alias":"Bedroom Shades Updated"}}' \
  http://homeassistant.local:8099/automations/1673577999532
```

### Delete One Automation

```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  http://homeassistant.local:8099/automations/1673577999532
```

## Write Safety Flow

For edit/delete operations, the add-on follows this safety flow:

1. Load and validate the full YAML structure
2. Build updated automation list in memory
3. Write updated list to a temp file (`automations.yaml.new`)
4. Re-read and validate temp file to ensure it's valid on disk
5. Create a timestamped backup (`automations.yaml.bak.<timestamp>`)
6. Delete current `automations.yaml`
7. Rename temp file to `automations.yaml`
8. Reload automations through Home Assistant API
9. On failure, restore from backup and report error

This ensures that:
- Invalid YAML never replaces the live file
- Backups are created before any changes
- The file swap is atomic (delete + rename)
- Failed operations automatically restore from backup

## Concurrency Model

Only one `PUT`, `PATCH`, or `DELETE` request can run at a time. If another write operation is already in progress, the add-on responds with `HTTP 429 Too Many Requests`.

This prevents:
- Race conditions when multiple clients update automations simultaneously
- Corrupted YAML files from concurrent writes
- Backup/revert conflicts

## Error Codes

- `401`: Missing or invalid bearer token
- `403`: Source IP not in `allowed_ips` or operation disabled by add-on permissions
- `404`: Automation ID not found
- `422`: Invalid payload or invalid YAML structure
- `429`: Write lock active (another write operation is in progress)
- `500`: Internal failure (check add-on logs and HA logs for details)

## Troubleshooting

### Add-on Won't Start

- Check the **Logs** tab in the add-on for error messages
- Verify `home_assistant_url` is correct (default: `http://homeassistant:8123`)
- Ensure `automations_file` path exists and is readable

### Authentication Errors (401)

- Verify your long-lived token is correct
- Check that the token hasn't been revoked in Home Assistant
- Ensure `home_assistant_url` is reachable from the add-on container

### Permission Errors (403)

- If error mentions `allowed_ips`, add your client IP to the add-on `allowed_ips` list
- Check add-on permission options (`allow_list`, `allow_read`, `allow_edit`, `allow_delete`)
- Ensure the requested operation is enabled

### Write Lock Errors (429)

- Wait for the current write operation to complete
- Check add-on logs to see what operation is running
- Only one `PUT`, `PATCH`, or `DELETE` can run at a time

### YAML Validation Errors (422)

- Verify your automation payload is valid YAML
- Check that required fields (like `id`) are present
- Review add-on logs for specific validation error messages

### Backup Restoration

If a write operation fails, the add-on automatically restores from the most recent backup. Check the add-on logs for details about what failed and which backup was restored.
