# Home Automation API Add-on

## Purpose

This Home Assistant add-on exposes automations through a REST API with:

- long-lived token authentication
- operation-level permissions (`list`, `read`, `edit`, `delete`)
- serialized write operations (only one write request at a time)
- temp-copy write validation
- backup + revert protection

## Add-on Installation

1. Push this repository to GitHub.
2. In Home Assistant, open **Settings -> Add-ons -> Add-on Store**.
3. Open the overflow menu and choose **Repositories**.
4. Add the repository URL for this project.
5. Install **Home Automation API**.
6. Configure options and start the add-on.

## Add-on Options

- `allow_list`: Enable `GET /automations`
- `allow_read`: Enable `GET /automations/:id`
- `allow_edit`: Enable `PUT /automations/:id`
- `allow_delete`: Enable `DELETE /automations/:id`
- `automations_file`: Path to the automation YAML file (default `/config/automations.yaml`)
- `backup_keep`: Number of backups to keep (default `10`)
- `home_assistant_url`: Home Assistant URL used for token validation and reload calls

## Authentication

All endpoints require:

`Authorization: Bearer <home_assistant_long_lived_token>`

The token is validated by calling Home Assistant `/api/`.

## Endpoints

- `GET /health`
- `GET /automations`
- `GET /automations/:id`
- `PUT /automations/:id`
- `DELETE /automations/:id`

### `PUT /automations/:id` body

```json
{
  "automation": {
    "alias": "Updated alias",
    "description": "Updated by API"
  }
}
```

If `automation` is omitted, the request body itself is treated as the automation object.

## Write Safety Flow

For edit/delete operations:

1. Load and validate the full YAML structure.
2. Build updated automation list in memory.
3. Write updated list to a temp file (`automations.yaml.new`).
4. Re-read and validate temp file.
5. Create a timestamped backup (`automations.yaml.bak.<timestamp>`).
6. Delete current `automations.yaml`.
7. Rename temp file to `automations.yaml`.
8. Reload automations through Home Assistant API.
9. On failure, restore from backup.

## Concurrency Model

Only one `PUT` or `DELETE` request can run at a time.  
If another write is in progress, the add-on responds with `HTTP 429`.

## Error Codes

- `401`: Missing or invalid bearer token
- `403`: Operation disabled by add-on permissions
- `404`: Automation ID not found
- `422`: Invalid payload or invalid YAML
- `429`: Write lock active
- `500`: Internal failure (including write/reload/revert errors)
