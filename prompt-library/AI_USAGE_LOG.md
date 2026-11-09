# AI Usage Log — Transparency Disclosure

This project was built using two AI tools: **Claude** (for specification, planning, and review) and **GitHub Copilot** (for implementation inside VS Code). This log explains what each tool was used for, and — more importantly — where I personally caught, corrected, or redirected AI output rather than accepting it as-is.

---

## Tools Used

**Claude** — Used to turn a loose assignment brief into structured specs (PRD, TRD, app flow, UI/UX design brief, backend schema, implementation plan), and as a second set of eyes to review what Copilot produced at each stage before moving forward.

**GitHub Copilot (VS Code)** — Used to write the actual code: the Python data generator, the FastAPI backend, and the React/TypeScript frontend, following the specs.

---

## Where AI Accelerated the Work

- Turning the assignment PDF into six structured planning documents (PRD/TRD/app flow/UI brief/schema/implementation plan) — this saved significant time versus writing them from scratch, and gave Copilot a clear, phased brief to execute against instead of a vague prompt.
- Initial scaffolding: repo structure, data generator skeleton, FastAPI boilerplate, React/Vite/Tailwind setup.
- First-pass implementation of the entity generators, ID scheme, validation suite, and dashboard components against the written specs.
- Drafting fix instructions once I identified a problem — once I knew *what* was wrong, Claude helped me write precise, scoped prompts so Copilot fixed exactly the right thing without scope creep.

## Where I Personally Reviewed, Caught, and Fixed Things

This is the part that actually mattered, and it's where my own judgment — not the AI's — drove the outcome:

**1. Caught that three of five dashboard screens were silently using fake/mock data.**
Early versions of the Zone Detail chart, the Follow-up Tracker, and parts of the Overview page looked finished but were rendering hardcoded placeholder values instead of calling the real backend. I noticed this by reading the actual component code rather than trusting that "it looks done" meant "it's wired correctly," and directed a fix to wire every screen to real endpoints and replace fake fallbacks with honest empty states.

**2. Caught a production-breaking data bug by reading the output, not just the code.**
After a scale-up test, the Alarm Center showed **238,638 open alarms** from a 7-warehouse dataset — a number that was obviously wrong for a monitoring tool meant to surface rare, meaningful events. I flagged this as a real problem rather than a styling issue, which led to finding the root cause: the alarm logic used a hardcoded global temperature range (`value > 25 or value < -10`) instead of checking each reading against its own zone's actual storage requirement. Cold-chain zones running at normal operating temperatures (~-18°C) were being flagged as alarms on almost every reading.

I directed the fix (resolve reading → zone → storage requirement → correct bounds) and insisted on reverification before moving forward. After the fix: 1 alarm from 700,000 readings — in line with the single injected test excursion, confirming the logic was now correct.

**Evidence — actual code change:**

```python
# BEFORE
if value > 25 or value < -10:
    alarm_rows.append(...)

# AFTER
requirement = requirements_by_zone[reading["zone_id"]]
value = float(reading["value"])
if value < float(requirement["min_temp_c"]) or value > float(requirement["max_temp_c"]):
    alarm_rows.append(...)
```

**3. Caught a UI readability/axis-scaling problem that made real data look broken.**
The Zone Detail temperature chart had a hardcoded y-axis range that squashed the real temperature variation into a thin band at the top of the chart, making correct data look flat and lifeless. I caught this by actually reading the chart, not just confirming the endpoint returned 200 OK, and had the axis changed to scale to the real data range.

This also exposed that the chart was reading from a client-side mock array instead of the backend at all. I required a real aggregation endpoint instead of shipping raw readings to the browser:

```python
# BEFORE
# No bounded aggregation endpoint existed — frontend used a hardcoded mock array

# AFTER
@app.get("/api/readings/series")
async def readings_series(
    zone_id: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(288, ge=1, le=1000),
    bucket_minutes: int = Query(5, ge=1, le=1440),
) -> dict[str, Any]:
    rows = connection.execute(
        """SELECT
            strftime('%Y-%m-%dT%H:%M:00Z', timestamp,
                printf('-%d minutes', CAST(strftime('%M', timestamp) AS INTEGER) % ?)
            ) AS bucket,
            ROUND(AVG(value), 2) AS average_value,
            ROUND(MIN(value), 2) AS minimum_value,
            ROUND(MAX(value), 2) AS maximum_value,
            COUNT(*) AS sample_count
        FROM sensor_readings
        WHERE zone_id = ?
        GROUP BY bucket
        ORDER BY bucket DESC
        LIMIT ? OFFSET ?""",
        (bucket_minutes, zone_id, page_size, offset),
    ).fetchall()
```

This endpoint aggregates on the backend (5-minute buckets) rather than sending the full 1M-row table to the browser, per the non-functional requirement in `02_TRD.md`.

**4. Caught that a "penetration test" result was mislabeled.**
When a security-testing pass reported two "risky issues fixed," I reviewed what was actually changed and recognized that neither fix was a security vulnerability — one was a keyboard-accessibility fix, the other a UX/status-indicator fix. I flagged this distinction rather than accepting the "security issue resolved" framing at face value, and used it to decide what an actual security review of this project would need to check instead.

**5. Ran a structured, multi-stage readiness audit before calling anything "done."**
Rather than accepting "it looks good" at each step, I had every change independently reverified (fresh backend/frontend startup, validation suite, reproducibility check, full-scale dataset generation) before signing off. When a readiness report came back with gaps — missing full README walkthrough, thin decisions log, an inaccurate fallback-behavior claim — I had each one addressed and reverified rather than treating the first draft as final.

**6. Made the call on documentation accuracy myself.**
When an AI tool correctly declined to document the alarm-threshold bug fix because it couldn't independently verify it from its own session's context, I recognized that gap and added the entry to `DECISIONS.md` myself, in my own words, because I had the actual evidence (the before/after alarm counts, the logs, the root cause) from having driven the fix firsthand.

---

## Summary

AI tools wrote a large share of the code and the first draft of most documents. What made the project actually correct and submission-ready was reading the real output at every stage — not the code in isolation, but what the running system actually produced — and catching the gap between "looks finished" and "is actually correct" before moving forward each time.
