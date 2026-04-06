# Stop Management & Navigation Redesign

**Date:** 2026-04-06  
**Status:** Approved

---

## Problem

1. **Done button** triggers trip logging logic and navigates away — it should simply mark a stop complete and stay put.
2. **Stop state model** has no concept of "active" vs "pending" — the driver can't tell at a glance what they're heading to vs what's waiting.
3. **Navigation coordinates** (raw lat/lng) frequently route to the wrong side of the road. Google Maps and Waze resolve street addresses far more accurately.
4. **Stop ordering** is manual — the driver has to mentally calculate nearest stop, leading to inefficient routes.

---

## Design Decisions

### 1. Three stop states: PENDING → ACTIVE → DONE

- **PENDING** — stop is in the queue, not yet navigating to it
- **ACTIVE** — driver has tapped GO, currently heading there. Only one stop can be Active at a time.
- **DONE** — stop completed. No further action required.

### 2. Stop list order

- **Active** stop always at the top
- **Pending** stops in the middle, sorted by distance from current GPS location (nearest first)
- **Done** stops at the bottom, in completion order

### 3. Interruption handling — zero taps

When the driver taps GO on any Pending stop:
- The current Active stop silently returns to **PENDING**
- The tapped stop becomes **ACTIVE**
- Navigation opens immediately
- No confirmation prompt, no modal, no extra taps

This handles mid-route diversions naturally — the interrupted stop stays in the queue and re-sorts by distance automatically.

### 4. Done button behaviour

- Marks the stop as **DONE**
- Moves it to the bottom of the list
- Screen stays exactly where it is — no redirect, no modal, no trip log prompt
- No greying out — completed cards display plainly with no buttons

### 5. Card layout

Each stop card displays:
```
[STATUS BADGE]              [type · distance]
Full Street Address
Suburb, State Postcode
[────── ACTION BUTTON(S) ──────]
```

- Address always full width — suburb always visible to avoid same-street/different-suburb confusion
- Buttons always below the address, never beside it

**Pending card:**
- Badge: PENDING (amber)
- Button: GO (blue, full width)

**Active card:**
- Badge: ACTIVE (green)
- Buttons: DONE (green) + RE-NAV (grey, re-opens navigation app)

**Done card:**
- Badge: ✓ DONE
- No buttons
- No greying out, no strikethrough — just sits at the bottom plainly

### 6. Navigation — address text, not coordinates

Current behaviour sends raw lat/lng to Google Maps/Waze:
```
https://maps.google.com/?q=-27.4698,153.0251
```

New behaviour sends the address string:
```
https://www.google.com/maps/dir/?api=1&destination=12+Smith+Street+Fortitude+Valley+QLD
```

Google Maps and Waze resolve street addresses to correct entry points far more reliably than coordinates. The driver's choice of nav app (Google Maps or Waze) is set once in Settings and applies everywhere — no per-stop nav app buttons.

---

## 3-Tap Rule

Every action must be completable in 3 taps or fewer:

| Action | Taps |
|--------|------|
| Navigate to a stop | 1 (GO) |
| Mark a stop done | 1 (DONE) |
| Divert to different stop mid-route | 1 (GO on new stop) |
| Add a new stop | 2 (search → select) |

---

## Out of Scope (for now)

- Pin adjustment for problematic addresses
- Multi-stop route optimisation (full TSP)
- Arrival detection / geofence prompts
- Per-stop notes or photos
