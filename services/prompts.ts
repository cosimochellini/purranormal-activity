// cspell:disable
import { APP_URL } from '@/env/public'
import { ARRAY_LIMITS, CHARACTER_LIMITS } from '../constants'
import type { ImageStyle } from '../data/enum/imageStyle'
import type { LogWithCategories } from '../db/schema'

interface AnswerOutput {
  question: string
  answer: string
}

export const CHARACTER_DESCRIPTIONS = {
  kitten: `
    1) "LEI" — Micio Strega:
       - Una giovane gattina nera con cappello viola e occhi verdi ipnotici che causa questi eventi paranormali.
       - Ha molti poteri magici sovrannaturali ma non riesce a controllarli completamente, spesso con conseguenze buffe.
       - Vive con il Pulcino, un piccolo pulcino giallo che ama teneramente ma che potrebbe accidentalmente mangiare un giorno a causa dei suoi istinti felini.
       - Chiamala sempre "micio", "micietto", "streghetta", "micio strega", o "piccola maga".
  `,
  chick: `
    2) "LUI" — Il Pulcino Coraggioso:
       - Un piccolo pulcino giallo costantemente terrorizzato ma anche affascinato da questi eventi paranormali.
       - Non ha poteri paranormali ed è completamente ammaliato e spaventato dalla magia caotica del Micio.
       - Nonostante sia spaventato, ama la gattina con tutto il cuore e cerca sempre di aiutarla (di solito peggiorando le cose).
       - Le sue reazioni sono spesso esagerate e adorabili.
       - Chiamalo sempre "pulcino", "cosetto", "sbriciolato", "fagiolino" o "pulcino coraggioso".
  `,
} as const

export const COMMON_PROMPT_INSTRUCTIONS = `
  - Contesto Generale:
    Sei un investigatore paranormale esperto con oltre 30 anni di esperienza specializzato nel fenomeni soprannaturali, magici e felini.
    Un piccolo pulcino coraggioso ti ha chiesto aiuto per investigare strani eventi paranormali causati dalla sua amata gattina strega.

  - Relazione:
    Il micio e il pulcino vivono insieme in una relazione amorevole, buffa e caotica.
    Il pulcino è spesso spaventato dalla magia incontrollata della gattina, ma cerca sempre di aiutarla.

  - Istruzioni:
    - Usa un linguaggio conciso e chiaro con un tocco di umorismo stravagante e dolce.
    - Se presenti nella descrizione del pulcino, includi riferimenti specifici a luoghi, negozi o serie TV per rendere la storia più vivida.
`

export function CREATE_QUESTIONS_PROMPT(description: string) {
  return `
  ${COMMON_PROMPT_INSTRUCTIONS}

  ${CHARACTER_DESCRIPTIONS.kitten}

  ${CHARACTER_DESCRIPTIONS.chick}

  La descrizione del pulcino dell'attività paranormale è:
  "${description}"

  Devi generare FINO a ${ARRAY_LIMITS.MAX_QUESTIONS} domande di follow-up in italiano per raccogliere dettagli visivi e narrativi utili.

  Priorità:
  1. Reazione emotiva e fisica del pulcino.
  2. Azione magica specifica del micio e suoi effetti collaterali.
  3. Luogo preciso, oggetti coinvolti, illuminazione e momento della giornata.

  Requisiti di qualità:
  - Domande brevi, concrete e non ridondanti.
  - Evita domande troppo generiche o sì/no.
  - Ogni domanda deve avere risposte mutualmente distinguibili.
  - Le risposte devono essere brevi, naturali e visuali.
  - Non includere brand o personaggi coperti da copyright nelle risposte.

  Vincoli:
  - MAX ${CHARACTER_LIMITS.QUESTION} caratteri per domanda
  - Da 2 a ${ARRAY_LIMITS.MAX_ANSWERS} risposte per domanda
  - MAX ${CHARACTER_LIMITS.ANSWER} caratteri per risposta

  Restituisci SOLO JSON valido (niente markdown, niente testo extra) in questo formato:
  [
    {
      "question": "string",
      "availableAnswers": ["string", "string"]
    }
  ]
` as const
}

interface GenerateLogDetailsPromptParams {
  description: string
  answers: AnswerOutput[]
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
  ${COMMON_PROMPT_INSTRUCTIONS}

  ${CHARACTER_DESCRIPTIONS.kitten}

  ${CHARACTER_DESCRIPTIONS.chick}

  La descrizione del pulcino dell'attività paranormale è:
  "${description}"

  Il tuo assistente, indagando nella storia, ha ottenuto le seguenti risposte:
  ${answers.map((a) => `- ${a.question}: ${a.answer}`).join('\n  ')}

  Categorie Disponibili:
  ${categories.map((c) => `{ "id": ${c.id}, "name": "${c.name}" }`).join(', ')}

  Obiettivo:
  Genera una versione rifinita dell'evento utile sia alla lettura che alla generazione immagine.

  Regole importanti:
  - Non inventare eventi non supportati dai dati ricevuti.
  - Mantieni il tono giocoso/misterioso, senza contenuti espliciti.
  - I riferimenti specifici (luoghi/negozi/serie) vanno mantenuti in titolo/descrizione se presenti nei dati.
  - Nel campo imageDescription usa equivalenti generici al posto di brand/IP protetti.

