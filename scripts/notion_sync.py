#!/usr/bin/env python3
"""
SubRoute Notion Roadmap & Bug Tracking Sync
This script uses Claude's Notion integration to fetch roadmap data and bugs, then generates:
- ROADMAP.md (development tasks and features)
- BUGS.md (active bugs and issues)
"""

import json
import sys
from datetime import datetime

# Database collection IDs
ROADMAP_DB_URL = "collection://d9b993fa-60a1-40c6-91e1-f484ed456fe0"
BUGS_DB_ID = "2c94ca3fb25f81568875fb80290c01a7"  # Will be updated with actual bug database ID

def generate_markdown(tasks):
    """Generate markdown from task data"""
    
    md = "# SubRoute Development Roadmap\n\n"
    md += f"*Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n\n"
    md += "---\n\n"
    
    # Group by phase
    phases = {
        'Foundation/Setup': [],
        'Phase 1: Multi-Route': [],
        'Phase 2: ATO Logbook': [],
        'Phase 3: Fleet Management': []
    }
    
    for task in tasks:
        phase = task.get('Phase', 'Foundation/Setup')
        if phase not in phases:
            phases[phase] = []
        phases[phase].append(task)
    
    # Generate markdown for each phase
    for phase_name, phase_tasks in phases.items():
        if not phase_tasks:
            continue
            
        md += f"## {phase_name}\n\n"
        
        for task in phase_tasks:
            status = task.get('Status', 'Not Started')
            checkbox = '[x]' if status == 'Complete' else '[ ]'
            title = task.get('Task', 'Untitled')
            priority = task.get('Priority', '')
            effort = task.get('Effort (Days)', '')
            
            priority_str = f" **{priority}**" if priority else ""
            effort_str = f" ({effort}d)" if effort else ""
            
            md += f"- {checkbox} {title}{priority_str}{effort_str}\n"
            md += f"  - Status: {status}\n"
            
            if task.get('Dependencies'):
                md += f"  - Dependencies: {task['Dependencies']}\n"
            
            if task.get('Notes'):
                md += f"  - Notes: {task['Notes']}\n"
            
            if task.get('Due Date'):
                md += f"  - Due: {task['Due Date']}\n"
                
            md += "\n"
    
    md += "---\n\n"
    md += "## Legend\n\n"
    md += "- **Critical**: Blocking other work\n"
    md += "- **High**: Important for current phase\n"
    md += "- **Medium**: Nice to have\n"
    md += "- **Low**: Future consideration\n"
    md += "- (Xd): Estimated effort in days\n"

    return md

def generate_bugs_markdown(bugs):
    """Generate markdown from bug data"""

    md = "# SubRoute Bug & Issue Tracker\n\n"
    md += f"*Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n\n"
    md += "---\n\n"

    # Group by status
    statuses = {
        'Open': [],
        'In Progress': [],
        'Fixed (Pending Deploy)': [],
        'Resolved': []
    }

    for bug in bugs:
        status = bug.get('Status', 'Open')
        if status not in statuses:
            statuses[status] = []
        statuses[status].append(bug)

    # Generate markdown for each status
    for status_name, status_bugs in statuses.items():
        if not status_bugs:
            continue

        md += f"## {status_name}\n\n"

        for bug in status_bugs:
            title = bug.get('Title', 'Untitled Bug')
            severity = bug.get('Severity', '')
            reported_date = bug.get('Reported Date', '')
            description = bug.get('Description', '')
            steps = bug.get('Steps to Reproduce', '')
            fix_notes = bug.get('Fix Notes', '')
            commit = bug.get('Fix Commit', '')

            # Bug header with severity
            severity_emoji = {
                'Critical': '🔴',
                'High': '🟠',
                'Medium': '🟡',
                'Low': '🟢'
            }.get(severity, '⚪')

            severity_str = f" {severity_emoji} **{severity}**" if severity else ""

            md += f"### {title}{severity_str}\n\n"

            if reported_date:
                md += f"**Reported:** {reported_date}\n\n"

            if description:
                md += f"**Description:** {description}\n\n"

            if steps:
                md += f"**Steps to Reproduce:**\n{steps}\n\n"

            if fix_notes:
                md += f"**Fix Notes:** {fix_notes}\n\n"

            if commit:
                md += f"**Fix Commit:** `{commit}`\n\n"

            md += "---\n\n"

    # Add quick reporting guide
    md += "## 📱 Quick Reporting Guide\n\n"
    md += "While driving, quickly add to Notion:\n"
    md += "1. **Title** - Short description (e.g., \"Waze button not working\")\n"
    md += "2. **Severity** - Critical, High, Medium, or Low\n"
    md += "3. **Description** - What happened?\n"
    md += "4. **Steps** - How to reproduce (optional)\n\n"
    md += "Claude will read these in the afternoon and create fixes! 🤖\n"

    return md

