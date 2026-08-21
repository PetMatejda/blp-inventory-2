---
name: Lumen Industrial Light
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  status-success: '#059669'
  status-warning: '#d97706'
  status-error: '#dc2626'
  surface-border: '#e2e8f0'
  text-muted: '#64748b'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  status-badge:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  touch-target: 56px
  gutter: 16px
  margin-edge: 20px
  stack-gap: 12px
  card-padding: 20px
  base-grid: 4px
---

## Brand & Style

The design system is an evolution of the industrial aesthetic, optimized for high-visibility environments where clarity is paramount. It shifts from a "dark-first" utility to a high-contrast light mode that maintains a **rugged, precise, and authoritative** personality. 

The visual style is **Industrial Modernism**. It draws from professional hardware interfaces, utilizing heavy-duty touch targets and a functional, "tool-like" aesthetic. The light mode variation prioritizes an expansive, clean workspace while retaining the mechanical discipline of the original architecture. It evokes a sense of reliability and laboratory-grade precision, moving away from the "incognito" feel of dark mode into a "command center" clarity.

## Colors

The palette is recalibrated for maximum legibility on a light surface. The background transition to a high-contrast white-slate mix ensures that equipment statuses are immediately identifiable under bright overhead lighting or direct sunlight.

- **Primary:** Dark Slate (#0f172a) is used for high-impact text and primary structural elements to anchor the design.
- **Secondary (Action):** A punchy blue used for interactive states and navigation focal points.
- **Status Colors:** Adjusted to darker, more saturated weights (Green #059669, Amber #d97706, Red #dc2626) to ensure they meet AA/AAA contrast ratios against the light background.
- **Neutral:** A tiered system of cool grays (#f8fafc to #e2e8f0) differentiates the main canvas from structural containers and borders.

## Typography

This design system utilizes **Inter** for its superior legibility in high-density information environments. For technical data and serial numbers, **JetBrains Mono** provides a mechanical distinction that prevents character confusion during rapid scanning.

- **Hierarchy:** Strong contrast between bold headlines and regular body weights ensures information density does not compromise readability.
- **Numerical Precision:** All quantity and serial number fields should leverage the monospaced properties of JetBrains Mono to keep data columns perfectly aligned.
- **Labels:** Use uppercase caps for status indicators to create a "printed label" aesthetic typical of industrial equipment tagging.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for the physical constraints of a technician's workflow. 

- **Ergonomics:** Interactive zones are strictly governed by a 56px minimum touch target, designed for reliable use with gloves or under physical duress.
- **Vertical Rhythm:** A 4px/8px base grid is used for all internal component spacing. List items utilize a "Stack Gap" of 12px to maintain clear separation without wasting vertical space.
- **Responsive Behavior:** The layout is single-column on mobile to facilitate one-handed thumb navigation. On larger screens, content cards should be organized in a multi-column masonry grid to maximize information density.

## Elevation & Depth

Depth in this system is achieved through **Tonal Layering** and **Low-Contrast Outlines** rather than heavy shadows. This maintains the "flat-panel" industrial aesthetic.

- **Level 0 (Canvas):** #F8FAFC - The foundation.
- **Level 1 (Cards/Surface):** #FFFFFF - Primary containers are pure white to "pop" against the off-white canvas.
- **Level 2 (Active/Floating):** Use a 1px border (#E2E8F0) and a very subtle, tight ambient shadow (4px blur, 5% opacity) to indicate temporary elevation like dropdowns or modals.

Borders are the primary indicator of state. Interactive elements use a 1px border by default, increasing to 2px when active or focused.

## Shapes

The design system uses a **Rounded** shape language to mimic the feel of modern industrial hardware—tough but ergonomic.

- **Standard Elements:** 8px (0.5rem) radius for input fields, small buttons, and badges.
- **Main Containers:** 16px (1rem) radius for cards and modal sheets to provide a distinct structural silhouette.
- **Industrial Integrity:** Avoid pill shapes for buttons; a consistent rectangular profile with rounded corners reinforces the professional, non-consumer nature of the tool.

## Components

### Equipment Cards
Cards are the primary data vehicle. They feature a white surface, a 1px #E2E8F0 border, and a 4px vertical status stripe on the far left edge. Swiping gestures provide rapid status changes.

### Giga-Stepper
A specialized industrial control. It consists of two 64x64px square buttons with large icons (+/-) flanking a central numeric display in JetBrains Mono. This component is optimized for speed and high tactile confidence.

### Status Badges
Badges use high-contrast fills for active states (e.g., Red fill with White text). Pending or inactive states should use an outlined version with a 2px border and the status color for the text.

### Input Fields
Inputs use a white background with a 1px #CBD5E1 border. Upon focus, the border thickness increases to 2px in the Primary color (#0F172A).

### Progress Indicators
Truck-loading or kit-completion bars are 12px tall with a light gray track. The fill uses the status color with no gradients, emphasizing a "completed or not" mechanical binary.