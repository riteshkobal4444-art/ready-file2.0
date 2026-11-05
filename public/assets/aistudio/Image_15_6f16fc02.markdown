---
name: Readyfile Minimal Utility
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf0'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9ff'
  surface-container-highest: '#d8e3f9'
  on-surface: '#111c2c'
  on-surface-variant: '#434654'
  inverse-surface: '#263141'
  inverse-on-surface: '#ebf1ff'
  outline: '#747685'
  outline-variant: '#c4c5d6'
  surface-tint: '#2853d0'
  primary: '#2451cd'
  on-primary: '#ffffff'
  primary-container: '#446be8'
  on-primary-container: '#fffbff'
  inverse-primary: '#b6c4ff'
  secondary: '#465c98'
  on-secondary: '#ffffff'
  secondary-container: '#a7bcff'
  on-secondary-container: '#344a85'
  tertiary: '#006a47'
  on-tertiary: '#ffffff'
  tertiary-container: '#00855a'
  on-tertiary-container: '#f5fff6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#001550'
  on-primary-fixed-variant: '#003ab2'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b3c5ff'
  on-secondary-fixed: '#001849'
  on-secondary-fixed-variant: '#2e447f'
  tertiary-fixed: '#79fabe'
  tertiary-fixed-dim: '#5adda4'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f9f9ff'
  on-background: '#111c2c'
  surface-variant: '#d8e3f9'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system is engineered for a document preparation platform that balances systematic operational rigor with tactile ease. The design personality is focused, confident, and warm—drawing from the informational precision of modern developer tooling while retaining the inviting clarity of accessible consumer workspaces. It eliminates decorative distraction in favor of structured geometry, high legibility, and predictable document workflows.

The visual style blends **modern minimalism** with **friendly utility**:
- Clean geometric white surfaces framed by subtle, razor-thin structural borders.
- Deliberate information hierarchy that privileges document content over interface mechanics.
- A calm, daylight-driven visual tone that avoids high-gloss effects, blur filters, or neon accents.
- Restrained, intentional interactions with instantaneous micro-feedback, communicating absolute reliability for legal, administrative, and creative document lifecycles.

## Colors

The palette relies on a balanced light scheme optimized for reading stamina, high data density, and clear status communication.

- **Primary (`#5278F5`)**: High-utility royal blue used exclusively for primary calls-to-action, key focus rings, and active state highlights.
- **Deep Navy (`#243B75`)**: Structural secondary tone reserved for navigational anchors, emphasized metadata chips, table headers, and high-priority branding touchpoints.
- **Neutral Core**:
  - `Primary Text (#182230)`: High-contrast ink tone for crisp typography and critical document labels.
  - `Secondary Text (#687386)`: Slate grey for supporting copy, metadata, timestamps, and input placeholders.
  - `Border / Hairline (#E7EAF0)`: Architectural boundary color for cards, panels, table grids, and input contours.
  - `Canvas Background (#FFFFFF)`: Pure white primary workspace.
  - `Subtle Canvas (#F4F6FA)`: Cool off-white background used for toolbars, sidebars, page gutters, and table alternating rows.
- **System States**:
  - `Success (#24B47E)`: Natural forest green for verified signatures, completion checks, and valid states.
  - `Error (#E05252)`: Restrained ruby red for validation alerts, critical deletions, and incomplete step blocks.

Never use pure black (`#000000`) for text or borders. Never apply chromatic drop shadows or gradient fills to interactive buttons.

## Typography

The typography architecture uses a high-character dual-font pairings:
- **Plus Jakarta Sans** delivers approachable, geometric authority in all display and heading scales, lending structural polish to document titles and modal headers.
- **Inter** provides objective, neutral precision across all running body text, tabular numeric views, forms, and micro-labels.

All headings above 24px must apply tight tracking (`-0.01em` to `-0.02em`) to maintain editorial density. Data values, form fields, and table contents use tabular figures where appropriate. Never use decorative script or heavy condensed styles.

## Layout & Spacing

The layout is structured on an 8pt base grid with a 4pt micro-increment for tight component interiors.

- **Desktop (1200px+)**: 12-column responsive layout with `2rem` page margins and `1.5rem` gutters. Maximum application canvas width is capped at 1440px for document management dashboards, while document editors occupy a fixed 850px central workspace flanked by collapsable side rails.
- **Tablet (768px – 1199px)**: 8-column layout with `1.5rem` outer margins and `1rem` gutters. Side panels shift to drawer overlays.
- **Mobile (< 768px)**: 4-column layout with `1rem` outer margins and `0.75rem` gutters. Complex multi-column form layouts fold strictly into vertical single-column stacks.

Component spacing rhythm strictly follows designated increments:
- `space-xs` (4px): Gap between icon and adjacent label, stacked micro-tags.
- `space-sm` (8px): Form input inner vertical padding, spacing between closely related list items.
- `space-md` (16px): Card internal content padding, default form field group gap.
- `space-lg` (24px): Card perimeter padding, dashboard module separation.
- `space-xl` (40px): Section divisions across document review templates.

## Elevation & Depth

