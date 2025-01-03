# Purranormal Activity

Track the magical mishaps and spooky shenanigans of your enchanted kitten! A whimsical web application that lets you document paranormal events caused by a magical kitten and their frightened chick companion.

<img src="https://raw.githubusercontent.com/cosimochellini/purranormal-activity/refs/heads/main/images/hero.webp" alt="Hero Image" width="200" height="200">

**Live Demo**: [https://purranormal-activity.pages.dev/](https://purranormal-activity.pages.dev/)

---

## 🌟 Features

- **Event Logging**: Document supernatural occurrences with detailed descriptions.
- **AI-Powered**: Generates unique images for each paranormal event using OpenAI’s DALL-E.
- **Magical Categories**: Organize events by paranormal categories for easier filtering.
- **Real-time Updates**: View the latest supernatural happenings in a magical feed.
- **Responsive Design**: Enchanting experience on all devices.
- **View Transitions**: Smooth, mystical page transitions using [`next-view-transitions`](https://www.npmjs.com/package/next-view-transitions).

---

## 🚀 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with the App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [Turso](https://turso.tech/) + [Drizzle ORM](https://orm.drizzle.team/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Image Generation**: [OpenAI DALL-E](https://openai.com/)
- **Image Storage**: [AWS S3](https://aws.amazon.com/s3/)
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com/)
- **View Transitions**: [`next-view-transitions`](https://www.npmjs.com/package/next-view-transitions)

---

## 🔮 Conceptual Direction

A playful fairy-tale world infused with paranormal elements. The design combines tongue-in-cheek humor with dreamy magical visuals.

**Color Scheme**

- **Primary:** Deep purples, midnight blues, and starry blacks for a mystical night-sky environment.
- **Accent:** Neon greens, glowing whites, and pale pinks to highlight ghostly apparitions.

**Typography**

- **Primary Font:** A whimsical, slightly quirky serif that evokes magical texts.
- **Secondary Font:** A clean, playful sans-serif for readability.

**Visual Motifs**

- Subtle ghostly shapes drifting in the background.
- Sparkles, wisps of magic, and curling smoke for a mysterious feel.

---

## ✨ Key Visual Elements

### Hero Section

- **Main Illustration**: A magical kitten casting spells with a tiny witch’s hat; the frightened chick peeks out from behind a stack of witchy spell books.
- **Animations**:
  - Soft glowing aura or floating particles around the kitten.
  - Occasional ghost drifting across the screen.
- **Tagline**: “Track the Spooky Shenanigans of Your Magical Kitten!”
- **CTA**: A whimsical button (e.g., “Begin Your Paranormal Log”) leading to sign-up or login.

### Latest Events Section

- **Layout**: Carousel or grid of “Latest Paranormal Occurrences.”
- **Card Hover Effects**: Subtle bobbing or glowing edges.
- **Transitions**: Fade-ins and ghost-like silhouettes as the user scrolls.

### Add a New Log Page

- **Form Design**: Whimsical, parchment-textured background.
- **Fun Placeholders**: e.g., “What magical mischief occurred at the stroke of midnight?”
- **Animated Elements**: A quill pen icon might sparkle on input focus.

### Stats Page

- **Visuals**: Arcane “statistics” area with charts resembling cauldrons or crystal balls.
- **Animations**: Bars fill up like glowing liquid; spectral orbs for pie charts.
- **Data Headings**: “Ghostly Encounters,” “Witching Hours,” “Magical Mishaps,” etc.

---

## 🏰 User Experience Notes

- **Navigation**:
  - A whimsical top bar with playful hover states—icons with cat paws or crystals that glow on hover.
- **Micro-Interactions**:
  - Subtle sparkles when buttons are clicked.
  - Smooth transitions and gently animated elements.
- **Branding Through Imagery**:
  - Consistent appearance of the magical kitten and frightened chick throughout the app (peeking behind charts, looking nervous during event log submissions).

---

## 🛠️ Development

1. **Clone the repository**:

```bash
git clone https://github.com/yourusername/purranormal-activity.git
```

2. Install dependencies:

```bash
pnpm install
```

3. Copy `.env.example` to `.env` and fill in your environment variables:

```bash
cp .env.example .env
```

4. Start the development server:

```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser.

## 🎨 Design Philosophy

The application features a mystical and enchanting design with:

- Deep purples and midnight blues for a mystical atmosphere
- Playful animations and transitions
- Responsive and mobile-first approach
- Accessibility considerations
- Server-side rendering for optimal performance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- Special thanks to the Next.js team for the amazing framework
- OpenAI for the image generation capabilities
- The open-source community for all the wonderful tools

---

Made with ❤️ and a sprinkle of magic ✨
