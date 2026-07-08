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

## Black theme + button color split (TradeFXBook-style redesign)
- `.dark` palette in `index.css` uses neutral blacks (no blue-tinted hue) for background/card/sidebar/border/muted/accent. `--primary` stays blue (217 91% 60%) — it is intentionally kept ONLY as an accent color (active nav left border, "Most Popular" pricing highlight, links), not for button backgrounds.
- `Button` component's `default` variant is hardcoded to `bg-white text-black` (not `bg-primary`), decoupling "primary action" styling from the "accent" color. `outline`/`secondary` variants also hardcoded rather than derived from `--primary`.

**Why:** The reference design (TradeFXBook) uses solid white/black CTA buttons but blue only for highlights/active-states. The app's `--primary` var was previously overloaded for both roles; keep this split in mind before reintroducing `bg-primary` on buttons — it would put blue back on all buttons app-wide.

## SEO
- `index.html` updated with real title, description, OG/Twitter tags, JSON-LD schema.
- `public/sitemap.xml` and `public/robots.txt` added (disallow /dashboard etc.).
