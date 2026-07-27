# Debug Session: dashboard-500-error

Status: **[OPEN]**
Started: 2026-07-27T06:50:00Z
User: Mariam
Environment: Vercel Prod (noor-app-backend-one.vercel.app) + Local Dev (localhost:3000)

## 1. Symptoms (Actual vs Expected)

**Actual**:
- `GET /api/v1/dashboard` returns HTTP 500 → `{success:false, message:"Internal server error", code:"INTERNAL_SERVER_ERROR"}`
- Suspected: other endpoints also fail (user asked: "وشيك علي باقي الاندبوينت")

**Expected**:
- `GET /api/v1/dashboard` returns 200 with full DashboardResponse (greeting + prayers + verse + hadith + journey + khatmah + todayChallenge + quickTools)

## 2. Falsifiable Hypotheses
| ID | Hypothesis | Initial Likelihood | Test Method |
|----|------------|---------------------|-------------|
| H1 | Prisma query error — missing table/column/relation in dashboard.service | 🔴 High | Instrument service functions, check Prisma error stack |
| H2 | Seed data missing in Neon for today's content (dayOfYear ~ 208) | 🟡 Medium | Check content/prayer/challenge queries for empty/null results not handled |
| H3 | Date/time/Timezone crash in prayer-times utility | 🟡 Medium | Wrap date calculations in try/catch with instrumentation |
| H4 | Null property access crash (object is null -> `.foo`) | 🔴 High | Full stack trace of 500 from middleware error handler |
| H5 | Shared code bug affecting multiple modules | 🟠 Medium | Ping all module endpoints locally and collect failure list |

## 3. Instrumentation Points (TODO)
- Global error handler middleware: capture stack trace + report to debug server
- dashboard.service `getDashboard()` + each sub-function
- Each service module entry point (tasbih.service, journey.service, etc.)

## 4. Evidence Log (Runtime)
_(Populated after step 4 — Run & Reproduce)_

## 5. Root Cause (TBD)
**Confirmed hypothesis** (after evidence): —

## 6. Fix Applied (TBD)
Minimal diff with before/after comparison.

## 7. Post-Fix Verification (TBD)
- [ ] dashboard 200 OK with all 7 subsections
- [ ] All remaining endpoints 200 OK
- [ ] `npm run build` passes
- [ ] Vercel redeploy without cache → production 200 OK
