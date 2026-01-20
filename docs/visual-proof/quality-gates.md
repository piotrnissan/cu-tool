# Quality Gates Documentation

Quality gates are precision thresholds that must be met before running full UK analysis with hardened detectors. If any gate fails, detector fixes are required (return to Phase 4).

**Threshold Philosophy**: These measure **detector precision**, not business importance. A component can be business-critical but tolerate 80% precision if false positives are easily identifiable. Gates are designed to block clearly broken detectors, not to over-optimize early.

**Minimum Sample Size**: Require ≥10 labeled detections per component to enforce gate. If sample size < 10, report "insufficient sample" (not pass/fail). Low-volume components may not have enough labels from 5 proof pages.

---

## Threshold Rationale (Impact Classes)

**Why impact-class based thresholds?**

- **Class A (highest corruption risk)**: accordion ≥ 90%, cards_section ≥ 90%
  - Accordion footer inflation (1,838 pages) and cards_section AEM grid confusion are highest-volume error sources
  - These components have highest false-positive rates and distort analysis results most
- **Class B (high visibility, subjective)**: image_carousel ≥ 85%, card_carousel ≥ 85%
  - High visibility (hero sections, galleries) but slightly subjective classification
  - Carousel split logic (image vs card) introduces misclassification risk
- **Class C (lower volume or robust)**: hero ≥ 80%, media_text_split ≥ 80%, promo_section ≥ 80%, info_specs ≥ 80%, next_action_panel ≥ 80%, tabs ≥ 80%, anchor_nav ≥ 80%
  - Lower volume components or more robust detection rules
  - 80% threshold sufficient to block clearly broken detectors

**Adjustability**: After first QA run, if a component fails gate by <5% (e.g., 83% vs 85% threshold), team may:

1. **Accept threshold miss** if false positives are low-impact (document decision in response.md)
2. **Lower threshold by 5%** (e.g., 85% → 80%) and re-run QA on that component only
3. **Fix detector and re-run full QA** (preferred)

---

## Gate Definitions

### Class A: Accordion & Cards Section (HIGHEST Priority)

**Threshold**: Precision ≥ 90%

**Rationale**: Accordion and cards_section have highest corruption risk. Accordion footer inflation affects 1,838 pages. Cards_section AEM grid confusion counts layout scaffolding as content components.

**Components**: `accordion`, `cards_section`

**Minimum Sample**: ≥10 labels per component (if < 10, report "insufficient sample")

**Formula**:

```text
Precision = confirm_count / (confirm_count + wrong_count)
```

**Pass Example** (accordion):

- Confirmed: 27
- Wrong: 2
- Skipped: 1
- Precision: 27 / (27 + 2) = 93.10% ✅ PASS

**Fail Example** (cards_section):

- Confirmed: 18
- Wrong: 5
- Skipped: 2
- Precision: 18 / (18 + 5) = 78.26% ❌ FAIL (below 90% threshold)

**Action if Failed**:

1. Review all `wrong` labels in labels.jsonl (filter by `component_key:"accordion"` or `component_key:"cards_section"` AND `label:"wrong"`)
2. Identify common patterns:
   - Accordion: Footer accordions, mobile footer chrome
   - Cards_section: AEM grid wrappers, footer link sections, < 3 cards
3. Update detector in `api/src/david-components.ts` (add exclusions, refine ≥3 cards logic)
4. Re-run detector on 5 proof pages, re-export detections.json, re-run QA
5. Repeat until precision ≥ 90%

---

### Class B: Image Carousel & Card Carousel (HIGH Priority)

**Threshold**: Precision ≥ 85%

**Rationale**: Carousels are high-visibility components (hero sections, editorial content). Carousel split logic (image vs card) introduces misclassification risk. Slightly lower threshold than Class A due to subjectivity.

**Components**: `image_carousel`, `card_carousel`

**Minimum Sample**: ≥10 labels per component

**Formula**: Same as Class A

**Common Failure Modes**:

