---
name: StockBase Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006c4a'
  on-secondary: '#ffffff'
  secondary-container: '#82f5c1'
  on-secondary-container: '#00714e'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#141c29'
  on-tertiary-container: '#7c8495'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#85f8c4'
  secondary-fixed-dim: '#68dba9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#dbe2f5'
  tertiary-fixed-dim: '#bfc6d9'
  on-tertiary-fixed: '#141c29'
  on-tertiary-fixed-variant: '#3f4756'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system targets enterprise operators, warehouse managers, procurement directors, and retail associates who require rapid, high-accuracy decision making across dense operational workflows. It communicates architectural stability, operational speed, and uncompromised precision.

The aesthetic fuses **Corporate / Modern** B2B European SaaS with high-density architectural functionalism:
- **Surface Discipline:** High-contrast structure between structural navy foundations and pristine operational canvases.
- **Utilitarian Elegance:** Information hierarchy relies on micro-typography, precise tabular data structures, and subtle borders rather than heavy decoration.
- **Physicality & Tactility:** Elevated panels evoke physical hardware scanners and modular European industrial dashboards, retaining instant clarity under diverse warehouse and retail lighting.

## Colors
The palette leverages deep structural charcoals with high-efficiency emerald accents and clinical slate backdrops:

- **Primary (`#0F172A`) & Tertiary (`#0B1320`):** Anchors navigation systems, top application chrome, primary interactive callouts, and dense modal viewports.
- **Secondary (`#059669`) with Emerald Tokens (`#10B981`, `#047857`):** Represents verified inventory status, successful stock replenishment, POS transaction completions, and targeted primary triggers.
- **Canvas & Structure (`#F8FAFC`, `#F1F5F9`):** Neutral alternating layers designed to mitigate eye strain across long data-entry shifts.
- **Surface Highlighting (`#FFFFFF`):** High-priority cards, modal interiors, and active table rows maintain total optical separation from structural backgrounds.
- **Borders & Dividers:** Built strictly with `#E2E8F0` (light context) and `#1E293B` (dark/chrome context) for 1px structural framing.

## Typography
Plus Jakarta Sans delivers structural confidence and modern geometric weight for overview metrics, system titles, and modal headers. Inter governs tabular layouts, numeric inventory values, barcode scan confirmations, and field inputs, guaranteeing strict legibility at dense scales.

- **Tabular Figures:** Always apply `font-feature-settings: "tnum" 1` across all numerical displays, prices, SKU quantities, and stock totals to ensure column alignment.
- **Labels & Microcopy:** All `label-sm` and `label-md` variants applied to status tags, table headings, and section separators use uppercase transforms with expanded letter spacing for rapid scanning.

## Layout & Spacing
The layout implements a 12-column fluid grid system with distinct multi-tier responsive adaptations:

- **Desktop (1280px+):** Collapsible fixed-width primary sidebar (260px expanded, 72px iconified), 12-column workspace, 32px gutters, and 40px canvas margin.
- **Tablet / POS Screen (768px - 1279px):** Split-view layouts optimized for hybrid touch/mouse input. Default 16px margins, 24px gutters, persistent top bar, and sliding order-drawer panels.
- **Mobile Handheld Scanner (320px - 767px):** Single-column stacked workflow, 16px gutters and margins, sticky bottom action bars for high-speed single-thumb warehouse confirmation.

## Elevation & Depth
Depth is created through low-contrast perimeter outlines coupled with multi-stop, cool-tinted ambient shadows that mimic architectural materials:

- **Level 0 (Floor Canvas):** Base color `#F8FAFC`. Zero elevation, zero shadows.
- **Level 1 (Cards, Tabular Containers):** Surface `#FFFFFF`, border `1px solid #E2E8F0`, shadow `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)`.
- **Level 2 (Dropdown Menus, Flyouts):** Surface `#FFFFFF`, border `1px solid #CBD5E1`, shadow `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)`.
- **Level 3 (Modals, Checkout Panels, Slide-overs):** Surface `#FFFFFF`, border `1px solid #CBD5E1`, shadow `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.08)`.
- **Dark Mode Chrome & Navigation:** Elevated navigation rails use deep slate (`#0F172A`) with `1px solid rgba(255, 255, 255, 0.08)` outline definition.

## Shapes
A controlled, refined curvature (Soft - Level 1) conveys durability, precision, and dense screen efficiency:

- **Base Radius (`0.25rem`):** Applied to form fields, checkboxes, SKU tags, badges, and inline buttons.
- **Container Radius (`0.5rem`):** Applied to cards, panels, tabular views, and notification toasts.
- **Structural Radius (`0.75rem`):** Applied to modal dialogues, POS order checkout sheets, and floating toolbars.
- **Pill Formats:** Strictly reserved for round state indicators and status micro-dots. Primary interactive buttons remain rectangular with clean 4px or 8px corners to retain an industrial aesthetic.

## Components

### Buttons
- **Primary:** Background `#0F172A`, text `#FFFFFF`, 1px solid `#0F172A`. Hover: `#1E293B`. Active: `#0B1320`. Focus-visible: 2px ring offset with `#059669`.
- **Accent (Action/POS):** Background `#059669`, text `#FFFFFF`. Hover: `#047857`. Focus ring: `#10B981`.
- **Secondary / Outline:** Background `#FFFFFF`, text `#0F172A`, border `1px solid #E2E8F0`. Hover: `#F1F5F9`.
- **Destructive:** Background `#FFFFFF`, text `#DC2626`, border `1px solid #FCA5A5`. Hover: `#FEF2F2`.

### Inputs & Field Controls
- **Text & Numeric Inputs:** Height 40px (desktop) / 48px (touch POS), background `#FFFFFF`, border `1px solid #CBD5E1`, text `#0F172A`. Focused: border `#059669`, outline `2px solid rgba(5, 150, 105, 0.15)`.
- **Barcode / SKU Input Mode:** Monospace tracking, leading scanner icon, persistent action prefix.

### Checkboxes & Radios
- Size 16px × 16px, border `1.5px solid #94A3B8`, radius 4px (checkboxes) or full circle (radios).
- Checked state: background `#059669`, border `#059669`, icon `#FFFFFF`.

### Chips & Badges
- **Stock High / Complete:** Background `#ECFDF5`, text `#047857`, border `1px solid #A7F3D0`.
- **Low Stock / Warning:** Background `#FFFBEB`, text `#B45309`, border `1px solid #FDE68A`.
- **Out of Stock / Critical:** Background `#FEF2F2`, text `#B91C1C`, border `1px solid #FECACA`.
- **Draft / Inactive:** Background `#F1F5F9`, text `#475569`, border `1px solid #E2E8F0`.

### Data Grids & Inventory Tables
- **Header Row:** Background `#F8FAFC`, uppercase `label-sm` text `#475569`, border-bottom `1px solid #E2E8F0`. Height 40px.
- **Row:** Height 48px (compact) to 60px (detailed). Background `#FFFFFF`, hover `#F8FAFC`, selected `#ECFDF5`. Dividers: `1px solid #F1F5F9`.

### POS Keypad & Cart Modules
- Numerical entry buttons: Height 64px, background `#FFFFFF`, border `1px solid #E2E8F0`, active background `#F1F5F9`, typography `headline-md`.
- Quick-action cart summary: Sticky side panel, dark navigation bar (`#0B1320`), high-contrast totals with secondary accent highlights.