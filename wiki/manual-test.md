# 🧪 Purranormal Activity - Manual Test Cases

> **Document for LLM Tester** | Chrome Mobile | Last Updated: 2025-12-29

---

## 📋 Table of Contents

1. [Test Environment](#test-environment)
2. [Functional Tests](#functional-tests)
   - [Homepage](#homepage)
   - [Explore Page](#explore-page)
   - [New Log Creation](#new-log-creation)
   - [Event Detail Page](#event-detail-page)
3. [UI/UX Tests](#uiux-tests)
4. [Edge Cases](#edge-cases)
5. [Secret & Advanced Features](#secret--advanced-features)

---

## 🌐 Test Environment

| Parameter | Value |
|-----------|--------|
| **Browser** | Chrome Mobile |
| **Viewport** | 375x667 (iPhone SE) or 390x844 (iPhone 14) |
| **Base URL** | `https://purranormal-activity.pages.dev/` |
| **Network** | Also test with "Slow 3G" throttling |

---

## 🔧 Functional Tests

### Homepage

#### TC-HOME-001: Homepage Load
| Field | Value |
|-------|--------|
| **Priority** | Critical |
| **Prerequisites** | None |
| **Steps** | 1. Navigate to `/` |
| **Expected Result** | - Hero section visible with title "Track the Spooky Shenanigans..."<br>- "Recent Supernatural Sightings" section present<br>- Event list loaded (skeleton → content) |

#### TC-HOME-002: Navigation to Event Detail
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Prerequisites** | At least 1 existing event |
| **Steps** | 1. Navigate to `/`<br>2. Tap on an event card |
| **Expected Result** | - Smooth transition to page `/{id}`<br>- Image view transition visible |

#### TC-HOME-003: Infinite Scroll
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Prerequisites** | More than 10 events in database |
| **Steps** | 1. Navigate to `/`<br>2. Scroll down to the end of the list |
| **Expected Result** | - New events loaded automatically<br>- Loading indicator visible during fetch<br>- No duplicates among events |

---

### Explore Page

#### TC-EXPL-001: Explore Load
| Field | Value |
|-------|--------|
| **Priority** | Critical |
| **Prerequisites** | None |
| **Steps** | 1. Navigate to `/explore` |
| **Expected Result** | - Title "Paranormal Archives" visible<br>- Filters loaded (Search, Sort By, Time Range)<br>- Category selector present<br>- Event list visible |

#### TC-EXPL-002: Search by Text
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Prerequisites** | Existing events with different titles |
| **Steps** | 1. Navigate to `/explore`<br>2. Type "magic" in the "Search Mysteries" field |
| **Expected Result** | - List filtered in real-time<br>- Only events containing "magic" visible<br>- URL updated with query param |

#### TC-EXPL-003: Sorting
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Prerequisites** | At least 3 events |
| **Steps** | 1. Navigate to `/explore`<br>2. Select "Oldest First" from "Sort By" dropdown |
| **Expected Result** | - Events reordered from oldest to newest<br>- Order verifiable by dates |

#### TC-EXPL-004: Time Range Filter
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Prerequisites** | Events created in different periods |
| **Steps** | 1. Navigate to `/explore`<br>2. Select "Past Week" from "Time Range" dropdown |
| **Expected Result** | - Only events from the last week visible<br>- If no events, show empty state |

#### TC-EXPL-005: Category Filter
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Prerequisites** | Events with different categories |
| **Steps** | 1. Navigate to `/explore`<br>2. Tap on a category icon in the selector |
| **Expected Result** | - Category highlighted as selected<br>- List filtered to show only events with that category |

#### TC-EXPL-006: Filter Combination
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Prerequisites** | Varied dataset |
| **Steps** | 1. Navigate to `/explore`<br>2. Type search text<br>3. Select "Past Month"<br>4. Select a category |
| **Expected Result** | - All filters applied simultaneously<br>- Results consistent with all criteria |

#### TC-EXPL-007: No Results
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Prerequisites** | None |
| **Steps** | 1. Navigate to `/explore`<br>2. Search "zzzzzzzzz123456789" |
| **Expected Result** | - Message "No logs found" or similar<br>- Graceful UI, not a technical error |

---

### New Log Creation

#### TC-NEW-001: Access New Log Page
| Field | Value |
|-------|--------|
| **Priority** | Critical |
| **Prerequisites** | None |
| **Steps** | 1. Navigate to `/new` |
| **Expected Result** | - Title "Record New Purranormal Activity" visible<br>- Form with description textarea<br>- Button "Record Supernatural Event" |

#### TC-NEW-002: Submit Valid Description (Happy Path)
| Field | Value |
|-------|--------|
| **Priority** | Critical |
| **Prerequisites** | None |
| **Steps** | 1. Navigate to `/new`<br>2. Enter description: "The kitten levitated the food bowl while the chick watched in terror from its bed"<br>3. Tap "Record Supernatural Event" |
| **Expected Result** | - Loading state visible<br>- Transition to "In-depth questions" section<br>- AI-generated questions visible |

#### TC-NEW-003: Answer Questions and Submit
| Field | Value |
|-------|--------|
| **Priority** | Critical |
| **Prerequisites** | TC-NEW-002 completed |
| **Steps** | 1. Answer all questions by selecting options<br>2. Enter the correct secret<br>3. Tap "Save event" |
| **Expected Result** | - Loading during processing<br>- Transition to "Log saved!" screen<br>- Success image visible<br>- Magical sound played<br>- "Home" and "View log" buttons available |

#### TC-NEW-004: Remove Question
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Prerequisites** | Being in "In-depth questions" section |
| **Steps** | 1. Tap the red X on a question |
| **Expected Result** | - Question removed from list<br>- Form still valid with remaining questions |

#### TC-NEW-005: "Other" Option
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Prerequisites** | Being in "In-depth questions" section |
| **Steps** | 1. Select "Other" for a question<br>2. Type custom text in the appearing area |
| **Expected Result** | - Textarea appears under "Other" option<br>- Character counter visible<br>- 150 character limit respected |

#### TC-NEW-006: Go Back
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Prerequisites** | Being in "In-depth questions" section |
| **Steps** | 1. Tap "Back" |
| **Expected Result** | - Return to initial screen<br>- Original description preserved in field |

#### TC-NEW-007: Missing Categories
| Field | Value |
|-------|--------|
| **Priority** | Low |
| **Prerequisites** | AI suggests non-existent categories |
| **Steps** | 1. Complete creation flow<br>2. If "Mystical Categories Discovered" appears, tap "View New Categories" |
| **Expected Result** | - Modal with list of missing categories<br>- Ability to close modal |

---

### Event Detail Page

#### TC-DET-001: View Detail
| Field | Value |
|-------|--------|
| **Priority** | Critical |
| **Prerequisites** | At least 1 existing event |
| **Steps** | 1. Navigate to `/{id}` (e.g., `/1`) |
| **Expected Result** | - Event title visible with glow animation<br>- Generated image loaded<br>- Full description<br>- Categories with icons/badges |

#### TC-DET-002: Non-Existent Event
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Prerequisites** | None |
| **Steps** | 1. Navigate to `/999999` |
| **Expected Result** | - Custom 404 page<br>- Design consistent with theme |

#### TC-DET-003: Notification Button (if visible)
| Field | Value |
|-------|--------|
| **Priority** | Low |
| **Prerequisites** | Existing event |
| **Steps** | 1. Navigate to `/{id}`<br>2. If present, tap "Send Notification" |
| **Expected Result** | - Request sent<br>- Visual feedback (success or error) |

---

## 🎨 UI/UX Tests

### TC-UX-001: Mobile Responsive Layout
| Field | Value |
|-------|--------|
| **Priority** | Critical |
| **Verify** | - No horizontal overflow on 375px viewport<br>- Text readable without zoom<br>- Touch-friendly buttons (min 44x44px)<br>- Adequate padding from edges |

### TC-UX-002: Animations
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Verify** | - Animated sparkles visible<br>- "Magical-glow" effect on titles<br>- Smooth page transitions<br>- Hover/tap states on buttons |

### TC-UX-003: Loading States
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Verify** | - Skeleton loaders during loads<br>- Spinner or indicator during submit<br>- No "flash" of empty content |

### TC-UX-004: Visual Theme
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Verify** | - Consistent colors (deep purple, midnight blue)<br>- "Magical" font loaded correctly<br>- Icons visible and recognizable |

### TC-UX-005: Basic Accessibility
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Verify** | - Sufficient text contrast<br>- Labels associated with form fields<br>- Focus visible on interactive elements |

---

## ⚠️ Edge Cases

### Input Validation

#### TC-EDGE-001: Empty Description
| Field | Value |
|-------|--------|
| **Priority** | Critical |
| **Steps** | 1. Navigate to `/new`<br>2. Leave description empty<br>3. Tap "Record Supernatural Event" |
| **Expected Result** | - Inline error message visible<br>- Form NOT submitted<br>- Message: "Description is required" or similar |

#### TC-EDGE-002: Description Too Short
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Steps** | 1. Navigate to `/new`<br>2. Enter only "hi"<br>3. Tap "Record Supernatural Event" |
| **Expected Result** | - Validation error shown<br>- Minimum characters required indicated |

#### TC-EDGE-003: Description At Max Limit
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Steps** | 1. Navigate to `/new`<br>2. Enter text filling entire character limit<br>3. Verify counter "X characters remaining" |
| **Expected Result** | - Counter shows 0 remaining<br>- Impossible to type beyond limit<br>- Counter color changes (warning) |

#### TC-EDGE-004: Wrong Secret
| Field | Value |
|-------|--------|
| **Priority** | Critical |
| **Steps** | 1. Complete description and questions<br>2. Enter wrong secret: "password123"<br>3. Tap "Save event" |
| **Expected Result** | - Error shown under secret field<br>- Log NOT saved<br>- Ability to retry |

#### TC-EDGE-005: Empty Secret
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Steps** | 1. Complete description and questions<br>2. Leave secret empty<br>3. Tap "Save event" |
| **Expected Result** | - Validation error<br>- Secret entry required |

#### TC-EDGE-006: "Other" Text Too Long
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Steps** | 1. Select "Other" for a question<br>2. Attempt to enter more than 150 characters |
| **Expected Result** | - Counter shows limit reached<br>- Text truncated or input blocked<br>- Message "Text too long" if exceeded |

#### TC-EDGE-007: No Answer Selected
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Steps** | 1. Reach questions section<br>2. DO NOT answer some questions<br>3. Verify "Save event" button state |
| **Expected Result** | - "Save event" button disabled<br>- All questions must be answered |

### Network & Performance

#### TC-EDGE-008: Slow Connection
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Steps** | 1. Enable "Slow 3G" throttling<br>2. Submit new log |
| **Expected Result** | - Loading visible during wait<br>- No premature timeout<br>- Operation completed (even if slow) |

#### TC-EDGE-009: Disconnection During Submit
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Steps** | 1. Start submitting new log<br>2. Disable network during loading |
| **Expected Result** | - User-friendly error shown<br>- Message: "Unable to connect to the server..."<br>- "Try Again" option available |

#### TC-EDGE-010: Double Tap Submit
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Steps** | 1. Tap quickly 2 times on "Save event" |
| **Expected Result** | - Only 1 request sent<br>- Button disabled during loading<br>- No duplicates created |

### Navigation & State

#### TC-EDGE-011: Refresh During Creation
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Steps** | 1. Reach questions section<br>2. Pull-to-refresh or reload page |
| **Expected Result** | - Return to initial screen<br>- No crash<br>- Form reset |

#### TC-EDGE-012: Browser Back During Flow
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Steps** | 1. Be in questions section<br>2. Use browser back (not app Back button) |
| **Expected Result** | - Navigation handled correctly<br>- No inconsistent state |

#### TC-EDGE-013: Direct URL to Non-Existent Page
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Steps** | 1. Navigate to `/page-that-does-not-exist` |
| **Expected Result** | - Custom 404 page<br>- Style consistent with theme |

### Explore Edge Cases

#### TC-EDGE-014: Special Characters in Search
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Steps** | 1. Search `<script>alert('xss')</script>` |
| **Expected Result** | - No script execution<br>- Text treated as normal string<br>- No results or safe results |

#### TC-EDGE-015: Search with Emoji
| Field | Value |
|-------|--------|
| **Priority** | Low |
| **Steps** | 1. Search "🐱 magic" |
| **Expected Result** | - Search executed without errors<br>- Emoji handled correctly |

#### TC-EDGE-016: Filters Preserved in URL
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Steps** | 1. Set filters on `/explore`<br>2. Copy URL<br>3. Open URL in new tab |
| **Expected Result** | - Filters reapplied automatically<br>- State consistent with URL |

---

## 🔥 Secret & Advanced Features

> **⚠️ Important**: These tests were not present in previous versions and cover features discovered through deep code analysis.

#### TC-ADV-001: Secret Edit Mode Access (Easter Egg)
| Field | Value |
|-------|--------|
| **Priority** | Low (Hidden Feature) |
| **Prerequisites** | Detail page open |
| **Steps** | 1. Tap rapidly (5 times) on event image in detail view |
| **Expected Result** | - Redirect to `/edit` page<br>- Access admin/edit area (or login prompt) |
| **Notes**| Found in `EventImage.tsx`: `if (clickCounter.current >= 5) return router.push(...)` |

#### TC-ADV-002: "Magical Loading" Overlay (Generation Pending)
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Prerequisites** | Just created a new log (Status `Created`) |
| **Steps** | 1. Complete log creation<br>2. Be redirected to detail<br>3. Observe image |
| **Expected Result** | - Dark overlay with "magical" progress bar<br>- Witty texts changing every 5s (e.g., "Teaching AI to paint...")<br>- Fallback image visible underneath |
| **Notes** | Covers the period when AI is still generating image on R2 |

#### TC-ADV-003: Mobile Audio Autoplay Handling
| Field | Value |
|-------|--------|
| **Priority** | Medium |
| **Prerequisites** | Real mobile device (iOS/Android) |
| **Steps** | 1. Visit "Completed" page directly or after refresh (no prior interaction)<br>2. Verify audio |
| **Expected Result** | - Must not crash if browser blocks autoplay<br>- No ugly native error popup |

#### TC-ADV-004: Social Preview (Telegram/WhatsApp)
| Field | Value |
|-------|--------|
| **Priority** | High |
| **Prerequisites** | External tool (FB Debugger) or Real App |
| **Steps** | 1. Copy link of event with generated image<br>2. Paste in Telegram chat |
| **Expected Result** | - "Day #X" card generated correctly<br>- Event image visible<br>- Engaging description |
| **Notes** | Verifies OpenGraph meta tags in `page.tsx` work as specified |

---

*Document updated with deep code analysis (Revision 2 - English Version).*