- Misclassified as opposite type (split logic bug: ≥1 heading → card, ≥1 image → image)
- Footer link sections with prev/next buttons detected as carousels
- Non-carousel grid layouts with swiper classes (static, no scrolling)
- Mega-nav dropdowns with carousel-like structure
- Nested carousel inside media_text_split counted twice (should be media_text_split with media_type=carousel)

**Action if Failed**:

1. Review `wrong` labels for image_carousel and card_carousel
2. Check carousel split logic (≥1 heading → card, ≥1 image → image)
3. Verify controls detection (prev/next buttons should NOT auto-trigger carousel classification)
4. Check nested carousel no-double-count rule (carousel inside media_text_split)
5. Update detector, re-run QA

---

### Class C: Remaining Components (MEDIUM Priority)

**Threshold**: Precision ≥ 80%

**Combined Gate**: hero, media_text_split, promo_section, info_specs, next_action_panel, tabs, anchor_nav must ALL meet threshold.

**Rationale**: Lower volume components or more robust detection. 80% threshold sufficient to block clearly broken detectors. Combined gate reduces QA burden.

**Components**: `hero`, `media_text_split`, `promo_section`, `info_specs`, `next_action_panel`, `tabs`, `anchor_nav`

**Minimum Sample**: ≥10 labels per component (some components may have insufficient sample from 5 proof pages)

**Critical Rules**:

- **Hero vs promo**: Only top-of-page hero is `hero`. Hero-like blocks lower in page are `promo_section` or `media_text_split`.
- **Media_text_split nested carousel**: If carousel exists within media_text_split, classify as media_text_split with media_type=carousel (NOT standalone carousel).
- **Tabs mega-nav exclusion**: Global mega-nav tabs are NOT content tabs.
- **Anchor_nav content flow**: In-page navigation must be in content flow (exclude header/footer nav).

**Common Failure Modes**:

- Hero misclassified as promo_section (or vice versa)
- Media_text_split with nested carousel counted twice
- Tabs in mega-nav counted as content tabs
- Info_specs confused with next_action_panel
- Anchor_nav in header/footer counted as content nav

**Action if Failed**:

1. Review `wrong` labels for failed component(s)
2. Check critical rules (hero vs promo, nested carousel, mega-nav exclusion)
3. Update detector, re-run QA

---

## Precision Formula Details

### Included in Denominator

- **Confirm**: Detection is correct (true positive)
- **Wrong**: Detection is incorrect (false positive)

### Excluded from Denominator

- **Skip**: Operator uncertain, not counted as confirm or wrong

**Rationale**: Skips indicate edge cases or ambiguous classifications. Excluding them from precision avoids penalizing detectors for subjective cases.

### Example Calculation

labels.jsonl (filtered to `component_key:"image_carousel"`):

```jsonl
{"label":"confirm"}  // 1
{"label":"confirm"}  // 2
{"label":"wrong"}    // 3
{"label":"skip"}     // (not counted)
{"label":"confirm"}  // 4
{"label":"wrong"}    // 5
{"label":"confirm"}  // 6
```

Counts:

- Confirm: 4
- Wrong: 2
- Skip: 1 (ignored)

Precision: 4 / (4 + 2) = 66.67%

---

## Gate Validation Script

**File**: `analysis/scripts/regression-check.ts`

**Input**: `analysis/artifacts/visual-proof/labels.jsonl`

**Output**:

- Console: Pass/fail per gate with actual vs threshold
- File: `analysis/artifacts/visual-proof/regression-report.md`
- Exit code: 0 (all pass) or 1 (any fail)

### Example Console Output

