# HA Automation API Add-on

This repository contains a Home Assistant add-on that exposes automation management over HTTP.

## What It Does

The add-on provides these endpoints:

- `GET /health`
- `GET /automations`
- `GET /automations/:id`
- `PUT /automations/:id`
- `DELETE /automations/:id`

Core behavior:

- Uses a Home Assistant long-lived access token for every API call.
- Validates the caller token against Home Assistant `/api/`.
- Applies per-operation permission locks from add-on options.
- Handles writes safely:
  - validate YAML
  - write to temp copy
  - validate temp copy
  - backup current file
  - delete old file
  - rename temp file
  - reload automations
  - restore backup if reload/write fails
- Allows only one mutating request (`PUT`/`DELETE`) at a time; concurrent writes return `429`.

## Add This Add-on To Home Assistant

### 1) Add the repository

1. Open Home Assistant.
2. Go to **Settings -> Add-ons -> Add-on Store**.
3. Open the menu (top-right) and click **Repositories**.
4. Add this URL:

`https://github.com/runshotgun/HA-Automation-API`

5. Refresh add-ons.

### 2) Install and start

1. Open the **Home Automation API** add-on.
2. Click **Install**.
3. In the add-on **Configuration** tab, set options (example below).
4. Click **Start**.
5. Check **Logs** for startup success.

## Add-on Configuration

Example options:

```yaml
allow_list: true
allow_read: true
allow_edit: false
allow_delete: false
automations_file: /config/automations.yaml
backup_keep: 10
home_assistant_url: http://homeassistant:8123
```

Option meanings:

- `allow_list`: Allow listing all automations.
- `allow_read`: Allow reading one automation.
- `allow_edit`: Allow editing one automation.
- `allow_delete`: Allow deleting one automation.
- `automations_file`: Target YAML file to read/write.
- `backup_keep`: How many timestamped backups to keep.
- `home_assistant_url`: HA URL used for token validation and automation reload.

## Authentication

Send a Home Assistant long-lived token with each request:

`Authorization: Bearer <YOUR_LONG_LIVED_TOKEN>`

Create token in Home Assistant:

- Click profile avatar in HA (bottom-left in sidebar).
- Scroll to **Long-Lived Access Tokens**.
- Create token and store it securely.

## Quick API Examples

List automations:

```bash
curl -H "Authorization: Bearer <TOKEN>" http://homeassistant.local:8099/automations
```

Read one automation:

```bash
curl -H "Authorization: Bearer <TOKEN>" http://homeassistant.local:8099/automations/1673577999532
```

Update one automation:

```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"automation\":{\"alias\":\"Bedroom Shades Updated\"}}" \
  http://homeassistant.local:8099/automations/1673577999532
```

Delete one automation:

```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  http://homeassistant.local:8099/automations/1673577999532
```

## Troubleshooting

- `401`: Missing/invalid token.
- `403`: Requested operation is disabled in add-on config.
- `404`: Automation id not found.
- `422`: Invalid YAML or invalid request payload.
- `429`: Another write operation is already running.
- `500`: Internal error (check add-on logs and HA logs).

## Related Documentation

- Detailed design and behavior: `documentation/ha-automation-api.md`
