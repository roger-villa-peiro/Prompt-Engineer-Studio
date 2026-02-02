# Prompt Engineer Studio - Design System

> Generated with `ui-ux-pro-max` skill on 2026-01-27

## Style: Dark Mode (OLED) + Swiss Modernism

**Keywords:** Dark theme, high contrast, deep black, professional, clean, minimal

**Best For:** Coding platforms, developer tools, SaaS, professional services

**Effects & Animation:** Minimal glow (text-shadow), dark-to-light transitions, visible focus states

---

## Color Palette (Developer Tool Theme)

| Role | Hex | Tailwind |
|------|-----|----------|
| **Primary** | `#3B82F6` | `blue-500` |
| **Secondary** | `#1E293B` | `slate-800` |
| **CTA** | `#2563EB` | `blue-600` |
| **Background** | `#0F172A` | `slate-900` |
| **Surface** | `#1E293B` | `slate-800` |
| **Text Primary** | `#F1F5F9` | `slate-100` |
| **Text Secondary** | `#94A3B8` | `slate-400` |
| **Border** | `#334155` | `slate-700` |
| **Accent/Success** | `#22C55E` | `green-500` |
| **Warning** | `#F97316` | `orange-500` |

---

## Typography: Tech Startup

| Role | Font | Weight |
|------|------|--------|
| **Heading** | Space Grotesk | 500-700 |
| **Body** | DM Sans | 400-500 |

**Google Fonts Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
```

**Tailwind Config:**
```js
fontFamily: {
  heading: ['Space Grotesk', 'sans-serif'],
  body: ['DM Sans', 'sans-serif']
}
```

---

## Anti-Patterns to Avoid

- ❌ Using emojis as icons
- ❌ Light gray text on dark backgrounds (low contrast)
- ❌ Scale transforms on hover that shift layout
- ❌ Missing `cursor-pointer` on clickable elements
