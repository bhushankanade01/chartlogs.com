---
name: Landing page & theme system
description: How dark/light mode toggle works and how the landing page is structured.
---

## Theme system
- `ThemeContext.tsx` in `artifacts/chartlogs/src/contexts/` — localStorage key `chartlogs_theme`, applies/removes `.dark` on `document.documentElement`.
- `ThemeProvider` wraps the entire App in `App.tsx`.
- `main.tsx` no longer calls `document.documentElement.classList.add("dark")` — ThemeContext owns this.
- Toggle button uses Sun/Moon icon from lucide-react; appears in AppLayout sidebar bottom-left (next to avatar) and mobile header right side.

**Why:** Was originally forced dark-only; needed localStorage-persistent toggle per design brief.

## Landing page structure
- `Landing.tsx` is a full standalone component (not wrapped in AppLayout).
- Uses `useScrollReveal()` hook with `IntersectionObserver` for fade-in-up animations on scroll.
- Sections: Header (sticky, blur-on-scroll) → Hero → Features (6 cards) → Comparison table → Pricing (3 tiers: Free / Pro ₹1,499 / Elite ₹1,999) → Testimonials → CTA → Footer.
- CSS classes: `.hero-gradient`, `.hero-grid`, `.gradient-text`, `.animate-fade-in` — all in `index.css`.

## FAQ page
- Route `/faq` added to `App.tsx`, renders `FAQ.tsx`.
- Accordion pattern: local `open` state per question (not using shadcn accordion).

## SEO
- `index.html` updated with real title, description, OG/Twitter tags, JSON-LD schema.
- `public/sitemap.xml` and `public/robots.txt` added (disallow /dashboard etc.).
