---
name: Amstramgram
description: Self-hosted media browser — no platform, no noise, just your archive.
colors:
  bg: "#ffffff"
  bg-dark: "#000000"
  ink: "#262626"
  pale-paper: "#f5f5f5"
  quiet-gray: "#8e8e8e"
  quiet-gray-dark: "#a8a8a8"
  hairline: "#dbdbdb"
  hairline-dark: "#363636"
  ghost: "#efefef"
  ghost-dark: "#1c1c1e"
  signal-red: "#ed4956"
  archive-maroon: "#8b2035"
  memory-green: "#2d6a4f"
  warning: "#e03131"
  system-green: "#34c759"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.3px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.04em"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  action:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  full: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.quiet-gray}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  action-forget:
    backgroundColor: "{colors.archive-maroon}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    height: "56px"
  action-remember:
    backgroundColor: "{colors.memory-green}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    height: "56px"
  input-field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: Amstramgram

## 1. Overview

**Creative North Star: "The Signal, Not the Noise"**

Amstramgram's design system exists for one reason: to make downloaded media visible and actionable, with no platform in between. Every design decision is subtractive. If a visual element can be removed without cost to the user, it was never necessary. The chrome whispers; the content speaks.

The aesthetic is earned simplicity — not minimalism as a style statement, but minimalism as honesty. System fonts, near-pure neutrals, a tight action vocabulary. No gradient text. No decorative blur. No engagement bait masquerading as interface. The tool looks like what it is: a fast, private, owner-controlled media viewer.

This system explicitly rejects Instagram 2024's overloaded, algorithm-first visual noise; the media-center weight of Plex or Jellyfin; the admin-grid sterility of SaaS dashboards; and the decorative excess of Pinterest and Tumblr. It does not try to be beautiful. It tries to be trustworthy.

**Key Characteristics:**
- Content-first: media fills the frame without competing chrome
- System font stack: native rendering on every OS, zero load cost
- Restrained color strategy: neutrals carry >90% of the surface; accents are functional signals only
- Flat by default: no decorative shadows; depth appears only when floating over dynamic content
- Dual-mode via OS: automatic light/dark response, no toggle required

## 2. Colors: The Signal Palette

Near-pure neutrals with exactly five functional accent signals. The palette has no personality of its own — it exists to make the media's palette the thing you see.

### Primary

- **Ink** (`#262626`): Primary text in light mode — headings, usernames, captions, stats, active nav icons, button backgrounds. The heaviest presence in the system.

### Neutral

- **Clean White** (`#ffffff`): Page background, form backgrounds, card surfaces in light mode.
- **Pure Void** (`#000000`): Page background in dark mode. Maximum contrast.
- **Pale Paper** (`#f5f5f5`): Primary text color in dark mode.
- **Quiet Gray** (`#8e8e8e` light / `#a8a8a8` dark): Muted text — timestamps, stat labels, inactive tab icons, helper copy, ghost button text. The bridge between Ink and silence.
- **Hairline** (`#dbdbdb` light / `#363636` dark): The structural divider. Input borders, section separators, action bars, the tab bar's 0.5px top edge. Used wherever a line must exist but not demand attention.
- **Ghost** (`#efefef` light / `#1c1c1e` dark): Barely-there separator. One tier quieter than Hairline.

### Accents (functional, not decorative)

- **Signal Red** (`#ed4956`): Heart/favorite active state. SVG fill only, never a background. Its rarity — appearing only when something is saved — is the point.
- **Archive Maroon** (`#8b2035`): "Forget" action button. Signals irreversibility and removal.
- **Memory Green** (`#2d6a4f`): "Remember" action button. Signals preservation and intent.
- **Warning** (`#e03131`): Form error messages. Nowhere else.
- **System Green** (`#34c759`): iOS-style active toggle state. Borrowed from the system; universally understood.
- **Identity Ring** (`linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)`): Avatar border gradient. The only decorative element in the system, intentionally borrowed from Instagram to signal account identity. Used exclusively on the 36px avatar ring.

### Named Rules

**The Signal Rule.** Each accent color carries exactly one semantic meaning. Signal Red means saved. Archive Maroon means archive. Memory Green means remember. Warning means error. System Green means active. These colors are forbidden in any other context.

**The Ghost Border Rule.** Structural separation uses Hairline, not shadow. If you're reaching for a shadow to divide two content areas, use a 1px Hairline border instead.

## 3. Typography

**Body Font:** -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif

**Character:** The system font stack is a deliberate design decision, not a placeholder. It renders natively on every OS — the interface looks like the device's own UI, which is exactly right for a self-hosted utility. Zero font-load latency. No FOUT. No brand personality imposed on top of the user's media.

