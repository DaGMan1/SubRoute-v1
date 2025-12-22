# 🐛 Quick Bug Reporting Reference

## 📱 While Driving (10 Seconds)

**ONLY when safely stopped!** (Red light, parked, etc.)

### Minimum Required:
1. Open Notion mobile
2. Add to "SubRoute Bugs" database
3. Enter **Title** - "What's broken?" (e.g., "Map not loading")
4. Select **Severity**:
   - 🔴 **Critical** - Can't work
   - 🟠 **High** - Major issue, have workaround
   - 🟡 **Medium** - Annoying
   - 🟢 **Low** - Minor
5. Done!

### Optional (if you have time):
- **Description** - Quick note about what happened
- **Steps** - How to reproduce (voice dictate is fastest!)

---

## 🏢 Back at Office (Afternoon)

### Step 1: Sync Bugs
Ask Claude:
```
"Read all bugs from Notion"
```

### Step 2: Fix Bugs
Ask Claude:
```
"Fix all critical bugs"
or
"Fix the [bug name] bug"
```

### Step 3: Done!
- Claude fixes and deploys automatically
- Bug status updates in Notion
- You get notifications when resolved

---

## 💡 Example Reports

### Quick (10 sec):
```
Title: Waze button broken
Severity: High
```

### With Details (30 sec):
```
Title: Route clears after completing trip
Severity: Critical
Description: After I click Complete Trip, the whole route disappears
```

### Detailed (when parked):
```
Title: Address history not working
Severity: Medium
Description: My addresses don't save to history
Steps:
1. Search for address
2. Add as delivery
3. Complete trip
4. Next time - address not in history
```

---

## 📋 Severity Guide

| Severity | When to Use | Example |
|----------|-------------|---------|
| 🔴 **Critical** | Can't do your job | App crashes, can't login, no map |
| 🟠 **High** | Major feature broken, but have workaround | Waze broken (use Google instead) |
| 🟡 **Medium** | Annoying but not blocking | Small buttons, slow loading |
| 🟢 **Low** | Nice to fix eventually | UI tweaks, minor visual issues |

---

## ⚡ Pro Tips

1. **Voice Dictation** - Fastest way to add description while stopped
2. **Screenshots** - Take a screenshot, attach in Notion (super helpful!)
3. **Batch Report** - If you find 3-4 bugs during the day, report them all at once at end of shift
4. **Be Specific** - "Map not loading" is better than "Something wrong with map"
5. **Safety First** - NEVER report while moving. Pull over or wait for red light.

---

## 🔗 Full Documentation

See [BUG-TRACKING-GUIDE.md](docs/BUG-TRACKING-GUIDE.md) for complete setup and workflow details.
