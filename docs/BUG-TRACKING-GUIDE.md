# SubRoute Bug Tracking System

## Overview
Report bugs while driving using Notion mobile app → Claude reads them in the afternoon → Fixes get deployed automatically!

---

## 🎯 How It Works

1. **While Driving** - You spot a bug
   - Open Notion mobile app
   - Add quick entry to "SubRoute Bugs" database
   - Just add Title + Severity (takes 10 seconds!)

2. **Back at Office** - You ask Claude
   - "Read all the bugs from Notion"
   - Claude fetches bug list and generates BUGS.md
   - Claude fixes bugs one by one

3. **Automatic Deploy** - Fixes go live
   - Claude commits fixes with bug references
   - Vercel auto-deploys to production
   - Bug status updates to "Resolved"

---

## 📱 Setting Up Your Notion Bug Database

### Create the Database

1. **In Your Notion Workspace**
   - Create a new database: "SubRoute Bugs & Issues"
   - Choose "Table" view

2. **Add These Properties:**

| Property Name | Type | Options | Required |
|---------------|------|---------|----------|
| **Title** | Title | - | ✅ Yes |
| **Status** | Select | Open, In Progress, Fixed (Pending Deploy), Resolved | ✅ Yes |
| **Severity** | Select | Critical 🔴, High 🟠, Medium 🟡, Low 🟢 | ✅ Yes |
| **Reported Date** | Date | - | Optional |
| **Description** | Text | - | Optional |
| **Steps to Reproduce** | Text | (Use multi-line) | Optional |
| **Fix Notes** | Text | (Claude fills this) | Optional |
| **Fix Commit** | Text | (Claude fills this) | Optional |
| **Fixed Date** | Date | - | Optional |

3. **Set Default Values**
   - Status: "Open"
   - Severity: "Medium"
   - Reported Date: "Today"

---

## 🚗 Quick Reporting While Driving

### Safety First!
- ONLY report bugs when safely stopped (red light, parked, etc.)
- Use voice dictation if available
- Keep it SHORT - you can add details later

### Minimum Required:
1. **Title** - What's broken? (e.g., "Waze button goes to wrong place")
2. **Severity** - How bad?
   - 🔴 **Critical** - App unusable, can't work
   - 🟠 **High** - Major feature broken, workaround possible
   - 🟡 **Medium** - Annoying but not blocking
   - 🟢 **Low** - Minor issue, nice to fix

### Examples:

**Example 1: Quick Report (10 seconds)**
```
Title: Map not showing route
Severity: Critical
```

**Example 2: With Details (30 seconds)**
```
Title: Google Maps button doesn't work
Severity: High
Description: When I click Google Maps, nothing happens
Reported Date: Today
```

**Example 3: Detailed (when you have time)**
```
Title: Address history not saving
Severity: Medium
Description: I add addresses but they don't show up in history next time
Steps to Reproduce:
1. Search for an address
2. Click "Go Here"
3. Complete the delivery
4. Search again - address not in history
Reported Date: Today
```

---

## 🏢 Using the Bug Tracker (Afternoon Workflow)

### Step 1: Sync Bugs from Notion
Ask Claude Code:
```
"Read all bugs from Notion and show me the list"
```

Claude will:
- Connect to your Notion database
- Fetch all open bugs
- Generate BUGS.md file with organized list
- Show you the summary

### Step 2: Review Bug List
Claude shows you bugs organized by severity:
- 🔴 Critical bugs first
- 🟠 High priority next
- 🟡 Medium and 🟢 Low last

### Step 3: Fix Bugs
Ask Claude:
```
"Fix all critical bugs"
or
"Fix the Waze navigation bug"
or
"Work through the bug list starting with critical"
```

Claude will:
1. Read the bug description
2. Find the relevant code
3. Implement the fix
4. Test the fix
5. Commit with reference: "Fix: [Bug Title] (closes #X)"
6. Update Notion bug status to "Fixed (Pending Deploy)"

### Step 4: Deploy & Verify
```
"Deploy the fixes to production"
```

Claude will:
- Push to GitHub
- Vercel auto-deploys
- Update bug status to "Resolved"
- Add fix commit hash to Notion

---

