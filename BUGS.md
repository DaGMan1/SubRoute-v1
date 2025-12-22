# SubRoute Bug & Issue Tracker

*Last updated: 2025-12-23 07:05*

---

## Open

### Waze navigation goes to wrong address 🟠 **High**

**Reported:** 2025-12-22

**Description:** When clicking Waze with multiple stops, it navigates to pickup instead of delivery

**Steps to Reproduce:**
1. Add multiple stops
2. Click Waze button
3. It opens pickup address instead of delivery

---

## Resolved

### Complete Trip button clears route 🔴 **Critical**

**Reported:** 2025-12-22

**Description:** After completing trip, entire route disappears from screen

**Fix Notes:** Removed clearAll() call, only reset routeStartTime

**Fix Commit:** `a357dd0`

---

## 📱 Quick Reporting Guide

While driving, quickly add to Notion:
1. **Title** - Short description (e.g., "Waze button not working")
2. **Severity** - Critical, High, Medium, or Low
3. **Description** - What happened?
4. **Steps** - How to reproduce (optional)

Claude will read these in the afternoon and create fixes! 🤖

