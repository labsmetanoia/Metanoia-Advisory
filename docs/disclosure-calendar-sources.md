# Disclosure calendar: what to check before it goes live

The calendar at `/en/strategic-storytelling/disclosure-calendar/` (Indonesian: `/id/storytelling-strategis/kalender-keterbukaan/`) is a **preview**: not linked, not indexed, and every rule is marked "to be checked". The rules were written from search summaries of the regulations, because the regulators' sites (OJK, peraturan.go.id, the BPK database) refuse automated downloads. Before it goes live, each rule must be read in the regulation itself.

How to check: open each regulation (they open normally in a browser), find the article, and compare its wording and day count with the rule below. Then either send the PDFs to Claude, or edit `src/assets/disclosure-calendar/calendar.js`: correct the rule if it differs and set its `status` to `"checked"`. When all are checked, set `tools.disclosureCalendar` to `"live"` in `site.config.json`.

| Rule in the calendar | What it says now | Where to check |
| --- | --- | --- |
| `annual-fs` | Audited annual financial statements: by the end of the third month after the year-end | POJK 14/POJK.04/2022, Article 4 (ojk.go.id → Regulasi → "Penyampaian Laporan Keuangan Berkala Emiten atau Perusahaan Publik") |
| `half-year-fs` | Mid-year statements: end of the 1st / 2nd / 3rd month after 30 June, if not reviewed / limited review / audited | POJK 14/POJK.04/2022, Article 6 |
| `annual-report` | Annual report: by the end of the fourth month after the year-end | POJK 29/POJK.04/2016, Article 7 (and its elucidation on deadlines that fall on non-working days) |
| `sustainability` | Sustainability report: with the annual report | POJK 51/POJK.03/2017, the article on submitting the sustainability report |
| `q1-fs`, `q3-fs` | Quarterly interim statements: end of the 1st / 2nd / 3rd month after the quarter, by review level | IDX Rule I-E (current version, Kep-00066/BEI/09-2022 or later), section on interim financial statements; also check whether POJK 14/2022 covers them |
| `agm-latest` | Annual GMS within six months after the year-end | Law 40/2007, Article 78(2); POJK 15/POJK.04/2020 |
| `agm-summons` | Summons at least 21 days before the meeting, both dates excluded | POJK 15/POJK.04/2020, the article on the summons (pemanggilan) and its day-counting rule |
| `agm-announcement` | Announcement at least 14 days before the summons, both dates excluded | POJK 15/POJK.04/2020, Article 14(1) |
| `agm-agenda` | Agenda to OJK at least 5 working days before the announcement | POJK 15/POJK.04/2020, the article on notifying OJK of the agenda (mata acara) |
| `agm-minutes` | Summary of minutes within 2 working days after the meeting | POJK 15/POJK.04/2020, the article on the summary of minutes (ringkasan risalah) |
| `public-expose` | At least once a year; may be on the AGM day; no date given | IDX Rule I-E, section on the public expose (paparan publik): also note the deadline for the plan and the materials, which the calendar should then show |

Also decide with counsel whether the calendar should move a deadline that falls on a weekend or public holiday (today it only flags weekends).