  Output richiesto (RIGOROSAMENTE JSON valido, nessun testo aggiuntivo):
  {
    "title": "string",
    "description": "string",
    "categories": [{ "id": 1 }],
    "missingCategories": ["string"],
    "imageDescription": "string"
  }

  Vincoli campi:
  - "title": italiano, max ${CHARACTER_LIMITS.GENERATED_TITLE} caratteri, dinamico e giornalistico.
  - "description": italiano, max ${CHARACTER_LIMITS.GENERATED_DESCRIPTION} caratteri.
  - "categories": scegli SOLO id presenti in Categorie Disponibili, max ${ARRAY_LIMITS.MAX_CATEGORIES}, senza duplicati.
  - "missingCategories": max ${ARRAY_LIMITS.MAX_CATEGORIES}, solo nomi sintetici per categorie utili ma assenti.
  - "imageDescription": deve essere in INGLESE, in un solo paragrafo, visivo e pronto per un modello text-to-image.

  Linee guida per imageDescription:
  - Soggetto principale: black kitten with a purple witch hat and bright green eyes.
  - Soggetto secondario: small yellow chick visibly reacting.
  - Specifica azione magica, ambientazione, ora del giorno, composizione, illuminazione, atmosfera.
  - Includi dettagli utili (props, motion cues, magical effects) senza essere prolisso.
  - Vietato: testo nell'immagine, watermark, logo, brand names, gore, contenuti espliciti.
  - Chiudi con: "Style: ${currentStyle}".
  - Target lunghezza: circa ${CHARACTER_LIMITS.IMAGE_PROMPT} caratteri.

  Restituisci SOLO JSON valido.

` as const
}

interface GenerateImagePromptParams {
  description: string
  imageStyle: ImageStyle
}

export function GENERATE_IMAGE_PROMPT({ description, imageStyle }: GenerateImagePromptParams) {
  return `
  Sei un prompt engineer specializzato in text-to-image.
  Trasforma la descrizione in un prompt immagine ad alta resa visiva, in inglese.

  ---
  Descrizione Utente:
  "${description}"
  ---

  Requisiti:
  1. Se il luogo non è chiaro, assumi un ambiente domestico.
  2. Includi SEMPRE:
     - "black kitten with a purple witch hat and bright green eyes"
     - "small yellow chick"
  3. Rendi la gattina il soggetto principale e il pulcino chiaramente visibile come soggetto secondario.
  4. Descrivi azione magica, composizione, inquadratura, illuminazione, atmosfera e oggetti utili.
  5. Converti brand/IP/copyright in equivalenti generici.
  6. Escludi testo, watermark, logo, gore, contenuti espliciti.
  7. Mantieni tono cute + paranormal + whimsical.
  8. Un solo paragrafo, target circa ${CHARACTER_LIMITS.IMAGE_PROMPT} caratteri.
  9. Termina con: "Style: ${imageStyle}".

  Restituisci solo la stringa finale del prompt.
` as const
}

interface GenerateTelegramPromptParams {
  log: LogWithCategories
}

export function GENERATE_TELEGRAM_PROMPT({ log }: GenerateTelegramPromptParams) {
  const linkURL = `${APP_URL}/${log.id}`

  return `
  ${COMMON_PROMPT_INSTRUCTIONS}

  ${CHARACTER_DESCRIPTIONS.kitten}

  ${CHARACTER_DESCRIPTIONS.chick}

  Hai già individuato e categorizzato la seguente attività paranormale:
  JSON: ${JSON.stringify(log)}

  Il tuo scopo è generare un messaggio catchphrase per un evento paranormale da pubblicare come messaggio su Telegram.
  Devi invogliare i lettori a cliccare il link per leggere la storia completa, lasciando un alone di mistero.

  FORMATO RICHIESTO: HTML di Telegram

  REGOLE CRITICHE PER HTML:
  <b>bold</b>, <strong>bold</strong>
<i>italic</i>, <em>italic</em>
<u>underline</u>, <ins>underline</ins>
<s>strikethrough</s>, <strike>strikethrough</strike>, <del>strikethrough</del>
<span class="tg-spoiler">spoiler</span>, <tg-spoiler>spoiler</tg-spoiler>
<b>bold <i>italic bold <s>italic bold strikethrough <span class="tg-spoiler">italic bold strikethrough spoiler</span></s> <u>underline italic bold</u></i> bold</b>
<a href="http://www.example.com/">inline URL</a>
<tg-emoji emoji-id="5368324170671202286">👍</tg-emoji>


  CONTENUTO RICHIESTO:
  - Il messaggio deve essere in italiano
  - Il messaggio deve sempre iniziare con #DAY ${log.id * 2}
  - Il messaggio deve essere RIGOROSAMENTE HTML, seguendo strettamente le regole HTML di Telegram, nessun testo aggiuntivo, pronto per essere inviato su Telegram tramite API.
  - Titolo all'inizio del messaggio accattivante in grassetto con emoji collegate all'evento
  - La descrizione dopo il titolo deve essere breve e misteriosa (max ${CHARACTER_LIMITS.TELEGRAM_DESCRIPTION} caratteri)
  - Link al dettaglio con testo invitante e clickbait, suscitando pena, curiosità e empatia per il pulcino (max ${CHARACTER_LIMITS.TELEGRAM_LINK} caratteri)
  - Il link deve essere: ${linkURL}
  - Tono giocoso ma misterioso, perfetto per social media

  ` as const
}
