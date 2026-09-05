# Research policy / 調査とモデル採用の方針

**Status: proposal, no country defaults implemented. / 提案段階・国別の既定値は未実装。**

A roll marks an interval in everyday life. A shared household interval is not a measurement of one person's paper use. Our current calculations use recorded intervals without national multipliers. Research must keep that distinction visible.

## Profile layers

```text
Global baseline → Country profile → Household profile → Personal observation
```

For the **same measured quantity and observation context**, prefer personal observations over household observations, country estimates, and global estimates. These are not interchangeable units: a shared roll cannot become a personal observation merely because one person records it. Unknown baseline values stay unknown. UI language must not silently choose a country profile.

実測を優先する場合も、個人専用ロールと家庭共有ロールは観測対象が異なります。人数で機械的に割った値を「個人の実測」と呼びません。国別・世界平均が未調査なら未調査と表示します。

## Proposed versioned record

This is a discussion schema, not a shipped runtime format or a dataset of established defaults.

```yaml
profile_id: JP
version: draft-0
status: proposed
country: JP
locales: [ja-JP]
observation_scope: unknown # personal / household / unknown
values:
  roll_length_m: null
  roll_width_mm: null
  sheet_count: null
  ply: null
  household_size: null
  personal_share: null
sources: [] # URL, publisher, date, population/sample, product, unit, reuse terms
assumptions: []
ranges: {} # bounds, unit, coverage; never unexplained single values
confidence: unknown
unknowns: []
reviewed_at: null
supersedes: null
```

Track measurement, estimate, assumption, and unknown separately for **each** value. Keep version history and cite changes. Manufacturer specifications describe particular products; they do not automatically establish what an entire country buys. Material area, length, sheets, mass, and number of rolls answer different questions. Ply is not an evidence-based proportional usage multiplier.

## Adoption checklist

- [ ] Record scope, units, product definitions, source dates, sample coverage, and uncertainty.
- [ ] Consider single/double/triple ply, larger rolls, sharing, bidets, guests, travel, and multiple bathrooms; do not collect invasive individual bathroom logs.
- [ ] Show ranges and unknowns, including unsupported assumptions about out-of-home usage.
- [ ] Decide whether a value improves the time-reflection experience before adding controls.
- [ ] Compare profile proposals against actual observations in the same context, with tests for missing data and context changes.
- [ ] Review copy with people familiar with the relevant locale; avoid guilt, lifespan predictions, and cultural stereotypes.
- [ ] Agree on versioning, user visibility/choice, rollback, and attribution before enabling a default.

A “five completed rolls” threshold is a hypothesis to evaluate, not proof of statistical adequacy. Do not silently replace a household interval with a personal consumption estimate. Preserve the original observations even when a model version changes.

## Contributing

Use the country, localization, household, or methodology Issue template. Share aggregate/public sources and redact personal details. English and Japanese discussion are welcome; other supported languages are welcome too, with the country/locale named. A future public dataset requires a separately agreed schema, validation process, and source-compatible data license; posting an Issue does not settle those decisions.
