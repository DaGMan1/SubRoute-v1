#!/bin/bash

# SubRoute Notion Sync Wrapper
# This script helps you sync your roadmap from Notion

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 SubRoute Notion Roadmap Sync"
echo "================================"
echo ""

# Check if running in test mode
if [ "$1" == "--test" ] || [ "$1" == "-t" ]; then
    echo "📝 Running in TEST mode with mock data..."
    python3 "$SCRIPT_DIR/notion_sync.py" --test > "$SCRIPT_DIR/../ROADMAP.md"
    echo "✅ Test ROADMAP.md generated!"
    echo ""
    echo "Preview:"
    head -n 20 "$SCRIPT_DIR/../ROADMAP.md"
    exit 0
fi

# For real sync, we'll use Claude Code integration
echo "💡 To sync real data from Notion, use Claude Code:"
echo ""
echo "   Just ask Claude:"
echo "   'Update the roadmap from Notion'"
echo "   'Sync my latest tasks'"
echo ""
echo "   Or run: python3 scripts/notion_sync.py --test"
echo ""
echo "📖 See README-SYNC.md for more details"
