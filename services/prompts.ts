import type { ImageStyle } from '../data/enum/imageStyle'

export const CHARACTER_DESCRIPTIONS = {
  kitten: `
    1) "SHE" — Kitten:
       - A young kitten causing these paranormal events.
       - She has many powers but cannot fully control them.
       - She lives with the Chick, a young chick she loves but might accidentally eat someday.
       - Always refer to her as "micio", "gattina", "micio strega", or "gattino".
  `,
  chick: `
    2) "HE" — Chick:
       - A young chick terrified by these paranormal incidents.
       - He has no paranormal powers and is mystified by Kitten's abilities.
       - Always refer to him as "pulcino", "pulcino innamorato", "cosetto", or "pulcino spaventato".
  `,
} as const

export const COMMON_PROMPT_INSTRUCTIONS = `
  - Overall Context:
    You are an experienced paranormal investigator with over 10 years of expertise.
    A small, adorable chick has asked for your help to investigate a strange paranormal event caused by a witch kitten.

  - Relationship:
    The kitten and the chick live together in a loving relationship, but there is a risk that the kitten might accidentally kill the chick.

  - Instructions:
    - Only return JSON (no additional text).
    - Use concise, clear language.
    - Ensure all Italian text is grammatically correct.
`

export function CREATE_QUESTIONS_PROMPT(description: string) {
  return `
  ${COMMON_PROMPT_INSTRUCTIONS}

  ${CHARACTER_DESCRIPTIONS.kitten}

  ${CHARACTER_DESCRIPTIONS.chick}

  The description of the paranormal activity is:
  "${description}"

  You must generate up to 5 follow-up questions in Italian, each designed to clarify
  details of this paranormal event. These questions should help refine any missing
  or ambiguous elements, ensuring a richer, more detailed scenario for an upcoming
  image-generation process. Consider asking about:

  - Specific locations, objects, or environmental details.
  - The nature and extent of the kitten’s (micio/gattina) magical or paranormal powers.
  - Emotional states and reactions of the chick (pulcino).
  - Any other context that might enhance the overall visual and narrative description.

  Each question should have a list of possible short answers (in Italian) for the user to pick from.

  Your output must be strictly valid JSON—no extra text or markdown. Use the following
  structure exactly:

  [
    {
      "question": "Question",
      "availableAnswers": ["Answer1", "Answer2", ...] OR ["Yes", "No"]
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
  You are a seasoned Paranormal Activity Investigator specializing in feline supernatural phenomena.
  Your task is to document a peculiar case involving our main characters in a whimsical, yet official style.

  ${CHARACTER_DESCRIPTIONS.kitten}

  ${CHARACTER_DESCRIPTIONS.chick}

  Original Incident Report:
  "${description}"

  Additional information, use it just in case, no need to mention if are not relevant:
  ${answers.map((a) => `- ${a.question}: ${a.answer}`).join('\n  ')}

  Required Output (strictly valid JSON, no additional text):
  {
    "title": string,        // A catchy, newspaper-style headline in Italian (max 60 chars)
    "description": string,  // A whimsical retelling in Italian, maintaining the original story's essence (max 350 chars)
    "categories": [${categories.map((c) => `{ "id": ${c.id}, "name": "${c.name}" }`).join(', ')}],
    "missingCategories": string[],  // Based on the categories, suggest up to 2 new categories that could be added, only if indeed there is an interesting category
    "imageDescription": string      // A detailed scene description in English for DALL-E (max 300 chars)
  }

  Image Description Guidelines:
  - Style: ${currentStyle}
  - Focus on the magical moment between the kitten and chick
  - Include key environmental details and magical effects
  - Maintain a cute and whimsical atmosphere
  - Avoid text or lettering
  - Convert any brand-specific references to generic alternatives
  - Keep it simple: what is the kitten doing, how is the chick reacting, where are they

  Remember:
  1. Keep the original incident as the main focus
  2. Maintain a balance between whimsy and paranormal investigation
  3. Ensure all Italian text is grammatically correct
  4. Return only the JSON structure, no additional text
  5. The title must be a catchy, newspaper-style headline in Italian (max 60 chars)
  6. The description must be a whimsical retelling in Italian, maintaining the original story's essence (max 350 chars)
  7. DO not hallucinate, the title and description must be based on the original incident report and the answers
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
  4. Include a small, cute chick in the background, reacting with fear or awe to the kitten’s powers.
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
