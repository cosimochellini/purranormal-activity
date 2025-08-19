// cspell:disable
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
    La micio e il pulcino vivono insieme in una relazione amorevole ma caotica.
    C'è tensione (anche sessuale) perché la magia incontrollata della gattina crea situazioni complicate,
    e i suoi istinti felini a volte fanno preoccupare il pulcino di essere accidentalmente mangiato.

  - Istruzioni:
    - Usa un linguaggio conciso e chiaro con un tocco di umorismo stravagante e dolce.
    - Includi riferimenti specifici a luoghi, negozi, o serie TV, presenti nella descrizione del pulcino, per rendere la storia più vivida e riconoscibile.
`

export function CREATE_QUESTIONS_PROMPT(description: string) {
  return `
  ${COMMON_PROMPT_INSTRUCTIONS}

  ${CHARACTER_DESCRIPTIONS.kitten}

  ${CHARACTER_DESCRIPTIONS.chick}

  La descrizione del pulcino dell'attività paranormale è:
  "${description}"

  Devi generare FINO a 5 domande di follow-up in italiano, ognuna progettata per estrarre dettagli che arricchiranno la storia,
   rendendola più completa, più chiara visualmente e coinvolgente.
   Queste domande dovrebbero aiutare a creare uno scenario più ricco sia per la narrativa che per la generazione di immagini, tramite AI.

  **Aree prioritarie da esplorare:**
  - **Reazioni dei Personaggi**: Come ha reagito il pulcino? Come appariva la gattina durante/dopo la magia?
  - **Incidenti Magici**: La magia è andata storta in qualche modo? Ci sono stati effetti collaterali inaspettati?
  - **Dettagli dell'Ambientazione**: Posizione specifica, ora del giorno, illuminazione, oggetti presenti

  **Linee Guida per le Domande:**
  - Chiedi dettagli visivi che renderebbero l'immagine più chiara e carina
  - Includi domande sulle espressioni e il linguaggio del corpo dei personaggi
  - Esplora le conseguenze o gli effetti dell'evento magico


  Ogni domanda dovrebbe avere 3-5 risposte brevi e varie in italiano che portino ad avere una chiara generazione dell'immagine dell'accaduto.

  Il tuo output deve essere RIGOROSAMENTE JSON valido—nessun testo extra o markdown. Usa esattamente questa struttura:

  [
    {
      question: string, // MAX 90 caratteri
      availableAnswers: string[] // MAX 5 risposte, MAX 120 caratteri per risposta
    },
    ...
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

  Output Richiesto (RIGOROSAMENTE JSON valido, nessun testo aggiuntivo):
  {
    "title": string,        // Un titolo accattivante, stile giornalistico in italiano (max 60 caratteri)
    "description": string,  // Un racconto stravagante in italiano, mantenendo l'essenza della storia originale (max 550 caratteri)
    "categories": { "id": number, "name": string }[], // Seleziona le categorie più rilevanti dalla lista disponibile (massimo 4)
    "imageDescription": string      // Un prompt per generare l'immagine riassuntiva dell'accaduto, tramite AI
  }

  **Linee Guida per il Titolo:**
  - Rendilo come un titolo divertente e accattivante di giornale su animali domestici soprannaturali
  - Includi parole d'azione ed elementi emotivi
  - Esempi: "Micio trasforma casa in caos magico!" o "Cosetto testimone di magia felina!"

  **Linee Guida per la Descrizione:**
  - Inizia con quello che il micio stava cercando di fare (la sua intenzione)
  - Descrivi cosa è realmente successo (l'incidente magico)
  - Includi la reazione del pulcino
  - Termina con la situazione attuale o le conseguenze
  - Usa immagini vivide e divertenti ed espressioni italiane dolci
  - Fallo leggere come un rapporto di incidente da favola incantevole
  - Aggiungi sottili riferimenti per adulti che i bambini non capiranno ma che renderanno la storia più divertente per i genitori
  - IMPORTANTE: Includi i riferimenti specifici a luoghi, negozi, marchi, o serie TV menzionati nella descrizione del pulcino

  **Linee Guida per la Descrizione dell'Immagine:**
  - Stile: ${currentStyle}
  - Composizione: Metti la gattina come focus principale, pulcino visibile ma secondario
  - Dettagli della Gattina: Descrivi la sua azione magica, espressione (determinata, sorpresa, orgogliosa), e gli effetti magici intorno a lei. SEMPRE: gattina nera con cappello viola e occhi verdi
  - Dettagli del Pulcino: Mostra la sua reazione (nascondendosi, guardando con stupore, preoccupato) e posizione relativa alla gattina. SEMPRE: piccolo pulcino giallo
  - Ambiente: Includi oggetti specifici, illuminazione, e dettagli dell'ambientazione dalla storia
  - Atmosfera: Enfatizza l'atmosfera paranormale, carina e stravagante
  - Interesse Visivo: Includi dettagli che rendano la scena visivamente coinvolgente

  **Struttura Esempio Immagine:**
  "Una adorabile gattina magica nera con cappello viola e occhi verdi [azione specifica] in [luogo], con [effetti magici].
  Un piccolo pulcino giallo [reazione specifica] nelle vicinanze. [Dettagli ambientali]. [Illuminazione/atmosfera].

  Stile: ${currentStyle}"

  RICORDA SEMPRE:
  Mantieni l'incidente originale come focus principale
  - Mantieni un equilibrio tra stravaganza e investigazione paranormale, dai priorità all'umorismo e dolcezza in titolo e descrizione
  - Rendi la descrizione dell'immagine vivida e specifica per una migliore generazione AI
  - Assicurati che tutto il testo italiano sia grammaticalmente corretto e suoni autenticamente divertente
  - Restituisci SOLO la struttura JSON, nessun testo aggiuntivo
  - Basa tutto sull'incidente originale e le risposte (con minore importanza) - non inventare nuovi eventi
  - La scena dovrebbe essere visivamente attraente ed emotivamente coinvolgente
  - SEMPRE includi i dettagli fisici specifici: gattina nera con cappello viola e occhi verdi, pulcino piccolo e giallo

` as const
}

interface GenerateImagePromptParams {
  description: string
  imageStyle: ImageStyle
}

export function GENERATE_IMAGE_PROMPT({ description, imageStyle }: GenerateImagePromptParams) {
  return `
  Sei un ingegnere di prompt di livello mondiale.
  Leggi attentamente la seguente descrizione dell'utente e trasformala in una singola, concisa descrizione per il prompt dell'immagine:

  ---
  Descrizione Utente:
  "${description}"
  ---

  **Il Tuo Compito**:
  1. Identifica la posizione dalla descrizione dell'utente. Se non è chiaramente specificata, assumi che siano a casa.
  2. Estrai gli oggetti principali menzionati nella descrizione dell'utente (oltre alla gattina e al pulcino), e assicurati che siano inclusi nella scena finale dell'immagine.
  3. Determina cosa sta facendo la gattina, specialmente qualsiasi azione magica o soprannaturale.
  4. Includi un piccolo pulcino giallo carino sullo sfondo, che reagisce con paura o stupore ai poteri della gattina.
  5. Converti qualsiasi riferimento a oggetti del mondo reale, con copyright, o marchi registrati in equivalenti generici. Evita di menzionare nomi di brand o prodotti.
  6. Non includere testo o scritte nell'immagine.
  7. Mantieni uno stile generale "carino" o "adorabile".
  8. Concentrati nel descrivere la scena visiva in dettaglio, assicurandoti che sia facile da visualizzare.
  9. Usa lo stile: ${imageStyle}
  10. Mantieni l'output finale in un singolo paragrafo, sotto le 200 parole se possibile.
  11. Il prompt finale **deve** iniziare con: "Create un'immagine con un magico gattino nero con cappello viola e occhi verdi..."
      e finire con: "... - ${imageStyle}"

  **Struttura esempio** (solo per riferimento; non copiare letteralmente):
  "Creare un'immagine con un magico gattino nero con cappello viola e occhi verdi al centro, il gattino è [AZIONE].
   Sullo sfondo c'è un piccolo pulcino giallo.
   Il luogo è [LOCATION].
   Oggetti aggiuntivi: [OGGETTI].
   - STILE_QUI

  **Importante**:
  - Sostituisci [ACTION] con la principale attività magica o soprannaturale che sta facendo la gattina.
  - Sostituisci [LOCATION] con la posizione identificata o predefinita.
  - Sostituisci [OBJECTS] con qualsiasi oggetto principale aggiuntivo dalla descrizione dell'utente che dovrebbe apparire.
  - Sostituisci [STYLE_HERE] con lo stile finale che decidi tra quelli forniti.
  - SEMPRE includi: gattina nera con cappello viola e occhi verdi, pulcino piccolo e giallo.

  Ora, genera il prompt finale come una singola stringa.
` as const
}

interface GenerateTelegramPromptParams {
  log: LogWithCategories
}

export function GENERATE_TELEGRAM_PROMPT({ log }: GenerateTelegramPromptParams) {
  const linkURL = `https://purranormal-activity.pages.dev/${log.id}`

  return `
  ${COMMON_PROMPT_INSTRUCTIONS}

  ${CHARACTER_DESCRIPTIONS.kitten}

  ${CHARACTER_DESCRIPTIONS.chick}

  Hai già indivituato e categorizzato la seguente attività paranormale:
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
<a href="tg://user?id=123456789">inline mention of a user</a>
<tg-emoji emoji-id="5368324170671202286">👍</tg-emoji>
<code>inline fixed-width code</code>
<pre>pre-formatted fixed-width code block</pre>
<pre><code class="language-python">pre-formatted fixed-width code block written in the Python programming language</code></pre>
<blockquote>Block quotation started\nBlock quotation continued\nThe last line of the block quotation</blockquote>
<blockquote expandable>Expandable block quotation started\nExpandable block quotation continued\nExpandable block quotation continued\nHidden by default part of the block quotation started\nExpandable block quotation continued\nThe last line of the block quotation</blockquote>


  CONTENUTO RICHIESTO:
  - Il messaggio deve essere in italiano
  - Il messaggio deve essere RIGOROSAMENTE HTML, seguendo strettamente le regole HTML di Telegram, nessun testo aggiuntivo, pronto per essere inviato su Telegram tramite API.
  - Titolo all'inizio del messaggio accattivante in grassetto con emoji collegate all'evento
  - La descrizione dopo il titolo deve essere breve e misteriosa (max 500 caratteri)
  - Link al dettaglio con testo invitante e clickbait, suscitando pena, curiosità e empatia per il pulcino (max 100 caratteri)
  - Il link deve essere: ${linkURL}
  - Tono giocoso ma misterioso, perfetto per social media

  ` as const
}
