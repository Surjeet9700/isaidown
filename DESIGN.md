---
name: IsAIDown.live
description: Real-time AI service status monitoring dashboard
colors:
  background: "#09090B"
  surface: "#18181B"
  surface-hover: "#1E1E22"
  border: "#27272A"
  text-primary: "#FAFAFA"
  text-secondary: "#A1A1AA"
  text-muted: "#71717A"
  text-tertiary: "#52525B"
  success: "#22C55E"
  success-bg: "#22C55E20"
  error: "#EF4444"
  error-bg: "#DC262610"
  error-border: "#DC262640"
  info: "#3B82F6"
  live-dot: "#22C55E"
  down-dot: "#EF4444"
  up-dot: "#22C55E"
typography:
  h1:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: "700"
    lineHeight: 1.1
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: "700"
    lineHeight: 1.2
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: "700"
    lineHeight: 1.3
    letterSpacing: -0.01em
  h4:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "600"
    lineHeight: 1.4
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.5
  body-small:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: "600"
    lineHeight: 1.4
  label-small:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 1.4
  data:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 1.5
  data-bold:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 1.5
  badge:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "600"
    lineHeight: 1.4
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
components:
  status-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: 24px
    borderColor: "{colors.border}"
    borderWidth: 1px
  status-card-down:
    backgroundColor: "{colors.error-bg}"
    borderColor: "{colors.error-border}"
    textColor: "{colors.error}"
  status-dot:
    width: 10px
    height: 10px
  status-dot-up:
    backgroundColor: "{colors.up-dot}"
  status-dot-down:
    backgroundColor: "{colors.down-dot}"
    animation: pulse
  down-banner:
    backgroundColor: "{colors.error-bg}"
    textColor: "{colors.error}"
    borderColor: "{colors.error-border}"
    padding: 32px
    rounded: "{rounded.none}"
  alternative-card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    padding: 20px
    rounded: "{rounded.none}"
  cta-button:
    backgroundColor: "{colors.success}"
    textColor: "#000000"
    padding: 10px 20px
    rounded: "{rounded.none}"
    fontWeight: "600"
  hero-badge:
    backgroundColor: "{colors.success-bg}"
    borderColor: "{colors.success}"
    padding: 8px 20px
    rounded: "{rounded.none}"
  faq-item:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    padding: 24px
    rounded: "{rounded.none}"
  footer:
    backgroundColor: transparent
    textColor: "{colors.text-tertiary}"
    borderColor: "{colors.border}"
    padding: 48px 64px

---

## Overview

IsAIDown.live is a real-time AI service status monitoring dashboard. The UI design prioritizes **clarity, trust, and immediacy**. Dark theme reduces eye strain for users checking outage status. Green/red status dots provide instant visual recognition. Monospace typography for data metrics reinforces technical credibility.

## Colors

The palette is a **dark, high-contrast theme** optimized for readability and status communication.

- **Background (#09090B):** Near-black foundation — reduces glare, makes status colors pop.
- **Surface (#18181B):** Card and container backgrounds — subtle lift from background.
- **Border (#27272A):** Subtle separators that define edges without competing with content.
- **Success (#22C55E):** Green for "up" status — instantly recognizable as "all good."
- **Error (#EF4444):** Red for "down" status — urgent, attention-grabbing.
- **Semantic backgrounds:** Used at low opacity (12-15%) so text remains readable.

## Typography

Dual-font system creates cognitive separation between emotional and rational layers:

- **Inter** — UI text, headings, labels, buttons. Clean and modern. Tight letter-spacing on large headings (-0.02em) creates visual density.
- **IBM Plex Mono** — Data/metrics (latency values, timestamps, status codes). Monospace reinforces technical precision.

### Scale
- **56px h1** — Page title "Is AI Down?". Bold, tight tracking. Only appears once.
- **28px h2** — Section headers (Live Status, FAQ). Clear hierarchy.
- **24px h3** — Sub-section headers
- **15-16px labels** — Card titles, FAQ questions. Semibold for emphasis.
- **13-14px body** — Descriptions, explanations. Normal weight.
- **12px data** — Latency values, timestamps. IBM Plex Mono.

## Layout

- **Max content width:** 1440px (centered)
- **Content padding:** 64px horizontal, 48-80px vertical sections
- **Card grid:** 4 columns (318px each) with 16px gaps
- **Section spacing:** 32px vertical between major sections
- **Hero minimum height:** ~300px (before the fold)

## Elevation & Depth

Flat design with subtle surface contrast instead of box shadows:
- **Background layer:** #09090B
- **Surface layer:** #18181B (cards, banners, FAQ items)
- **Border definition:** 1px #27272A strokes

## Shapes

- **0px (none):** All cards, buttons, banners — sharp corners reinforce the technical, no-nonsense aesthetic
- **8px (sm):** Status badge pill, small decorative elements

## Components

- **Status Card:** Horizontal layout, service name + latency on left, status dot on right. Down variant uses red-tinted background + pulsing dot.
- **Down Banner:** Shows when a service is confirmed down. Lists alternative services with CTA buttons. Full-width alert style.
- **Status Dot:** 10px circle. Green = up, Red = down + pulse animation.
- **Hero Badge:** Small badge showing overall system status ("All Systems Operational" or "X Services Down").
- **FAQ Item:** Expandable/static Q&A blocks. Dark surface with border definition.
- **Footer:** Simple two-line layout. Monospace for technical transparency about monitoring methodology.