Visual hierarchy is communicated through **tonal separation** and **ambient micro-shadows**, paired directly with 1px border bounds. Avoid heavy drop shadows, neon glows, or frosted glass blurs.

- **Level 0 (Flat Canvas)**: Background `#FFFFFF` or secondary background `#F4F6FA` with no elevation.
- **Level 1 (Cards, Content Blocks, Form Containers)**: 
  - Background: `#FFFFFF`
  - Border: `1px solid #E7EAF0`
  - Shadow: `0 1px 2px 0 rgba(24, 34, 48, 0.04)`
- **Level 2 (Hover States, Popovers, Dropdown Menus)**: 
  - Background: `#FFFFFF`
  - Border: `1px solid #E7EAF0`
  - Shadow: `0 4px 12px 0 rgba(24, 34, 48, 0.06), 0 1px 2px 0 rgba(24, 34, 48, 0.03)`
- **Level 3 (Modal Dialogs, Document Preview Sheets)**: 
  - Background: `#FFFFFF`
  - Border: `1px solid #E7EAF0`
  - Shadow: `0 12px 32px -4px rgba(24, 34, 48, 0.10), 0 2px 6px -1px rgba(24, 34, 48, 0.04)`

Backdrop scrims for modal dialogs use `#182230` at `40%` opacity without backdrop blur to maintain visual clarity.

## Shapes

The design system employs a soft-modern geometric curvature scale calibrated to balance precision and friendliness:

- **Cards and Major Panels**: `12px` to `16px` border-radius (`rounded-lg` to `rounded-xl`).
- **Interactive Controls (Buttons, Inputs, Selects)**: `8px` border-radius (`rounded`).
- **Small Indicators (Badges, Status Pills, Avatar Masks)**: `9999px` fully rounded pill shape for status elements; `6px` for small icon utility containers.

All interactive elements feature uniform 1px solid vector strokes without simulated bevels or skeuomorphic highlights.

## Components

### Buttons
- **Primary**: Background `#5278F5`, label `#FFFFFF` (`label-lg`), border none, radius `8px`. Hover: `#4165DC`. Active: `#3453B8`.
- **Secondary**: Background `#FFFFFF`, label `#182230`, border `1px solid #E7EAF0`, radius `8px`. Hover: `#F4F6FA`.
- **Tertiary / Ghost**: Background transparent, label `#687386`, radius `8px`. Hover: `#F4F6FA` with label `#182230`.
- **Destructive**: Background `#FFFFFF`, label `#E05252`, border `1px solid rgba(224, 82, 82, 0.25)`. Hover: `#E05252` fill with `#FFFFFF` text.
- Height scale: Compact `32px`, Default `40px`, Large `48px`.

### Input Fields & Controls
- **Text Inputs**: Height `40px`, padding `0 12px`, background `#FFFFFF`, border `1px solid #E7EAF0`, text `#182230`, placeholder `#687386` (`body-md`), radius `8px`. Focus: border `#5278F5`, box-shadow `0 0 0 3px rgba(82, 120, 245, 0.15)`.
- **Checkboxes & Radios**: Size `18px`, radius `4px` (checkbox) or `50%` (radio), border `1.5px solid #E7EAF0`. Checked: background `#5278F5`, icon checkmark `#FFFFFF`. Focus: outline `2px solid rgba(82, 120, 245, 0.2)`.

### Chips & Status Badges
- Height `24px`, padding `0 8px`, border-radius `9999px`, typography `label-sm`.
- **Draft / Neutral**: Background `#F4F6FA`, text `#687386`, border `1px solid #E7EAF0`.
- **In Review**: Background `rgba(82, 120, 245, 0.08)`, text `#5278F5`, border `1px solid rgba(82, 120, 245, 0.2)`.
- **Completed**: Background `rgba(36, 180, 126, 0.08)`, text `#24B47E`, border `1px solid rgba(36, 180, 126, 0.2)`.
- **Action Required**: Background `rgba(224, 82, 82, 0.08)`, text `#E05252`, border `1px solid rgba(224, 82, 82, 0.2)`.

### Cards & Document Containers
- Background `#FFFFFF`, border `1px solid #E7EAF0`, radius `14px`, padding `space-lg` (24px).
- Optional card header separated by a continuous `1px solid #E7EAF0` divider line with `space-md` internal spacing.

### Lists & Document Rows
- Interactive table and list items feature height `52px`, padding `0 16px`, background `#FFFFFF`.
- Row dividers use a crisp bottom border `1px solid #E7EAF0`. Hover shifts background to `#F4F6FA` with an instant transition (`100ms ease-out`).

### Specialized Document Components
- **Signature Field Target**: Dashed border `1.5px dashed #5278F5`, background `rgba(82, 120, 245, 0.04)`, radius `8px`, with a centered prompt chip.
- **Document Outline Navigator**: Vertical tree list with `2px` left border indicator active marker `#5278F5`, inactive `#E7EAF0`, font `label-md`.
- **Iconography**: 20px and 16px geometric outline icons, stroke width `1.75px`, matching active text color tone.