# UI/UX Design Brief — Warehouse Zone Monitoring Dashboard

## 1. The Bar
This must not look like a default AI-generated admin template. No generic blue-gradient SaaS look, no unstyled shadcn defaults, no Bootstrap-era centered cards on white backgrounds.

**Acceptance test:** if someone looked at this dashboard with no context, they should assume "a senior frontend engineer designed this for a real company" — not "someone scaffolded a dashboard and left the defaults."

## 2. Required Skills — Invoke Before Any Component Work
Before writing a single frontend component, invoke:
- **`/ui-styling`**
- **`/ui-ux-pro-max`**

Follow their guidance for every screen in this project. If either skill conflicts with a visual/design decision made elsewhere in these docs, **the skill wins** on visual/design matters. These docs (PRD/TRD/app flow/schema) win on data and functional correctness — the skills don't get to change what data is shown, only how.

## 3. What the Skills Need to Cover Here

**Color system**
A deliberate palette, not Tailwind defaults (`blue-500` everywhere is a tell). Alarm severity in particular needs a non-cliché, considered color language — not just red/yellow/green traffic lights slapped on by default.

**Typography**
A real type scale with intention behind it — not default browser sizes, not every heading the same weight.

**Spacing & layout rhythm**
Intentional grid system. This is a data-dense ops tool — avoid the instinct to center everything in a 600px card like a landing page.

**Data density handling**
Behind this UI is 1M+ sensor readings and 10k lots. Charts and tables need to read like a real ops tool — think Linear, Vercel, Datadog-grade polish — not a tutorial chart with default axis labels.

**Micro-interactions**
Hover states, transitions on alarm status changes, loading states. Subtle, purposeful — not gimmicky animation for its own sake.

## 4. Screen-by-Screen Design Notes
- **Warehouse Overview** — at-a-glance risk status across 10 warehouses. This is the first impression; it needs to read as "serious monitoring tool" in the first two seconds.
- **Zone Detail** — time-series charts for temp/humidity, occupancy, door log, sensor status. Sensor outages must be visibly represented as real gaps in the chart, not smoothed over or shown as flat zero lines.
- **Alarm Center** — filterable, expandable. Each alarm expands to show the rule that fired and the linked lots — this needs a clear information hierarchy (what happened → why → what's affected).
- **Inspection/Remediation Tracker** — status-forward, workflow-style (think ticket tracker, not a form).
- **Ground Truth/QA view** — simpler, internal-feeling, but should still follow the same type scale and color system for consistency. It's for verification, not a customer-facing feature.

## 5. What to Avoid
- Default component library styling left untouched
- Decorative illustrations with no information value
- Centered single-column layouts on data-dense screens
- Overused shadows/gradients as a substitute for real visual hierarchy
- Any screen that looks identical to a tutorial/boilerplate dashboard
