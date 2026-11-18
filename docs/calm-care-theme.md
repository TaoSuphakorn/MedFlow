# Clean Clinical Blue theme

The visual layer was changed from the earlier green "Calm Care" theme to Clean Clinical Blue. The theme uses white cards on a cool gray canvas (`#f5f7fa`), a light navigation rail with a blue active indicator, and a medical-blue primary (`#1d5fd1`, 5.9:1 on white). Confirmed and positive states use a separate success green (`#1f7a4d`), so "confirmed" is never confused with "primary action". Allergy alerts stay red and AI suggestions stay purple, and both use text and icons as well as color. The sign-in story panel uses deep navy (`#0f2747`).

The theme lives in `frontend/src/care-theme.css`. The file name and token names (`--teal`, `--teal-dark`) are unchanged so earlier layers keep working; `--teal` now holds the primary blue. Dropdowns (`controls.css`), the onboarding spotlight (`onboarding.css`) and review states (`review.css`) were retinted to the same palette. Layout, responsive rules, fonts (Inter and Noto Sans Thai, bundled locally) and Thai/English behavior are unchanged.

Validation: Docker frontend build passed, and the full Playwright suite (46 tests) passed, including the 375px and enlarged-text layout checks. Desktop login, overview and the 768px worklist were inspected visually. This is not a full screen-reader or WCAG audit.
