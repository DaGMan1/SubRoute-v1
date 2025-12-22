#!/usr/bin/env python3
"""
SubRoute Notion Roadmap Sync
This script uses Claude's Notion integration to fetch roadmap data and generate ROADMAP.md
"""

import json
import sys
from datetime import datetime

DATA_SOURCE_URL = "collection://d9b993fa-60a1-40c6-91e1-f484ed456fe0"

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

def main():
    """Main execution - expects task data from stdin"""
    
    print("🚀 SubRoute Notion Sync", file=sys.stderr)
    print("=" * 50, file=sys.stderr)
    
    # Read task data from stdin (will be provided by Claude)
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        # Test mode with mock data
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
    else:
        # Read from stdin
        try:
            data = sys.stdin.read()
            tasks = json.loads(data)
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing input: {e}", file=sys.stderr)
            sys.exit(1)
    
    print(f"✅ Processing {len(tasks)} tasks...", file=sys.stderr)
    
    # Generate markdown
    markdown = generate_markdown(tasks)
    
    # Output markdown to stdout
    print(markdown)
    
    print(f"\n✨ Sync complete!", file=sys.stderr)

if __name__ == '__main__':
    main()
