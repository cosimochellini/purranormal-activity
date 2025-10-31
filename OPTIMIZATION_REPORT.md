# Bundle Size Optimization Report

## Current Status
- **Total Worker Size**: ~14-20 MB (depending on count method)
- **Individual Functions**: 1.4 MB each (down from 1.9 MB - 28% improvement!)
- **Cloudflare Free Tier Limit**: 3 MB
- **Status**: ❌ Still exceeds limit

## What We've Done ✅

### 1. Split AWS SDK to Server-Only File
- Created `utils/cloudflare.server.ts` - only imported in API routes
- Made `utils/cloudflare.ts` lightweight (client-safe)
- **Impact**: Prevented AWS SDK from being bundled in pages

### 2. Optimized Next.js Config
- Added `optimizePackageImports` for heavy libraries
- Enabled proper tree-shaking
- **Impact**: ~28% reduction per function

### 3. Updated Imports
- API routes now use `.server.ts` files
- Prevents heavy libs from leaking to client bundles

## Why Bundle Is Still Large

### Major Contributors:
1. **AI SDK + OpenAI** (~800KB-1MB)
   - Used in: `services/ai.ts`
   - Imported by: pages, API routes

2. **Drizzle ORM + libsql** (~600-800KB)
   - Used in: `services/log.ts`, DB operations
   - Imported by: ALL pages (via `EventsSection`)

3. **React 19 + Next.js 16** (~400-600KB)
   - Base framework overhead
   - Cannot be reduced

4. **@tabler/icons-react** (~200-300KB)
   - Icon library
   - Used throughout UI

## Recommended Solutions (In Priority Order)

### 🎯 SOLUTION 1: API Route Refactoring (HIGHEST IMPACT)
**Problem**: Pages import `services/log.ts` which includes DB logic
**Solution**: Fetch data via API routes instead

#### Implementation:
1. Create `/api/logs/recent` endpoint
2. Update `EventsSection` to fetch from API
3. Remove direct DB imports from pages

**Expected Savings**: ~1-1.5 MB per page function
**Effort**: Medium (2-3 hours)

### 🎯 SOLUTION 2: Dynamic Imports for Heavy Components
**Problem**: AI services loaded upfront
**Solution**: Load on-demand using `next/dynamic`

```typescript
// Instead of:
import { getLogs } from '@/services/log'

// Use:
const { getLogs } = await import('@/services/log')
```

**Expected Savings**: ~500KB-800KB
**Effort**: Low (1 hour)

### 🎯 SOLUTION 3: Icon Tree-Shaking
**Problem**: Entire icon library might be bundled
**Solution**: Import icons individually

```typescript
// Instead of:
import { IconWand, IconSparkles } from '@tabler/icons-react'

// Use direct imports (if available):
import IconWand from '@tabler/icons-react/dist/esm/icons/IconWand'
```

**Expected Savings**: ~100-200KB
**Effort**: Low (30 min)

### 🎯 SOLUTION 4: Remove Unused Dependencies
Check if these are actually used:
- `next-view-transitions` (peer dependency issues)
- `sort-es`
- `dotenv` (not needed in prod)

**Expected Savings**: ~50-100KB
**Effort**: Very Low (15 min)

### 🎯 SOLUTION 5: Switch to Lighter Alternatives

#### Option A: Replace `drizzle-orm` with direct libsql
- Drizzle adds ORM layer overhead
- Direct libsql client is lighter
- **Savings**: ~300-500KB
- **Effort**: High (8+ hours refactoring)

#### Option B: Replace `@ai-sdk` with direct OpenAI
- AI SDK adds abstraction layer
- Direct OpenAI SDK might be lighter
- **Savings**: ~200-400KB
- **Effort**: Medium (3-4 hours)

### 🎯 SOLUTION 6: Code Splitting Strategy
Split the app into separate deployments:
1. **Main App** (read-only): Home, Explore, View
2. **Admin App** (write operations): New, Edit, Delete

**Expected Savings**: Each deployment ~40-50% smaller
**Effort**: High (full restructure)

## Quick Wins (Do These First)

### Immediate Actions (< 1 hour):
1. ✅ Remove unused icon imports
2. ✅ Add dynamic imports for AI services
3. ✅ Remove `dotenv` and other unused deps
4. ✅ Optimize Next.js config further

### Short Term (1-3 hours):
5. ✅ Refactor EventsSection to use API
6. ✅ Move all DB operations to API routes
7. ✅ Implement proper code splitting

**Expected Total Reduction**: 2-3 MB
**Estimated Timeline**: 3-5 hours

## Alternative: Upgrade to Paid Plan

**Cloudflare Workers Paid**: $5/month
- Limit increases to 10 MB
- Still might not be enough (we're at 14-20 MB)
- **Recommendation**: Fix architecture first, then decide

## Next Steps

1. **Immediate**: Implement Quick Wins (Solutions 1-4)
2. **If still over**: Implement Solution 5 (API refactoring)
3. **If still over**: Consider Solution 6 (code splitting)
4. **Last resort**: Paid plan + further optimization

## Monitoring

After each change, run:
```bash
pnpm run pages:build
find .vercel/output/static/_worker.js -name "*.func.js" -exec du -sh {} \;
```

Target: Get each function under 600KB, total under 8-10 MB