### Hierarchy

- **Title** (700, 22px, 1.2 line-height, -0.3px tracking): Page titles only — "Settings", "Following". One per view. The tracking compression signals authority without shouting.
- **Account / Strong body** (600, 14px–16px, 1.2 line-height): Usernames in post headers, action button labels. Weight is the hierarchy signal.
- **Body** (400, 14px, 1.5 line-height): Post captions, form input values, account counts. Max display column ~470px — single-column, never wrapping to measure.
- **Label** (500, 13px, 1.2 line-height, 0.04em tracking, uppercase where used for section labels): Section labels ("Session ID", "Scheduler"), stat labels ("media", "on disk"). All-caps + slight tracking creates clear hierarchy at low visual noise.
- **Caption** (400, 12px, 1.4 line-height): Timestamps, secondary metadata. The quietest readable tier.

### Named Rules

**The System Font Rule.** Never load a webfont. The system stack is the design choice. A custom typeface would introduce platform anxiety into a tool whose purpose is calm, private utility.

**The Weight-as-Hierarchy Rule.** Scale steps in this system are narrow (12–22px range). Hierarchy lives primarily in weight contrast (400 vs 600 vs 700), not scale jumps. Do not add new size steps to create hierarchy; add weight contrast instead.

## 4. Elevation

The system is flat by default. Surfaces sit at one level. Depth is not used for hierarchy or decoration — it is reserved for the one real need: keeping UI controls readable when they float over photographic content.

### Shadow Vocabulary

- **Float Shadow** (`0 1px 6px rgba(0, 0, 0, 0.22)`): Carousel navigation buttons only. Meaning: "I am a control floating in front of an image." Nothing else in the system uses this shadow.
- **Backdrop Blur** (`backdrop-filter: blur(12px)` with frosted-glass background): Tab bar only. Meaning: "There is scrollable content behind this fixed chrome." Functional, not decorative.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow on a card, list item, settings row, or section is forbidden. If an element needs to feel elevated, it is floating over dynamic content — and that is the only case a shadow is permitted.

## 5. Components

### Bottom Tab Bar

The structural spine of the app. Four icon-only tabs with equal 48×48px touch targets. Backed by a frosted blur that separates it from scrolling content without a hard edge. Icons switch between stroked (inactive) and filled (active) state — no animation needed; the fill/stroke swap is instantaneous and unambiguous.

- **Height:** 49px + `env(safe-area-inset-bottom)` (full iPhone safe area support)
- **Background:** `rgba(255,255,255,0.92)` light / `rgba(0,0,0,0.92)` dark
- **Backdrop:** `blur(12px)` (functional only — tab chrome over scroll content)
- **Border:** 0.5px Hairline top edge
- **Tab target:** 48×48px
- **Active color:** Ink / Pale Paper (adaptive)
- **Inactive color:** Quiet Gray (adaptive)
- **Transition:** `color 0.15s`, press → `scale(0.88) 0.1s`

### Post Card

Content atom for the feed. Frameless: no card border, no card shadow, no radius. The image bleeds full-width. Post header floats above with padding only. Caption sits below with minimal top padding. Architecture communicates: content first, metadata second, frame never.

- **Card border:** None
- **Card shadow:** None
- **Card radius:** None — images bleed edge to edge
- **Max width:** 470px, centered
- **Header padding:** 10px 14px, gap 10px
- **Image:** `width: 100%; display: block`, lazy loaded
- **Caption:** 14px body, 10px 14px 0 padding

### Action Buttons (Forget / Remember)

The primary interaction in the random screen. Large, split, 56px height. Semantic color assignment is load-bearing: Archive Maroon signals removal; Memory Green signals preservation. The press state (`scale(0.96)`) confirms the action without requiring a modal.

- **Height:** 56px
- **Radius:** gently curved (12px)
- **Gap between pair:** 12px
- **Forget:** `#8b2035` background, white text, X icon
- **Remember:** `#2d6a4f` background, white text, heart icon
- **Press:** `scale(0.96)`, `opacity 0.85`, `transition 0.1s`
- **Disabled:** `opacity 0.6`, `cursor default`

### Primary Button

Compact solid action. Ink background in light mode (inverts in dark). Used for single confirmatory actions: "Update", "Sync now", "Sync saved posts".

- **Background:** Ink (adaptive: `var(--color-text)`)
- **Text:** bg-inverse (adaptive: `var(--color-bg)`)
- **Padding:** 10px 20px
- **Radius:** gently curved (8px)
- **Font:** 14px, 600 weight
- **Disabled:** `opacity 0.4`
- **Press:** `opacity 0.7`