## 🔄 Bug Status Workflow

```
[You Report]
    → Open 🆕

[Claude Starts Work]
    → In Progress 🔨

[Claude Commits Fix]
    → Fixed (Pending Deploy) ⏳

[Vercel Deploys]
    → Resolved ✅
```

---

## 📊 Notion Database Setup (Technical)

### Database Configuration

Once you create your "SubRoute Bugs & Issues" database in Notion:

1. **Get Database ID**
   - Open database in Notion
   - Copy URL: `https://www.notion.so/[workspace]/[DATABASE_ID]?v=...`
   - The DATABASE_ID is the long string before `?v=`

2. **Update Integration Access**
   - In Notion, click "..." on database
   - Click "Add connections"
   - Select "SubRoute Development" integration
   - This gives Claude access to read/write bugs

3. **Update Script Configuration**
   - Edit `scripts/notion_sync.py`
   - Update `BUGS_DB_ID` with your database ID

### Testing the Connection

```bash
# Test bug sync with mock data
python3 scripts/notion_sync.py --test-bugs > BUGS.md
cat BUGS.md

# Sync real bugs from Notion (after Claude Code restart)
# Just ask Claude: "Sync bugs from Notion"
```

---

## 💡 Pro Tips

### For Reporting
1. **Use Templates** - Create Notion template with common bug types
2. **Voice Dictation** - Use Notion's voice input while stopped
3. **Screenshots** - Notion mobile can attach images (super helpful!)
4. **Batch Reporting** - Note multiple bugs at end of day if safe

### For Fixing
1. **Prioritize Critical** - Always fix blocking bugs first
2. **Group Similar Bugs** - Claude can fix related issues together
3. **Test After Each Fix** - Verify in production before moving to next bug
4. **Update Notion** - Keep status current so you know what's fixed

### For Tracking
1. **Weekly Review** - Check resolved bugs weekly
2. **Patterns** - Look for common issues (might need bigger fix)
3. **Archive Old Bugs** - Move resolved bugs to archive view after 30 days

---

## 🛠️ Commands Reference

### Sync Commands
```bash
# Sync roadmap from Notion
./scripts/sync-roadmap.sh

# Sync bugs from Notion (via Claude)
# Just ask: "Update bugs from Notion"

# Test bug tracker
python3 scripts/notion_sync.py --test-bugs > BUGS.md
```

### Claude Commands (Natural Language)
```
"Read all bugs from Notion"
"Show me critical bugs"
"Fix the [bug title] bug"
"Fix all high priority bugs"
"Update bug status for [bug title]"
"Mark [bug title] as resolved"
"Sync bugs to GitHub"
```

---

## 📁 Files Generated

- **BUGS.md** - Current bug list (synced from Notion)
  - Organized by status (Open, In Progress, Fixed, Resolved)
  - Color-coded severity indicators
  - Links to commits for resolved bugs

- **ROADMAP.md** - Development roadmap (features/tasks)

Both files update automatically when you sync with Notion!

---

## 🔐 Security Notes

- Bug database is PRIVATE (only you and Claude have access)
- API tokens stored locally in Claude config
- NEVER commit Notion tokens to GitHub
- Bug details stay in your Notion workspace

---

## 🎉 Benefits

✅ **Fast Reporting** - 10 seconds while stopped at a light
✅ **Never Forget** - All bugs captured immediately
✅ **Organized** - Notion sorts by severity automatically
✅ **Automated Fixes** - Claude handles the coding
✅ **Version Control** - Every fix tracked in GitHub
✅ **Visible Progress** - See what's fixed vs. what's pending
✅ **No Context Switching** - Stay in Notion (familiar tool)

---

## 📞 Need Help?

### Bug Not Syncing?
1. Check Notion integration is connected to database
2. Verify database ID in `scripts/notion_sync.py`
3. Restart Claude Code to reload MCP connection
4. Ask Claude: "Check Notion connection status"

### Claude Can't See Bugs?
1. Ensure database is shared with integration
2. Check property names match exactly (case-sensitive)
3. Try test mode first: `python3 scripts/notion_sync.py --test-bugs`

### Questions?
Ask Claude! "How do I [task] with the bug tracker?"
