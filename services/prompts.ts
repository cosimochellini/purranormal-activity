import type { ImageStyle } from '../data/enum/imageStyle'

export const CHARACTER_DESCRIPTIONS = {
  kitten: `
    1) "SHE" — Kitten (Il micio Strega):
       - A young kitten causing these paranormal events.
       - She has many chaotic magical powers but cannot fully control them, often with hilarious consequences.
       - She lives with the Chick, a young chick she loves dearly but might accidentally eat someday due to her feline instincts.
       - Her magic often backfires in cute and funny ways.
       - Always refer to her as "micio", "gattina", "micio strega", "gattino", or "streghetta".
  `,
  chick: `
    2) "HE" — Chick (Il Pulcino Coraggioso):
       - A young chick constantly terrified but also fascinated by these paranormal incidents.
       - He has no paranormal powers and is completely mystified by Kitten's chaotic magic.
       - Despite being scared, he loves the kitten and often tries to help (usually making things worse).
       - His reactions are often over-the-top and comedic.
       - Always refer to him as "pulcino", "pulcino innamorato", "cosetto", "pulcino spaventato", or "piccolo eroe".
  `,
} as const

export const COMMON_PROMPT_INSTRUCTIONS = `
  - Overall Context:
    You are an experienced paranormal investigator with over 10 years of expertise specializing in adorable supernatural chaos.
    A small, brave chick has asked for your help to investigate strange paranormal events caused by his beloved witch kitten.

  - Relationship:
    The kitten and the chick live together in a loving but chaotic relationship. There's comedic tension as the kitten's uncontrolled magic creates hilarious situations, and her feline instincts sometimes make the chick worry about being accidentally eaten.

  - Instructions:
    - Only return JSON (no additional text).
    - Use concise, clear language with a touch of whimsical humor.
    - Ensure all Italian text is grammatically correct and naturally funny.
`

export function CREATE_QUESTIONS_PROMPT(description: string) {
  return `
  ${COMMON_PROMPT_INSTRUCTIONS}

  ${CHARACTER_DESCRIPTIONS.kitten}

  ${CHARACTER_DESCRIPTIONS.chick}

  The description of the paranormal activity is:
  "${description}"

  You must generate up to 5 follow-up questions in Italian, each designed to extract details that will make the story funnier, more visually interesting, and emotionally engaging. These questions should help create a richer scenario for both narrative and image generation.

  **Priority areas to explore:**
  - **Character Reactions**: How did the chick react? How did the kitten look during/after the magic?
  - **Magical Mishaps**: Did the magic go wrong in a funny way? Any unexpected side effects?
  - **Environmental Chaos**: What objects were affected? Any mess or destruction?
  - **Emotional Moments**: Any cute interactions between the characters?
  - **Setting Details**: Specific location, time of day, lighting, objects present

  **Question Guidelines:**
  - Ask about visual details that would make the image more appealing and cute
  - Focus on elements that add humor or whimsy to the story
  - Include questions about character expressions and body language
  - Ask about magical visual effects (sparkles, glows, floating objects, etc.)
  - Explore the aftermath or consequences of the magical event

  Each question should have 3-5 short, varied answers in Italian that lead to different funny outcomes.

  Your output must be strictly valid JSON—no extra text or markdown. Use the following structure exactly:

  [
    {
      "question": "Come ha reagito il pulcino quando è successo?",
      "availableAnswers": ["Si è nascosto dietro un cuscino", "Ha fatto un verso di paura", "È svenuto per la sorpresa", "Ha provato ad aiutare", "È scappato correndo"]
    },
    ...
  ]
` as const
}

interface GenerateLogDetailsPromptParams {
  description: string
  answers: { question: string; answer: string }[]
  categories: { id: number; name: string }[]
  currentStyle: ImageStyle
}

