# Demo slides (S2)

- `slides.html` is the source of the 7-slide deck; `docs/demo/LUNAX_Fire_Calendar_slides.pdf` is the published PDF (public link: https://jacquesbelmont.github.io/lunax-fire-calendar/demo/LUNAX_Fire_Calendar_slides.pdf).
- Images: real screenshots of the published app (`submission/screenshots/`, taken with headless Chrome on 2026-11-15) and the pipeline figures (`method/figures/`). No AI-generated images, no NASA logos, no people.
- Every number is in `submission/FACT_CHECK.md`. Owner of the deck: Tiara (TI-7). Draft prepared with Claude Code (AI_USE.md).
- Rebuild the PDF after editing `slides.html` (`CHROME` is the Chrome binary: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` on macOS, `google-chrome` or `chromium` on Linux):
  ```
  "$CHROME" --headless=new --no-pdf-header-footer \
    --print-to-pdf=docs/demo/LUNAX_Fire_Calendar_slides.pdf "file://$PWD/submission/slides/slides.html"
  ```
