# Notion Roadmap Sync

This system automatically syncs your SubRoute development roadmap from Notion to a `ROADMAP.md` file in your repository.

## How It Works

The system uses Claude's Notion integration to:
1. Query your Notion database for all tasks
2. Parse task properties (status, priority, phase, dependencies, etc.)
3. Generate a formatted markdown file
4. Commit the changes to your repository

## Files

- `notion_sync.py` - Main sync script
- `ROADMAP.md` - Generated roadmap file (auto-updated)
- `.github/workflows/notion-sync.yml` - GitHub Action (optional, for automation)

## Usage

### Manual Sync

Run the sync script directly:

```bash
python3 scripts/notion_sync.py --test
```

This will generate a preview of the ROADMAP.md file using test data.

### With Claude Code

Since you're using Claude Code with Antigravity IDE, you can simply ask Claude to:
- "Update the roadmap from Notion"
- "Sync the latest tasks"
- "Check if the roadmap is current"

Claude will fetch the data from Notion and update ROADMAP.md automatically.

### Automated Sync (Optional)

Set up a GitHub Action to sync automatically on a schedule or when Notion changes:

```yaml
name: Sync Roadmap from Notion

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Sync from Notion
        run: |
          # Claude will handle the sync via MCP
          echo "Syncing roadmap..."
```

## Configuration

The sync script is configured for:
- **Database**: SubRoute Development Roadmap
- **Data Source**: `collection://d9b993fa-60a1-40c6-91e1-f484ed456fe0`
- **Properties**: Task, Status, Priority, Phase, Dependencies, Due Date, Effort, Notes

## Notion Database Structure

Your Notion database should have these properties:
- **Task** (Title) - Task name
- **Status** (Select) - Not Started, In Progress, Blocked, Review, Complete
- **Priority** (Select) - Critical, High, Medium, Low
- **Phase** (Select) - Foundation/Setup, Phase 1-3
- **Dependencies** (Text) - What needs to be done first
- **Due Date** (Date) - Target completion date
- **Effort (Days)** (Number) - Estimated effort
- **Notes** (Text) - Additional context

## Updating the Roadmap

### In Notion:
1. Add/edit tasks in your roadmap database
2. Update status, priority, phases as work progresses
3. Mark tasks complete with checkboxes

### Sync to Repository:
1. Ask Claude: "Update the roadmap"
2. OR run the sync script manually
3. OR let GitHub Actions handle it automatically

## Benefits

✅ Single source of truth in Notion
✅ Always up-to-date documentation in your repo
✅ Easy to track progress over time via git history
✅ Teammates can see roadmap without Notion access
✅ Automatic formatting and organization

## Future Enhancements

- [ ] Bi-directional sync (update Notion from git commits)
- [ ] Slack notifications when tasks are completed
- [ ] Auto-generate release notes from completed tasks
- [ ] Integration with PR descriptions