```text
========================================
Quality Gate Validation
========================================

Class A: Accordion & Cards Section (threshold: 90%)
  accordion:
    Confirm: 27
    Wrong:   2
    Skip:    1
    Precision: 93.10%
    ✅ PASS
  cards_section:
    Confirm: 18
    Wrong:   5
    Skip:    2
    Precision: 78.26%
    ❌ FAIL (below 90% threshold)
  Class A Result: ❌ FAIL

Class B: Image Carousel & Card Carousel (threshold: 85%)
  image_carousel:
    Confirm: 45
    Wrong:   3
    Skip:    2
    Precision: 93.75%
    ✅ PASS
  card_carousel:
    Confirm: 38
    Wrong:   4
    Skip:    3
    Precision: 90.48%
    ✅ PASS
  Class B Result: ✅ PASS

Class C: Remaining Components (threshold: 80%)
  hero:
    Confirm: 4
    Wrong:   1
    Precision: 80.00%
    ✅ PASS
  media_text_split:
    Sample size: 8 labels
    ⚠️ INSUFFICIENT SAMPLE (need ≥10)
  promo_section:
    Sample size: 5 labels
    ⚠️ INSUFFICIENT SAMPLE (need ≥10)
  tabs:
    Confirm: 12
    Wrong:   2
    Precision: 85.71%
    ✅ PASS
  anchor_nav:
    Sample size: 3 labels
    ⚠️ INSUFFICIENT SAMPLE (need ≥10)
  Class C Result: ✅ PASS (evaluated components meet threshold)

========================================
Result: 2 of 3 impact classes passed
❌ ANALYSIS BLOCKED (Class A failed: cards_section precision 78.26% < 90%)
========================================
```

### Example Regression Report (regression-report.md)

```markdown
# Regression Report

**Generated**: 2026-01-20 15:45:10  
**Labels Source**: analysis/artifacts/visual-proof/labels.jsonl

---

## Summary

| Gate | Component(s)                                      | Threshold | Actual              | Status  |
| ---- | ------------------------------------------------- | --------- | ------------------- | ------- |
| A    | accordion, cards_section                          | 90%       | 93.10%, 91.30%      | ✅ PASS |
| B    | image_carousel, card_carousel                     | 85%       | 93.75%, 87.50%      | ✅ PASS |
| C    | hero, media_text_split, promo_section, tabs, etc. | 80%       | 85.71%, 88.89%, ... | ✅ PASS |

**Result**: 3 of 3 gates passed  
**Analysis Status**: ✅ APPROVED

---

## Class B Failure Analysis

**Component**: card_carousel  
**Precision**: 82.61% (below Class B threshold of 85%)

**Label Breakdown**:

- Confirm: 38
- Wrong: 8
- Skip: 4

**Common Wrong Patterns** (from labels.jsonl):

1. Footer link sections with prev/next buttons (4 instances)
2. Static grid layouts with swiper classes but no scrolling (2 instances)
3. Misclassified image carousels (heading detected but primarily images) (2 instances)

**Recommended Fixes**:

1. Exclude `[role="contentinfo"]` from card carousel detection
2. Verify controls are functional (not just decorative buttons)
3. Adjust carousel split logic: Require ≥2 headings (not just ≥1) for card classification

---

## Next Steps

1. Review detector code in `api/src/david-components.ts`
2. Apply recommended fixes
3. Re-run detector on 5 proof pages
4. Re-export detections.json
5. Re-run QA (only on card_carousel detections to save time)
6. Re-run regression-check.ts
7. Repeat until all gates pass
```

---

## Blockers & Overrides

### Critical Blocker

If **any gate fails**, full UK analysis is blocked. Exit script with code 1, show error message.

**Rationale**: Running full analysis with low-precision detectors wastes compute time and produces unreliable data.

### Override (Manual)

If operator decides to proceed despite gate failure (e.g., known issue, low business impact):

1. Document decision in `.github/response.md` (rationale + risks)
2. Add `--force` flag to analysis command
3. Run analysis with warning banner

**NOT RECOMMENDED** for POC. Gates exist to maintain data quality.

---

## Related Documentation

- [Data Contracts](data-contracts.md) — Labels JSONL schema
- [QA UI Documentation](qa-ui.md) — How labels are created
- [Overview](overview.md) — Full workflow