def main():
    """Main execution - expects task/bug data from stdin"""

    sync_type = 'roadmap'  # default
    if len(sys.argv) > 1:
        if sys.argv[1] == '--bugs':
            sync_type = 'bugs'
        elif sys.argv[1] == '--test-bugs':
            sync_type = 'test-bugs'
        elif sys.argv[1] != '--test':
            sync_type = sys.argv[1].replace('--', '')

    print(f"🚀 SubRoute Notion Sync ({sync_type})", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    # Handle test modes
    if len(sys.argv) > 1 and '--test' in sys.argv[1]:
        if sync_type == 'test-bugs':
            # Test mode with mock bug data
            bugs = [
                {
                    'Title': 'Waze navigation goes to wrong address',
                    'Status': 'Open',
                    'Severity': 'High',
                    'Reported Date': '2025-12-22',
                    'Description': 'When clicking Waze with multiple stops, it navigates to pickup instead of delivery',
                    'Steps to Reproduce': '1. Add multiple stops\n2. Click Waze button\n3. It opens pickup address instead of delivery'
                },
                {
                    'Title': 'Complete Trip button clears route',
                    'Status': 'Resolved',
                    'Severity': 'Critical',
                    'Reported Date': '2025-12-22',
                    'Description': 'After completing trip, entire route disappears from screen',
                    'Fix Notes': 'Removed clearAll() call, only reset routeStartTime',
                    'Fix Commit': 'a357dd0'
                }
            ]
            print(f"✅ Processing {len(bugs)} bugs (TEST MODE)...", file=sys.stderr)
            markdown = generate_bugs_markdown(bugs)
        else:
            # Test mode with mock roadmap data
            tasks = [
                {
                    'Task': 'Fix Deployment Pipeline',
                    'Status': 'In Progress',
                    'Priority': 'Critical',
                    'Phase': 'Foundation/Setup',
                    'Effort (Days)': 2,
                    'Notes': 'Configure cloudbuild.yaml and app.yaml'
                },
                {
                    'Task': 'Build Multi-Route Optimization Engine',
                    'Status': 'Not Started',
                    'Priority': 'High',
                    'Phase': 'Phase 1: Multi-Route',
                    'Effort (Days)': 10,
                    'Dependencies': 'Fix Deployment Pipeline'
                }
            ]
            print(f"✅ Processing {len(tasks)} tasks (TEST MODE)...", file=sys.stderr)
            markdown = generate_markdown(tasks)
    else:
        # Read from stdin (real data from Claude/Notion)
        try:
            data = sys.stdin.read()
            items = json.loads(data)

            if sync_type == 'bugs':
                print(f"✅ Processing {len(items)} bugs...", file=sys.stderr)
                markdown = generate_bugs_markdown(items)
            else:
                print(f"✅ Processing {len(items)} tasks...", file=sys.stderr)
                markdown = generate_markdown(items)
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing input: {e}", file=sys.stderr)
            sys.exit(1)

    # Output markdown to stdout
    print(markdown)

    print(f"\n✨ Sync complete!", file=sys.stderr)

if __name__ == '__main__':
    main()