### Ghost Button

Secondary action, often paired with Primary. Transparent background, muted text, thin Hairline border. "Reset to default" is the canonical use case.

- **Background:** transparent
- **Text:** Quiet Gray
- **Border:** 1px Hairline
- **Radius:** 8px
- **Padding:** 10px 20px

### Input Field

Single-line text input. Stroke-style: white background, Hairline border at rest. On focus, the border sharpens to Ink — the border shift is the only signal, no fill change, no glow, no shadow.

- **Background:** `var(--color-bg)` (adaptive)
- **Border:** 1px Hairline; on `:focus` → 1px Ink
- **Radius:** 8px
- **Padding:** 10px 12px
- **Font:** 14px body stack
- **Outline:** none (border handles focus state entirely)

### iOS Toggle

On/off switch for Scheduler and account active status. Exact iOS visual: 51×31px track, 27px thumb, 2px inset. Active state is System Green (`#34c759`); inactive is platform gray. The thumb slides 20px on check.

- **Track active:** `#34c759` (System Green)
- **Track inactive light:** `#e5e5ea`
- **Track inactive dark:** `#3a3a3c`
- **Thumb:** white, `0 2px 4px rgba(0,0,0,0.25)` shadow, 27×27px, 2px inset
- **Transition:** `background 0.2s`, `transform 0.2s`
- **Note:** Hidden checkbox technique; the visible `.track` element carries all styling

### Avatar Ring (Signature Component)

The only decorative element in the system. A 36px circular avatar with a 2px Instagram-gradient border (implemented as padding + gradient background on a wrapper). Inner circle uses a deterministic color from a 6-color palette as fallback when the profile image fails to load. The gradient signals "this is an account identity" — it deliberately borrows Instagram's visual language because users already associate it with that meaning.

- **Outer ring:** 36×36px, `border-radius: 50%`, 2px padding, Instagram gradient background
- **Inner circle:** `border: 2px solid var(--color-avatar-border)` (adaptive white/black to match bg)
- **Fallback colors:** `['#e91e63', '#9c27b0', '#2196f3', '#00bcd4', '#ff5722', '#ff9800']` — deterministic hash of username
- **Fallback text:** first character of username, 13px, 600 weight, white

## 6. Do's and Don'ts

### Do:

- **Do** use the CSS custom property `var(--color-text-muted)` for muted text. Never write `#8e8e8e` directly — the token is dark-mode aware; the hex is not.
- **Do** keep action button colors semantic: Archive Maroon (`#8b2035`) for destructive/forget actions, Memory Green (`#2d6a4f`) for save/remember actions.
- **Do** keep touch targets ≥ 44×44px on mobile. Extend the visible element's clickable area via padding, not by making the visual element larger.
- **Do** use Hairline borders as structural dividers. Every horizontal rule, input border, and section separator uses Hairline.
- **Do** apply `env(safe-area-inset-bottom)` to any fixed bottom element (tab bar, bottom sheets). The system already does this; don't regress it.
- **Do** lazy-load images below the fold (`loading="lazy"`). The feed can hold many posts.
- **Do** animate only `opacity` and `transform`. State transitions use these two properties only.

### Don't:

- **Don't** add `border-left` or `border-right` greater than 1px as a colored stripe on any card, list item, or callout. Rewrite with background tint, leading icon, or nothing.
- **Don't** use gradient text (`background-clip: text` + gradient). Emphasis through weight or size only.
- **Don't** add `backdrop-filter` outside the tab bar. The blur is purposeful there; on a card or modal it becomes decorative glassmorphism.
- **Don't** add a shadow to a card, list row, settings section, or any surface at rest. The Flat-By-Default Rule is non-negotiable.
- **Don't** make this look like Instagram 2024: algorithmic layout, Reels-first visual hierarchy, engagement-bait micro-animations, dark patterns in action flows.
- **Don't** use a media-center layout (Plex/Jellyfin patterns): album grids with cover art, sidebar navigation, collection headers, progress bars on photos.
- **Don't** introduce SaaS dashboard aesthetics: stat card grids, sidebar navigation, progress rings, gradient accents on numbers, hero metric templates.
- **Don't** use Pinterest or Tumblr-style masonry, decorative card chrome, or expressive layout patterns. Content cells are frameless; the image is the card.
- **Don't** load a custom webfont. The system font stack is the design decision.
- **Don't** use Signal Red, Archive Maroon, Memory Green, System Green, or Warning in any new context. These colors have one meaning each; a second use destroys the signal.
