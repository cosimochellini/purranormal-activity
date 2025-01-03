You are an expert in TypeScript, Node.js, Next.js App Router, React, and Tailwind CSS.

Code Style and Structure

- Write concise, technical TypeScript code with accurate examples.
- Use functional and declarative programming patterns; avoid classes.
- Prefer iteration and modularization over code duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError).
- Structure files: exported component, subcomponents, helpers, static content, types.
- Prefer arrow functions over function declarations.
- Use "classnames" library for conditional classes.

Naming Conventions

- Use lowercase with dashes for directories (e.g., components/auth-wizard).
- Favor named exports for components.

TypeScript Usage

- Use TypeScript for all code; prefer interfaces over types.
- Avoid enums; use maps instead.
- Use functional components with TypeScript interfaces.

Syntax and Formatting

- Use arrow functions for pure functions.
- Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements.
- Use declarative JSX.

UI and Styling

- Use Tailwind for components and styling.
- Implement responsive design with Tailwind CSS; use a mobile-first approach.

Performance Optimization

- Minimize 'use client', 'useEffect', and 'setState'; favor React Server Components (RSC).
- Wrap client components in Suspense with fallback.
- Use dynamic loading for non-critical components.
- Optimize images: use WebP format, include size data, implement lazy loading.

Key Conventions

- Optimize Web Vitals (LCP, CLS, FID).
- Limit 'use client':
  - Favor server components and Next.js SSR.
  - Use only for Web API access in small components.
  - Avoid for data fetching or state management.

Follow Next.js docs for Data Fetching, Rendering, and Routing.

Purpose of the project:
Below is a proposed approach and concept design outline, incorporating your answers and preferences:

**Conceptual Direction:**

- **Overall Tone:** Mystical, enchanting, and whimsical—think of a playful fairy-tale world infused with paranormal elements. The atmosphere should blend cute, tongue-in-cheek humor with dreamy, magical visuals.

- **Color Scheme & Aesthetics:**

  - **Primary Colors:** Deep purples, midnight blues, and starry blacks to convey a mystical night-sky environment.
  - **Accent Colors:** Hints of neon greens, glowing whites, and pale pinks to highlight ghostly apparitions, magical glows, and the presence of paranormal entities.
  - **Visual Motifs:** Subtle ghostly shapes drifting in the background, sparkles and wisps of magic, and curling wispy smoke to represent mysterious paranormal energy.

- **Typography:**
  - **Primary Font:** A whimsical, handwritten or slightly quirky serif font that evokes spellbooks and magical texts.
  - **Secondary Font:** A clean, playful sans-serif font for body text to maintain readability.

**Key Visual Elements:**

1. **Hero Section (Landing Page):**

   - **Main Illustration:** A playful scene featuring the magical kitten mid-incantation—eyes glowing, tiny witch’s hat tipped forward—and the frightened chick peering from behind a small stack of witchy spell books.
   - **Animated Details:**
     - The kitten’s tail might swish subtly.
     - A gentle glowing aura or floating particles around them.
     - A small ghost drifting lazily across the screen.
   - **Tagline/Headline:** Something fun and cheeky, like: **"Track the Spooky Shenanigans of Your Magical Kitten!"**
   - **Call-to-Action (CTA):** A whimsical button (e.g., **"Begin Your Paranormal Log"**) that leads to sign-up or login.

2. **Latest Events Section:**

   - **Layout:** A scrollable or swipeable carousel of “Latest Paranormal Occurrences.”
   - **Design:** Each event card could feature a small icon or illustration (like a tiny ghost cat footprint or a floating feather) and a short description of the mysterious event. Hover or tap animations could make the cards gently bob or reveal a subtle glow.
   - **Transitions:** Smooth fade-ins as the user scrolls, with ghost-like silhouettes flickering on the edges.

3. **Add a New Log Page:**

   - **Design Element:** A whimsical form on a parchment-textured background.
   - **Icons/Animations:** A quill pen icon could animate lightly when the user focuses on input fields. Maybe subtle twinkles around the input boxes.
   - **Fun Placeholder Text:** Instead of “Enter event details,” something like “What magical mischief occurred at the stroke of midnight?”

4. **Stats Page:**
   - **Visuals:** A stylized, arcane “statistics” area, with charts shaped like cauldrons or crystal balls.
   - **Colorful Animations:** Bars could fill up with a glowing liquid, and pie charts could be represented as spectral orbs that gently rotate or pulsate.
   - **Data Emphasis:** Show counts of paranormal events, frequency over time, types of occurrences. Headings like “Ghostly Encounters,” “Witching Hours,” and “Magical Mishaps” could keep the tone fun.

**User Experience Notes:**

- **Navigation:**

  - Keep a simple, whimsical top navigation bar with playful hover states. Perhaps the menu items are tiny icons (cat paw for events, quill pen for new log, crystal ball for stats) that when hovered over, reveal text labels and a subtle glow effect.

- **Micro-Interactions:**

  - Tiny sparkles when buttons are clicked.
  - A soft whooshing sound for transitions if audio feedback is desired (optional).

- **Branding Through Imagery:**
  - The cat and chick characters should appear consistently. For instance, the chick might peek out from behind charts on the stats page or look nervous when the user is about to log a new event.
  - The cat might give a sly wink on hover of certain interactive elements.

**Putting It All Together:**

The landing page sets a magical, humorous tone right away, introducing the characters and the premise: documenting paranormal kitten-induced events for fun. The whimsical animations and enchanting theme carry through the entire user journey—whether browsing the latest spooky sightings, logging a new strange happening, or reviewing stats with charming visual metaphors.

Ultimately, this approach delivers a mystical and enchanting, yet playful and humorous environment—just right for a gift that’s meant to be cute, lighthearted, and memorable.
