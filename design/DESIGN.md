---
name: Kinetic Dark
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e2bfb0'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#a98a7d'
  outline-variant: '#5a4136'
  surface-tint: '#ffb693'
  primary: '#ffb693'
  on-primary: '#561f00'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#a04100'
  secondary: '#c8c6c5'
  on-secondary: '#303030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#c8c6c6'
  on-tertiary: '#303030'
  tertiary-container: '#9a9999'
  on-tertiary-container: '#313131'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1b1b1c'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Montserrat
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Montserrat
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Montserrat
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Montserrat
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The design system is engineered for high-performance environments where speed, precision, and energy are paramount. It targets a professional audience in sectors like fintech, automotive tech, or high-end sports analytics. The emotional response is one of controlled power—the "cockpit" feel of a high-end machine.

The aesthetic blends **Modern Corporate** reliability with **High-Contrast Bold** accents. It utilizes a deep charcoal foundation to minimize eye strain and maximize the vibrance of its primary kinetic energy source: a searing, saturated orange. The interface should feel expensive, technical, and hyper-responsive.

## Colors

This design system utilizes a "Void and Ignition" palette. The primary surface is an ultra-deep charcoal (#0A0A0A), providing a true-black feel that makes the primary orange (#FF6B00) appear to glow. 

- **Primary:** High-energy orange used for calls to action, active states, and critical indicators.
- **Secondary/Surface:** Deep grey used for card backgrounds and navigation sidebars to create subtle depth.
- **Accents:** Functional grays for borders and inactive states to ensure the orange remains the sole focus of kinetic energy.
- **Semantic:** Success (Emerald), Error (Crimson), and Warning (Amber) should be used sparingly, ensuring their saturation matches the primary orange.

## Typography

The design system uses **Montserrat** for display, headline, and title roles, and **Inter** for labels and body text. This mixed approach provides geometric, technical impact for headings while maintaining excellent readability for dense data and labels. The type hierarchy relies on significant weight contrast—heavy bolds for headlines and medium/regular weights for utility text.

For "Display" and "Headline" roles, use a tighter letter-spacing to give the text a compact, engineered look. All "Label" roles should be set in uppercase with increased letter-spacing to enhance legibility against dark backgrounds. Ensure all body text uses a high-contrast white or very light gray (#E0E0E0) to maintain WCAG accessibility on the charcoal surfaces.

## Layout & Spacing

This design system follows a **12-column fluid grid** for desktop and a **4-column grid** for mobile. The layout philosophy is built on an 8px base unit, ensuring all components align to a predictable rhythm.

- **Desktop:** 48px side margins with 24px gutters. Content should feel expansive but structured.
- **Mobile:** 16px side margins with 12px gutters.
- **Density:** High information density is encouraged. Use "md" (24px) spacing for primary grouping and "sm" (12px) for internal element relationships.

Layouts should favor structural alignment over fluid organic shapes, reinforcing the "professional instrument" aesthetic.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** rather than heavy shadows. In a dark environment, depth is perceived by lightness.

1.  **Level 0 (Floor):** #0A0A0A — The base canvas.
2.  **Level 1 (Card/Nav):** #1F1F1F — Elevated surfaces.
3.  **Level 2 (Dialog/Pop-up):** #2D2D2D — The highest surface level.

To add "Kinetic" energy, use **Primary Glows** for interactive elements. Instead of a traditional black shadow, use a low-opacity orange glow (e.g., `0px 4px 20px rgba(255, 107, 0, 0.15)`) on hovered primary buttons or active indicators. Borders should be thin (1px) and use a low-contrast gray (#333333) to define shapes without creating visual noise.

## Shapes

The design system uses **Rounded (0.5rem)** corners as the standard. This softens the aggressive high-contrast color palette, making the professional environment feel approachable and modern rather than hostile.

- **Standard Elements (Buttons, Inputs):** 8px (0.5rem)
- **Large Elements (Cards, Containers):** 16px (1rem)
- **Small Elements (Tags, Badges):** 4px (0.25rem)

Avoid fully pill-shaped buttons unless they are used for specialized "action pills" like floating filters; the 8px corner maintains a more architectural, stable feel for primary navigation and forms.

## Components

### Buttons
Primary buttons are solid Orange (#FF6B00) with Black (#0A0A0A) text, using Bold Montserrat. Secondary buttons use a transparent background with a 1px orange border. Hover states should trigger a subtle orange outer glow.

### Input Fields
Inputs use the #1F1F1F surface with a subtle 1px border. Upon focus, the border transitions to Orange, and a very faint orange inner-glow is applied. Labels are always positioned above the field in uppercase bold.

### Cards
Cards are flat #1F1F1F containers. They do not use shadows by default. Depth is communicated via a slightly lighter border (#333333). On hover, the border can transition to #444444 or the Primary Orange to indicate interactivity.

### Chips & Badges
Small, high-contrast indicators. For "Active" status, use a solid Orange background. For "Neutral" or "Inactive," use #2D2D2D with white text.

### Semantic Color Tokens (Extended)

Beyond the core palette, the design system defines these semantic tokens for status/feedback:

| Variable | Dark | Light | Usage |
|----------|------|-------|-------|
| `--color-info` | `#60a5fa` | `#1565C0` | Informational badges, tooltips |
| `--color-success` | `#4ade80` | `#2B6B3B` | Success states, active indicators |
| `--color-warning` | `#fbbf24` | `#C47A0B` | Warnings, expiring soon |
| `--color-success-container` | `#166534` | `#C8E6C9` | Success badge backgrounds |
| `--color-warning-container` | `#78350f` | `#FEF3C7` | Warning badge backgrounds |

### Selection Controls
Checkboxes and Radio buttons use the Primary Orange for the checked state. The "unselected" state is a simple #333333 outline to remain unobtrusive.

### Data Visualization
When displaying charts or graphs, the Primary Orange should be the lead data line. Secondary data lines should use muted grays or desaturated oranges to maintain the "Black and Orange" thematic focus.