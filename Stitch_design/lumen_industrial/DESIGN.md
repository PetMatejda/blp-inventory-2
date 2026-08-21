---
name: Lumen Industrial
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363941'
  surface-container-lowest: '#0b0e15'
  surface-container-low: '#191b23'
  surface-container: '#1d2027'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e1e2ec'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e1e2ec'
  inverse-on-surface: '#2e3038'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#10131a'
  on-background: '#e1e2ec'
  surface-variant: '#32353c'
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
  touch-target-min: 56px
  gutter: 16px
  margin-edge: 20px
  stack-gap: 12px
  card-padding: 20px
---

## Brand & Style

The design system is engineered for the high-pressure environment of film sets. It prioritizes utility, rapid recognition, and physical ease of use under varying lighting conditions. The brand personality is **rugged, precise, and authoritative**.

The visual style is **Industrial Modernism**, characterized by high-contrast interfaces, substantial touch targets, and a functional aesthetic that mimics professional hardware. The system leverages a "dark-first" architecture to minimize screen glare in dark studios while maintaining extreme legibility for outdoor daylight use through high-intensity accent colors.

## Colors

The palette is optimized for professional inventory management. The background utilizes a deep navy-black (#0F172A) to provide maximum contrast for status indicators.

- **Primary (Blue):** Used for primary actions and navigation.
- **Success (Emerald):** Represents "Loaded" or "On Set" status.
- **Warning (Amber):** Denotes "Packed" or "Return" status.
- **Error (Red):** Exclusively for "Damaged" or "Missing" items.
- **Neutral:** Multi-tier grays facilitate a clear hierarchy between inactive states and background surfaces.

## Typography

This design system uses **Inter** for all primary interface elements due to its exceptional legibility and tall x-height. For technical data, serial numbers, and quantities, **JetBrains Mono** is utilized to provide a distinct, "tool-like" feel that prevents character confusion (e.g., '0' vs 'O').

- **Headlines:** Bold and tight-tracking for immediate recognition of gear categories.
- **Status Labels:** Always uppercase with increased letter spacing to ensure readability at a glance.
- **Numerical Data:** Uses monospaced font features to keep columns aligned in equipment lists.

## Layout & Spacing

The layout is a **Single Column Fluid Grid** optimized for one-handed mobile operation. 

- **Ergonomics:** Every interactive element adheres to a **56px minimum height** to accommodate gloved hands or rapid movement.
- **Vertical Rhythm:** A base 4px/8px grid governs all spacing. List items are separated by a 12px "Stack Gap" to create clear visual separation between equipment entries.
- **Safe Zones:** Generous 20px side margins ensure content does not bleed into the bezel area of ruggedized phone cases.

## Elevation & Depth

Depth is conveyed through **Tonal Layering** rather than traditional shadows, ensuring the UI remains crisp in high-brightness environments.

- **Level 0 (Base):** #0F172A - The main background.
- **Level 1 (Cards):** #1E293B - Used for equipment cards and list items.
- **Level 2 (Active/Modals):** #334155 - For elevated interactive states or overlays.

Borders are used as the primary depth indicator. Inactive items use a subtle 1px border (#374151), while active or selected items receive a 2px high-contrast border in the status color.

## Shapes

The design system employs a **Rounded** shape language to provide a "tactile hardware" feel. 

- **Primary Containers:** 16px corner radius for cards and main buttons.
- **Small Elements:** 8px radius for status badges and input fields.
- **Consistency:** Avoid pill-shaped buttons; maintaining a rectangular silhouette with rounded corners reinforces the industrial aesthetic.

## Components

### Equipment Cards
Cards use swipe-actions (Left for "Damaged", Right for "Loaded"). They feature a 4px vertical status bar on the left edge that color-codes the item's current state.

### Giga-Stepper
A specialized component for quantity counting. It features oversized "+" and "-" buttons (64x64px) flanking a central monospaced count display.

### Status Badges
Solid color fills for active states, outlined versions for pending states. Typography within badges must be high-contrast (White on dark colors, Black on bright colors).

### Progress Bars
Used for truck-loading status. These are thick (12px height) with a subtle glow effect on the filled portion matching the status color.

### Input Fields
Fields have a dark fill (#0F172A) with a persistent 2px border. Focus states use the Primary Blue with a subtle outer glow to indicate readiness for data entry.