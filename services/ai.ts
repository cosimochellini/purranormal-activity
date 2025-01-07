import { Categories } from '../data/enum/category'
import { openai } from '../instances/openai'
import { logger } from '../utils/logger'
import { typedObjectValues } from '../utils/typed'

const styles = [
  'bitmap style',
  '8bit style',
  'video game retro style',
  'cartoon style',
] as const

const randomStyle = () => styles[Math.floor(Math.random() * styles.length)]

export async function createQuestions(description: string) {
  const content = `
      You are a Ghostbuster with over 10 years of experience.
      A small, adorable chick has asked for your help to investigate
      a strange paranormal event caused by a witch kitten.

      The main characters are:
      1) "SHE" — Kitty:
         - A young kitten causing these paranormal events.
         - She has many powers but cannot fully control them.
         - She lives with the Chick, a young chick she loves but might accidentally eat someday.
         - Always refer to her as "micio", "gattina", "micio strega", or "gattino".

      2) "HE" — Chick:
         - A young chick terrified by these paranormal incidents.
         - He has no paranormal powers and is mystified by Kitty's abilities.
         - Always refer to him as "pulcino", "pulcino innamorato", "cosetto", or "pulcino spaventato".

      The kitten and the chick live together in a loving relationship,
      but there is a risk that the kitten might accidentally kill the chick.

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
          "question": "Domanda",
          "availableAnswers": ["Risposta1", "Risposta2", ...] OR ["Si", "No"]
        },
        ...
      ]

      Remember:
      1. Only return JSON (no additional text).
      2. Use concise, clear language for both questions and answer options.
      3. Provide a maximum of 5 questions.
    ` as const

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content },
    ],
    stream: false,
  })

  const parsedContent = JSON.parse(completion.choices[0]?.message?.content || '[]')
  return parsedContent as { question: string, availableAnswers: string[] }[]
}

export async function generateLogDetails(description: string, answers: { question: string, answer: string }[]) {
  const content = `
      You are an experienced Ghostbuster with more than 10 years of service.
      Your task is to craft an official log entry **in Italian**, focusing primarily on rewriting the original description in a polished, narrative style.
      Incorporate minimal elements from the extra answers, but ensure the **original description remains the main foundation** of the story.

      1) "SHE" — Kitty ("micio", "gattina", "micio strega", "gattino"):
         - Main cause of paranormal events
         - Many powers, not fully controlled
         - Lives with the Chick, though could accidentally eat him

      2) "HE" — Chick ("pulcino", "pulcino innamorato", "cosetto", "pulcino spaventato"):
         - Frightened by these paranormal events
         - No paranormal powers
         - Lives in a loving yet risky relationship with Kitty

      **Important**:
      - The final result should be **mostly a refined version of the original description**:
        Keep the spirit and details from "${description}" as the dominant content.
      - Briefly weave in insights from the extra answers only if they enhance the core description:
        ${answers.map(a => `- ${a.question}: ${a.answer}`).join('\n      ')}

        Also, provide an "imageDescription" in **English** (up to 300 characters),
        which will be used for generating a visual scene:
        - This field should describe the most crucial visual elements, focusing on the kitten’s powers,
            the chick’s reactions, and any important environmental details.
        - Make sure it is consistent with the Italian text above, but keep it strictly in English.
        - Make it ${randomStyle()}
        - Do not include any text or lettering in the image.
        - Maintain an overall "cute" or "adorable" style.
        - Keep the final output to a single paragraph, under about 200 words if possible.
        - Convert any references to real-world, copyrighted, or trademarked items into generic equivalents. Avoid mentioning brand or product names.

      **Required JSON** (strictly valid, no extra text, no markdown) with exactly these keys:
      {
        "title": string,        // up to 60 characters, in Italian (catchy newspaper-style headline)
        "description": string,  // up to 350 characters, in Italian (refined rewrite of original description)
        "categories": [${typedObjectValues(Categories).join(', ')}], // valid categories from your enum
        "imageDescription": string  // up to 300 characters, in English (8bit/pixel-art style scene)
      }

      Remember: **No additional text or keys**. Only return this JSON structure.
    ` as const

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
    // other OpenAI parameters as needed
  })

  const rawContent = completion.choices[0]?.message?.content || '{}'
  return JSON.parse(rawContent) as {
    title: string
    description: string
    categories: string[]
    imageDescription: string
  }
}

export async function generateImage(imagePrompt: string) {
  try {
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
    })

    const imageData = imageResponse.data[0]?.url

    if (!imageData)
      throw new Error('Failed to generate image data')

    return imageData
  }
  catch (error) {
    logger.error('Error generating image:', error)

    throw new Error('Image generation failed')
  }
}

export async function generateImagePrompt(description: string) {
  try {
    const content = `
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
            9. Use the style: ${randomStyle()}
            10. Keep the final output to a single paragraph, under about 200 words if possible.
            11. The final prompt **must** start with: "Create an image with a magical kitten..."
                and end with: "... - STYLE_HERE"

            **Example structure** (for reference only; do not copy verbatim):
            "Create an image with a magical kitten in the middle, the kitten is [ACTION].
             There is a small cute chick in the background.
             The location is [LOCATION].
             Additional objects: [OBJECTS].
             - [STYLE_HERE]"

            **Important**:
            - Replace [ACTION] with the main magical or supernatural activity the kitten is doing.
            - Replace [LOCATION] with the identified or default location.
            - Replace [OBJECTS] with any additional main objects from the user description that should appear.
            - Replace [STYLE_HERE] with the final style you decide on from the provided styles.

            Now, generate the final prompt as a single string.
          ` as const

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content }],
      // Optionally, you could add temperature, max_tokens, etc.:
      // temperature: 0.7,
      // max_tokens: 200,
    })

    const ret = completion.choices[0]?.message?.content

    if (!ret) {
      throw new Error('Failed to generate image prompt')
    }

    return ret
  }
  catch (error) {
    logger.error('Error generating image prompt:', error)
    throw new Error('Image prompt generation failed')
  }
}
