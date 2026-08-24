---
name: Kinetic Pulse
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c1c6d7'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8b90a0'
  outline-variant: '#414755'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e69'
  primary-container: '#4b8eff'
  on-primary-container: '#00285c'
  inverse-primary: '#005bc1'
  secondary: '#ffbc7c'
  on-secondary: '#4b2800'
  secondary-container: '#fe9400'
  on-secondary-container: '#633700'
  tertiary: '#47e266'
  on-tertiary: '#003910'
  tertiary-container: '#00a73e'
  on-tertiary-container: '#00320d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#ffdcbf'
  secondary-fixed-dim: '#ffb874'
  on-secondary-fixed: '#2d1600'
  on-secondary-fixed-variant: '#6a3b00'
  tertiary-fixed: '#6cff82'
  tertiary-fixed-dim: '#47e266'
  on-tertiary-fixed: '#002106'
  on-tertiary-fixed-variant: '#00531a'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-xl:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
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
  unit: 8px
  container-padding: 32px
  gutter: 24px
  touch-target-min: 56px
  stack-gap: 16px
---

## Brand & Style

The design system is engineered for high-performance environments, specifically gym kiosks where speed, clarity, and motivation are paramount. The brand personality is **Modern, Energetic, and Decisive**, utilizing a **High-Contrast / Bold** design style to ensure legibility under gym lighting and during physical activity. 

The UI should evoke a sense of momentum and "readiness." It prioritizes large touch targets and high-impact visual cues to minimize cognitive load for users who may be mid-workout. By blending clean geometric lines with vibrant, glowing accents, the design system creates a professional yet high-energy atmosphere that aligns with the user's fitness goals.

## Colors

The palette is optimized for a **high-contrast dark mode** to reduce glare in fitness centers. 

- **Primary (Electric Blue):** Used for main actions, active states, and focus indicators. It provides a technical, "bio-metric" feel.
- **Secondary (Energetic Orange):** Reserved for motivational highlights, streak indicators, and secondary calls to action.
- **Tertiary (Vitality Green):** Used specifically for "Success" states, completion indicators, and "Start Workout" buttons.
- **Surface & Background:** The background is a deep `#121212`. Elevated surfaces use `#1E1E1E` to maintain a clear visual hierarchy without sacrificing the dark aesthetic. 
- **Typography:** Pure white (#FFFFFF) is used for headings to maximize contrast, while `#A0A0A0` is used for secondary metadata.

## Typography

This design system utilizes a tiered typography approach to handle high-density data and high-impact messaging. 

**Montserrat** is used for all "Display" and "Headline" roles. Its geometric, wide-set characters convey stability and power. To maintain a modern edge, Display styles use an Extra Bold (800) weight with tight letter spacing.

**Inter** handles all functional text and body copy. It was chosen for its exceptional legibility on digital screens. For kiosk use, the base body size is slightly increased to **18px** to ensure it can be read from a slight distance. Labels use a semi-bold or bold weight to ensure they stand out against dark backgrounds.

## Layout & Spacing

The layout follows a **Fluid Grid** model with generous safe zones to account for touch-screen interactions. 

- **Grid:** A 12-column grid is used for desktop/kiosk views, collapsing to 4 columns for mobile-responsive states.
- **Touch-First Design:** All interactive elements must maintain a minimum hit area of **56px**. 
- **Rhythm:** An 8px linear scale governs all spacing. Vertical stacks within cards should use a 16px (2x) gap, while section margins should use 48px or 64px to create distinct visual separation.
- **Margins:** Large 32px outer margins ensure that content is never too close to the physical bezel of the kiosk hardware.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** and **Subtle Outer Glows** rather than traditional heavy shadows, which can appear muddy on dark displays.

- **Level 0:** Background (`#121212`).
- **Level 1:** Cards and Containers (`#1E1E1E`).
- **Level 2:** Overlays and Modals (`#2C2C2C`).

To indicate interactivity and "energy," active buttons or focused states should utilize a subtle colored outer glow (0px 4px 20px) using a 30% opacity of the Primary color. This mimics the look of a glowing LED indicator.

## Shapes

The shape language is **Rounded**, striking a balance between modern friendliness and professional structure. 

- **Standard Elements:** Buttons and input fields use a `0.5rem` (8px) corner radius.
- **Large Containers:** Workout cards and modal windows use `1rem` (16px) to soften the large dark surfaces.
- **Status Pills:** Small indicators (e.g., "In Progress") use a fully rounded/pill-shaped radius to differentiate them from interactive buttons.

## Components

- **Primary Buttons:** High-contrast Electric Blue backgrounds with Bold White Inter text. They must span at least 50% of their container width to remain easily tappable.
- **Motivator Chips:** Small, Secondary Orange or Vitality Green badges used to highlight personal records or completed goals.
- **Metric Cards:** Use large Montserrat numbers for statistics (e.g., heart rate, reps). These cards should have a 1px border of `#333333` to define their edges against the dark background.
- **Input Fields:** Large text entry areas with a `#2C2C2C` fill. On focus, the border transitions to Primary Electric Blue with a subtle glow.
- **Progress Bars:** Use a thick 12px track. The "unfilled" portion is a dark grey (`#333333`), while the "filled" portion uses a gradient from Primary Blue to Secondary Orange to represent intensity.
- **Status Indicators:** Clear, high-contrast icons (e.g., a green checkmark or a pulsing orange ring) to provide instant feedback on user actions.