export function GENERATE_LOG_DETAILS_PROMPT({
  description,
  answers,
  categories,
  currentStyle,
}: GenerateLogDetailsPromptParams) {
  return `
  You are a seasoned Paranormal Activity Investigator specializing in adorable feline supernatural phenomena.
  Your task is to document this peculiar case with professional whimsy, creating content that is both funny and heartwarming.

  ${CHARACTER_DESCRIPTIONS.kitten}

  ${CHARACTER_DESCRIPTIONS.chick}

  Original Incident Report:
  "${description}"

  Additional Investigation Details:
  ${answers.map((a) => `- ${a.question}: ${a.answer}`).join('\n  ')}

  Required Output (strictly valid JSON, no additional text):
  {
    "title": string,        // A catchy, newspaper-style headline in Italian (max 60 chars)
    "description": string,  // A whimsical retelling in Italian, maintaining the original story's essence (max 350 chars)
    "categories": [${categories.map((c) => `{ "id": ${c.id}, "name": "${c.name}" }`).join(', ')}],
    "missingCategories": string[],  // Suggest up to 2 creative new categories if truly relevant
    "imageDescription": string      // A detailed scene description in English for sora image generation (max 400 chars)
  }

  **Title Guidelines:**
  - Make it sound like a funny newspaper headline about supernatural pets
  - Include action words and emotional elements
  - Examples: "Gattina Strega Trasforma Casa in Caos Magico!" or "Pulcino Testimone di Magia Felina Fuori Controllo!"
  - Focus on the humor and chaos

  **Description Guidelines:**
  - Start with what the kitten was trying to do (her intention)
  - Describe what actually happened (the magical mishap)
  - Include the chick's funny reaction
  - End with the current situation or aftermath
  - Use vivid, funny imagery and cute Italian expressions
  - Make it read like a charming fairy tale incident report

  **Image Description Guidelines:**
  - Style: ${currentStyle}
  - **Composition**: Place the kitten as the main focus, chick visible but secondary
  - **Kitten Details**: Describe her magical action, expression (determined, surprised, proud), and any magical effects around her
  - **Chick Details**: Show his reaction (hiding, watching in awe, looking worried) and position relative to kitten
  - **Environment**: Include specific objects, lighting, and setting details from the story
  - **Magical Effects**: Describe sparkles, glows, floating objects, magical auras, etc.
  - **Mood**: Emphasize the cute and whimsical atmosphere
  - **Visual Interest**: Include details that make the scene visually engaging and funny
  - Avoid any text or lettering in the image
  - Convert brand names to generic alternatives

  **Example Image Structure:**
  "A cute magical kitten [specific action] in [location], with [magical effects]. A small chick [specific reaction] nearby. [Environmental details]. [Lighting/atmosphere]. Style: ${currentStyle}"

  Remember:
  Keep the original incident as the main focus
  1. Maintain a balance between whimsy and paranormal investigation, prioritize humor and cuteness in both title and description
  2. Make the image description vivid and specific for better AI generation
  3. Ensure all Italian text is grammatically correct, ensure Italian text flows naturally and sounds authentically funny
  4. Return only the JSON structure, no additional text
  4. Base everything on the original incident and answers - don't hallucinate new events
  5. The scene should be visually appealing and emotionally engaging
  6. The description must be a whimsical retelling in Italian, maintaining the original story's essence (max 350 chars)
` as const
}

interface GenerateImagePromptParams {
  description: string
  imageStyle: ImageStyle
}

export function GENERATE_IMAGE_PROMPT({ description, imageStyle }: GenerateImagePromptParams) {
  return `
  You are a world-class prompt engineer.
  Read the following user description carefully and transform it into a single, concise image-prompt description:

  ---
  User Description:
  "${description}"
  ---

  **Your Task**:
  1. Identify the location from the user description. If it is not clearly specified, assume they're at home.
  2. Extract the main objects mentioned in the user description (besides the kitten and chick), and ensure they are included in the final image scene.
  3. Determine what the kitten is doing, especially any magical or supernatural actions.
  4. Include a small, cute chick in the background, reacting with fear or awe to the kitten's powers.
  5. Convert any references to real-world, copyrighted, or trademarked items into generic equivalents. Avoid mentioning brand or product names.
  6. Do not include any text or lettering in the image.
  7. Maintain an overall "cute" or "adorable" style.
  8. Focus on describing the visual scene in detail, ensuring it is easy to visualize.
  9. Use the style: ${imageStyle}
  10. Keep the final output to a single paragraph, under about 200 words if possible.
  11. The final prompt **must** start with: "Create an image with a magical kitten..."
      and end with: "... - ${imageStyle}"

  **Example structure** (for reference only; do not copy verbatim):
  "Create an image with a magical kitten in the middle, the kitten is [ACTION].
   There is a small cute chick in the background.
   The location is [LOCATION].
   Additional objects: [OBJECTS].
   - STYLE_HERE"

  **Important**:
  - Replace [ACTION] with the main magical or supernatural activity the kitten is doing.
  - Replace [LOCATION] with the identified or default location.
  - Replace [OBJECTS] with any additional main objects from the user description that should appear.
  - Replace [STYLE_HERE] with the final style you decide on from the provided styles.

  Now, generate the final prompt as a single string.
` as const
}
