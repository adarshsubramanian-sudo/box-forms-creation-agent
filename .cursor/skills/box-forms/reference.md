# Box Forms UI Reference

Map for browser automation in the Box web application.

## Navigation

| Step | Action |
|------|--------|
| 1 | Open `{BOX_DEMO_URL}` (from `.env`) |
| 2 | Left nav → **Relay** (or top nav depending on Box layout) |
| 3 | **Forms** tab within Relay |
| 4 | **New +** button to create a form |

## Login detection

Stop automation if the page shows:
- Email/password login form
- SSO redirect with "Sign in"
- URL contains `/login`

Ask the user to authenticate, then retry from step 1.

## Form builder layout

| Region | Contents |
|--------|----------|
| Header | Form title, save, preview, share |
| Canvas | Drag-and-drop field list |
| Field palette | Available field types |
| Field settings | Label, required, placeholder, options |
| Logic panel | Conditional rules (If / Then) |
| Branding | Theme color, header logo |

## Adding fields

Three methods (prefer inline add when available):
1. Drag field type from palette onto canvas
2. Click **Add a Field** at bottom of form
3. Inline "+" between existing fields

After adding, configure in field settings panel:
- **Label** — match FormSpec `label` exactly
- **Required** — toggle if `required: true`
- **Placeholder** — if spec includes `placeholder`
- **Options** — for radio/dropdown/checkbox, add each option value/label

## Field type mapping

| FormSpec | Box UI name | Notes |
|----------|-------------|-------|
| `short_text` | Short Text | Use for dates if no date picker |
| `long_text` | Long Text | Multi-line |
| `checkbox` | Checkbox | Multi-select options |
| `radio` | Radio | Single select |
| `dropdown` | Dropdown | Single select menu |
| `number` | Number | Numeric validation |
| `file_upload` | File Upload | Accepts files |
| `email` | Email Address | Email validation |
| `metadata` | Metadata | Requires template selection |

## Conditional logic UI

1. Open **Logic** or **Add Logic** in form builder
2. **If** block:
   - Choose **All Conditions** or **Any Conditions** (maps to `match: all|any`)
   - Add conditions: field, operator, value
3. **Then** block:
   - Outcome: Show/Hide Fields or Enable/Disable Fields
   - Select target field(s)

Operator mapping:

| FormSpec operator | Box UI |
|-------------------|--------|
| `equals` | is equal to |
| `not_equals` | is not equal to |
| `contains` | contains |
| `not_contains` | does not contain |
| `is_empty` | is empty |
| `is_not_empty` | is not empty |
| `greater_than` | is greater than |
| `less_than` | is less than |

## Branding

1. Open form **Settings** or **Branding** section
2. **Theme color** — enter hex or pick from palette
3. **Header logo** — upload or URL if supported

## Preview and verification

1. Click **Preview** tab
2. Verify all fields appear in order
3. Test logic: change trigger field values, confirm show/hide behavior
4. Capture screenshot for grader L3 check
5. Preview submissions are not saved to submissions page

## Unique titles (March 2026+)

Box requires unique **Form Titles**. If save fails with duplicate title:
- Append `-YYYYMMDD-HHMMSS` to title
- Retry save

Form **names** (display) may duplicate; titles may not.

## Common selectors (accessibility-first)

Use `browser_snapshot` to get element refs before clicking. Typical patterns:
- Button "New" or "New +"
- Tab "Forms"
- Tab "Preview"
- Button "Add a Field"
- Toggle "Required"

Do not hardcode refs — always snapshot fresh before interaction.

## Environment

| Variable | Usage |
|----------|-------|
| `BOX_DEMO_URL` | Base URL for navigation |
| `BOX_SESSION_FILE` | Optional persisted session |

Never log or commit credentials.
