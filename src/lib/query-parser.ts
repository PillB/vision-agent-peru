/**
 * Natural-Language Query Parser — Round 3
 *
 * Parses free-text queries (Spanish or English) into structured filter
 * fields for the evidence search pipeline.
 *
 * Implements section 15 of the Solarize system prompt:
 *   - Parse queries into transparent fields
 *   - Show recognized/ignored/unsupported terms
 *   - Reject or remove searches based on sensitive attributes
 *   - Return a clear explanation rather than silently transforming
 *
 * Example:
 *   "persona con casaca azul, mochila roja, caminando hacia la salida después de las 8 pm"
 *
 * Becomes:
 *   objectType: person
 *   upperClothing: jacket
 *   upperColor: blue
 *   carriedObject: backpack
 *   objectColor: red
 *   directionTarget: exit
 *   timeStart: 20:00
 *
 * Sensitive-term rejection (section 3):
 *   race, ethnicity, religion, disability, medical status, political views,
 *   socioeconomic status, emotion, subjective criminality — these are
 *   REJECTED with a clear explanation, not silently transformed.
 */

export interface ParsedQuery {
  raw: string
  objectType?: 'person' | 'vehicle' | 'object' | 'fire' | 'flood' | 'graffiti' | 'crack' | 'landslide'
  upperClothing?: string         // jacket, shirt, sweater, etc.
  upperColor?: string            // blue, red, black, etc.
  lowerClothing?: string         // pants, jeans, shorts
  lowerColor?: string
  carriedObject?: string         // backpack, bag, umbrella
  objectColor?: string
  vehicleType?: string           // car, truck, motorcycle, bus
  vehicleColor?: string
  directionTarget?: string       // exit, entrance, left, right, north, south
  visibleAction?: string         // walking, running, standing, sitting
  timeStart?: string             // "20:00"
  timeEnd?: string               // "22:00"
  dateStart?: string             // ISO date
  dateEnd?: string
  cameraFilter?: string[]        // camera IDs or names
  locationFilter?: string
  /** Terms the parser recognized but couldn't map to a field. */
  ignoredTerms: string[]
  /** Terms that were rejected because they request sensitive attributes. */
  rejectedTerms: string[]
  /** The semantic residual query (text passed to CLIP for embedding). */
  semanticQuery: string
  /** Explanation of the parse, shown to the user. */
  explanation: string
}

// ─── Sensitive terms that must be REJECTED, not silently transformed ───
// Section 3: race, ethnicity, religion, disability, medical status,
// political views, socioeconomic status, emotion, subjective criminality.
const SENSITIVE_TERMS = [
  // Race / ethnicity
  'raza', 'race', 'etnia', 'ethnicity',
  'asiatico', 'asian', 'indigena', 'indigenous', 'mestizo', 'caucasian',
  'caucasico', 'hispanic', 'latino',
  // Religion
  'religion', 'religión', 'muslim', 'musulman', 'jewish', 'judio', 'christian',
  'cristiano', 'hindu', 'buddhist', 'budista', 'atheist', 'ateo',
  // Disability / medical
  'discapacidad', 'disability', 'disabled', 'minusvalido', 'lisiado',
  'cojo', 'limp', 'paralitico', 'paralyzed', 'ciego', 'blind', 'sordo',
  'deaf', 'enfermo', 'sick', 'ill', 'disease', 'enfermedad', 'medical',
  // Political
  'politica', 'political', 'partido', 'party', 'izquierda', 'left-wing',
  'derecha', 'right-wing', 'comunista', 'communist', 'fascista', 'fascist',
  // Socioeconomic
  'pobre', 'poor', 'rico', 'rich', 'clase', 'class', 'homeless', 'vagabundo',
  'indigente', 'mendigo', 'beggar',
  // Emotion
  'enojado', 'angry', 'feliz', 'happy', 'triste', 'sad', 'asustado',
  'scared', 'nervioso', 'nervous', 'agresivo', 'aggressive',
  // Subjective criminality
  'criminal', 'delincuente', 'thief', 'ladrón', 'ladron', 'asesino',
  'killer', 'murderer', 'terrorist', 'terrorista', 'narcotraficante',
  'drug dealer', 'sicario', 'hitman', 'sospechoso', 'suspicious',
  'peligroso', 'dangerous',
  // Disabled research-only traits: age, perceived gender, gait, body shape
  'hombre', 'man', 'mujer', 'woman', 'masculino', 'male', 'femenino', 'female',
  'joven', 'young', 'anciano', 'elderly', 'viejo', 'old', 'edad', 'age',
  'gait', 'marcha', 'cojera', 'body shape', 'body proportion', 'forma corporal',
]

const SENSITIVE_CONTEXT_PATTERNS = [
  /\b(?:person|persona|man|hombre|woman|mujer)\s+(?:black|white|negro|blanco)\b/i,
  /\b(?:black|white|negro|blanco)\s+(?:person|persona|man|hombre|woman|mujer)\b/i,
  /\b(?:clase social|social class|partido politico|political party)\b/i,
]

function findSensitiveTerms(text: string): string[] {
  const normalized = text.toLowerCase()
  const tokenSet = new Set(normalized.split(/[^\p{L}\p{N}-]+/u).filter(Boolean))
  const found = SENSITIVE_TERMS.filter(term => term.includes(' ')
    ? normalized.includes(term)
    : tokenSet.has(term))
  for (const pattern of SENSITIVE_CONTEXT_PATTERNS) {
    const match = normalized.match(pattern)?.[0]
    if (match) found.push(match)
  }
  return [...new Set(found)]
}

// ─── Object type detection ───
const OBJECT_TYPES: Record<string, ParsedQuery['objectType']> = {
  'persona': 'person', 'person': 'person', 'people': 'person', 'gente': 'person',
  'hombre': 'person', 'man': 'person', 'mujer': 'person', 'woman': 'person',
  'vehiculo': 'vehicle', 'vehicle': 'vehicle', 'carro': 'vehicle', 'car': 'vehicle',
  'auto': 'vehicle', 'camion': 'vehicle', 'truck': 'vehicle',
  'moto': 'vehicle', 'motorcycle': 'vehicle', 'bus': 'vehicle',
  'objeto': 'object', 'object': 'object', 'cosa': 'object',
  'fuego': 'fire', 'fire': 'fire', 'incendio': 'fire', 'humo': 'fire', 'smoke': 'fire',
  'inundacion': 'flood', 'flood': 'flood', 'agua': 'flood', 'water': 'flood',
  'grafiti': 'graffiti', 'graffiti': 'graffiti', 'vandalismo': 'graffiti',
  'grieta': 'crack', 'crack': 'crack', 'dano': 'crack', 'damage': 'crack',
  'deslizamiento': 'landslide', 'landslide': 'landslide', 'derrumbe': 'landslide',
}

// ─── Clothing ───
const UPPER_CLOTHING: Record<string, string> = {
  'casaca': 'jacket', 'chaqueta': 'jacket', 'jacket': 'jacket', 'coat': 'jacket',
  'abrigo': 'jacket', 'campera': 'jacket',
  'camisa': 'shirt', 'shirt': 'shirt', 'blusa': 'shirt', 'blouse': 'shirt',
  'polera': 't-shirt', 'polo': 't-shirt', 't-shirt': 't-shirt', 'tshirt': 't-shirt',
  'suéter': 'sweater', 'sweater': 'sweater', 'chompa': 'sweater', 'pullover': 'sweater',
  'hoodie': 'hoodie', 'capucha': 'hoodie',
  'chaleco': 'vest', 'vest': 'vest',
}
const LOWER_CLOTHING: Record<string, string> = {
  'pantalon': 'pants', 'pants': 'pants', 'jean': 'jeans', 'jeans': 'jeans',
  'short': 'shorts', 'shorts': 'shorts', 'bermuda': 'shorts',
  'falda': 'skirt', 'skirt': 'skirt', 'vestido': 'dress', 'dress': 'dress',
}

// ─── Colors ───
const COLORS: Record<string, string> = {
  'azul': 'blue', 'blue': 'blue',
  'rojo': 'red', 'red': 'red', 'colorado': 'red',
  'verde': 'green', 'green': 'green',
  'amarillo': 'yellow', 'yellow': 'yellow',
  'negro': 'black', 'black': 'black', 'oscuro': 'black',
  'blanco': 'white', 'white': 'white', 'claro': 'white',
  'gris': 'gray', 'gray': 'gray', 'grey': 'gray',
  'naranja': 'orange', 'orange': 'orange',
  'morado': 'purple', 'purple': 'purple', 'violeta': 'purple',
  'rosa': 'pink', 'pink': 'pink', 'rosado': 'pink',
  'marron': 'brown', 'brown': 'brown', 'cafe': 'brown', 'café': 'brown',
  'beige': 'beige', 'crema': 'cream', 'cream': 'cream',
}

// ─── Carried objects ───
const CARRIED_OBJECTS: Record<string, string> = {
  'mochila': 'backpack', 'backpack': 'backpack', 'bolso': 'bag', 'bag': 'bag',
  'maletin': 'briefcase', 'briefcase': 'briefcase', 'maleta': 'suitcase',
  'suitcase': 'suitcase', 'valija': 'suitcase',
  'paraguas': 'umbrella', 'umbrella': 'umbrella',
  'sombrilla': 'umbrella',
  'celular': 'phone', 'phone': 'phone', 'telefono': 'phone',
  'botella': 'bottle', 'bottle': 'bottle',
  'caja': 'box', 'box': 'box', 'paquete': 'package', 'package': 'package',
}

// ─── Direction / target ───
const DIRECTIONS: Record<string, string> = {
  'salida': 'exit', 'exit': 'exit', 'salir': 'exit',
  'entrada': 'entrance', 'entrance': 'entrance', 'entrar': 'entrance',
  'izquierda': 'left', 'left': 'left',
  'derecha': 'right', 'right': 'right',
  'arriba': 'up', 'up': 'up', 'abajo': 'down', 'down': 'down',
  'norte': 'north', 'north': 'north', 'sur': 'south', 'south': 'south',
  'este': 'east', 'east': 'east', 'oeste': 'west', 'west': 'west',
}

// ─── Visible actions ───
const ACTIONS: Record<string, string> = {
  'caminando': 'walking', 'walking': 'walking', 'camina': 'walking',
  'corriendo': 'running', 'running': 'running', 'corre': 'running',
  'parado': 'standing', 'standing': 'standing', 'de pie': 'standing',
  'sentado': 'sitting', 'sitting': 'sitting', 'sienta': 'sitting',
  'agachado': 'crouching', 'crouching': 'crouching',
  'subiendo': 'climbing', 'climbing': 'climbing',
}

// ─── Vehicle types ───
const VEHICLE_TYPES: Record<string, string> = {
  'auto': 'car', 'car': 'car', 'carro': 'car', 'automovil': 'car',
  'camion': 'truck', 'truck': 'truck', 'camioneta': 'truck',
  'moto': 'motorcycle', 'motorcycle': 'motorcycle', 'motocicleta': 'motorcycle',
  'bus': 'bus', 'microbus': 'bus', 'van': 'van',
  'bicicleta': 'bicycle', 'bicycle': 'bicycle', 'bici': 'bicycle', 'bike': 'bicycle',
}

/**
 * Parse a natural-language query into structured fields.
 *
 * Spanish + English supported. Sensitive terms are REJECTED with a clear
 * explanation — never silently transformed.
 */
export function parseQuery(rawQuery: string): ParsedQuery {
  const raw = rawQuery.trim()
  const lower = raw.toLowerCase()
  const tokens = lower.split(/\s+/).filter(t => t.length > 0)

  const result: ParsedQuery = {
    raw,
    ignoredTerms: [],
    rejectedTerms: [],
    semanticQuery: raw,
    explanation: '',
  }

  const recognizedTerms: string[] = []

  // ─── 1. Check for sensitive terms (REJECT, don't transform) ───
  result.rejectedTerms.push(...findSensitiveTerms(lower))

  if (result.rejectedTerms.length > 0) {
    result.explanation = `Query rejected: contains sensitive term(s): ${result.rejectedTerms.join(', ')}. ` +
      `Race, ethnicity, religion, disability, medical status, political views, ` +
      `socioeconomic status, emotion, and subjective criminality are excluded ` +
      `from operational ranking per the privacy boundary (section 3). ` +
      `Please rephrase using observable, investigation-relevant descriptors ` +
      `such as clothing, color, carried object, vehicle, direction, or activity.`
    result.semanticQuery = ''
    return result
  }

  // ─── 2. Detect object type ───
  for (const [keyword, type] of Object.entries(OBJECT_TYPES)) {
    if (lower.includes(keyword)) {
      result.objectType = type
      recognizedTerms.push(keyword)
      break
    }
  }

  // ─── 3. Detect upper clothing ───
  for (const [keyword, value] of Object.entries(UPPER_CLOTHING)) {
    if (lower.includes(keyword)) {
      result.upperClothing = value
      recognizedTerms.push(keyword)
      break
    }
  }

  // ─── 4. Detect lower clothing ───
  for (const [keyword, value] of Object.entries(LOWER_CLOTHING)) {
    if (lower.includes(keyword)) {
      result.lowerClothing = value
      recognizedTerms.push(keyword)
      break
    }
  }

  // ─── 5. Detect carried objects ───
  for (const [keyword, value] of Object.entries(CARRIED_OBJECTS)) {
    if (lower.includes(keyword)) {
      result.carriedObject = value
      recognizedTerms.push(keyword)
      break
    }
  }

  // ─── 6. Detect colors and bind each to the nearest described item ───
  const colorMatches = Object.entries(COLORS)
    .map(([keyword, value]) => ({ keyword, value, position: lower.indexOf(keyword) }))
    .filter(match => match.position >= 0)
    .sort((left, right) => left.position - right.position)
  for (const match of colorMatches) {
    const nearby = lower.slice(Math.max(0, match.position - 18), match.position + match.keyword.length + 18)
    const nearUpper = Object.keys(UPPER_CLOTHING).some(keyword => nearby.includes(keyword))
    const nearLower = Object.keys(LOWER_CLOTHING).some(keyword => nearby.includes(keyword))
    const nearCarried = Object.keys(CARRIED_OBJECTS).some(keyword => nearby.includes(keyword))
    const nearVehicle = Object.keys(VEHICLE_TYPES).some(keyword => nearby.includes(keyword))
    if (nearUpper && !result.upperColor) result.upperColor = match.value
    else if (nearLower && !result.lowerColor) result.lowerColor = match.value
    else if (nearCarried && !result.objectColor) result.objectColor = match.value
    else if ((nearVehicle || result.objectType === 'vehicle') && !result.vehicleColor) result.vehicleColor = match.value
    else if (!result.upperColor) result.upperColor = match.value
    recognizedTerms.push(match.keyword)
  }

  // ─── 7. Detect vehicle type ───
  for (const [keyword, value] of Object.entries(VEHICLE_TYPES)) {
    if (lower.includes(keyword)) {
      result.vehicleType = value
      result.objectType = 'vehicle'
      recognizedTerms.push(keyword)
      break
    }
  }

  // ─── 8. Detect direction ───
  for (const [keyword, value] of Object.entries(DIRECTIONS)) {
    if (lower.includes(keyword)) {
      result.directionTarget = value
      recognizedTerms.push(keyword)
      break
    }
  }

  // ─── 9. Detect visible action ───
  for (const [keyword, value] of Object.entries(ACTIONS)) {
    if (lower.includes(keyword)) {
      result.visibleAction = value
      recognizedTerms.push(keyword)
      break
    }
  }

  // ─── 10. Detect time ranges ───
  // "después de las 8 pm", "after 8 pm", "antes de las 22:00", "between 20:00 and 22:00"
  const timeMatch = lower.match(/(?:después|after|despues)\s+(?:de\s+las?\s+)?(\d{1,2})\s*(am|pm)?/)
  if (timeMatch) {
    let hour = parseInt(timeMatch[1])
    if (timeMatch[2]?.toLowerCase() === 'pm' && hour < 12) hour += 12
    result.timeStart = `${hour.toString().padStart(2, '0')}:00`
    recognizedTerms.push(timeMatch[0])
  }
  const timeEndMatch = lower.match(/(?:antes|before)\s+(?:de\s+las?\s+)?(\d{1,2})\s*(am|pm)?/)
  if (timeEndMatch) {
    let hour = parseInt(timeEndMatch[1])
    if (timeEndMatch[2]?.toLowerCase() === 'pm' && hour < 12) hour += 12
    result.timeEnd = `${hour.toString().padStart(2, '0')}:00`
    recognizedTerms.push(timeEndMatch[0])
  }

  // ─── 11. Identify ignored terms (tokens not matched to any field) ───
  // Remove recognized terms from tokens, the rest are "ignored"
  const recognizedSet = new Set(recognizedTerms.flatMap(t => t.split(/\s+/)))
  for (const token of tokens) {
    const cleanToken = token.replace(/[,.!?;:]/g, '')
    if (cleanToken.length < 3) continue
    if (!recognizedSet.has(cleanToken) && !SENSITIVE_TERMS.includes(cleanToken)) {
      // Skip common stopwords
      const stopwords = ['the', 'and', 'with', 'con', 'de', 'la', 'el', 'un', 'una', 'a', 'an',
        'in', 'en', 'on', 'at', 'por', 'for', 'to', 'para', 'that', 'que',
        'this', 'este', 'is', 'es', 'was', 'fue', 'are', 'son',
        'after', 'después', 'despues', 'before', 'antes', 'between', 'entre',
        'pm', 'am', 'oclock', 'horas', 'hours', 'hr', 'h']
      if (!stopwords.includes(cleanToken) && !result.ignoredTerms.includes(cleanToken)) {
        result.ignoredTerms.push(cleanToken)
      }
    }
  }

  // ─── 12. Build semantic residual query (for CLIP embedding) ───
  // Keep the original query minus the rejected sensitive terms (already empty).
  // CLIP will embed this for cosine similarity against stored crops.
  result.semanticQuery = raw

  // ─── 13. Build explanation ───
  const parts: string[] = []
  if (result.objectType) parts.push(`object: ${result.objectType}`)
  if (result.upperClothing) parts.push(`upper: ${result.upperClothing}`)
  if (result.upperColor) parts.push(`color: ${result.upperColor}`)
  if (result.lowerClothing) parts.push(`lower: ${result.lowerClothing}`)
  if (result.lowerColor) parts.push(`color: ${result.lowerColor}`)
  if (result.carriedObject) parts.push(`carrying: ${result.carriedObject}`)
  if (result.objectColor) parts.push(`obj color: ${result.objectColor}`)
  if (result.vehicleType) parts.push(`vehicle: ${result.vehicleType}`)
  if (result.vehicleColor) parts.push(`vehicle color: ${result.vehicleColor}`)
  if (result.directionTarget) parts.push(`direction: ${result.directionTarget}`)
  if (result.visibleAction) parts.push(`action: ${result.visibleAction}`)
  if (result.timeStart) parts.push(`after: ${result.timeStart}`)
  if (result.timeEnd) parts.push(`before: ${result.timeEnd}`)

  result.explanation = parts.length > 0
    ? `Recognized: ${parts.join(' | ')}. ` +
      (result.ignoredTerms.length > 0
        ? `Ignored: ${result.ignoredTerms.slice(0, 10).join(', ')}. `
        : '') +
      `Semantic residual passed to CLIP: "${result.semanticQuery.slice(0, 80)}${result.semanticQuery.length > 80 ? '...' : ''}"`
    : `No structured fields recognized. Full query passed to CLIP for semantic search.`

  return result
}

/**
 * Check if a query should be rejected outright for sensitive content.
 * Returns the rejection reason, or null if the query is acceptable.
 */
export function checkSensitiveTerms(query: string): string | null {
  const found = findSensitiveTerms(query)
  if (found.length === 0) return null
  return `Query contains sensitive term(s): ${found.join(', ')}. ` +
    `These attributes are excluded from operational ranking per the privacy ` +
    `boundary. Please rephrase using observable descriptors ` +
    `(clothing, color, carried object, vehicle, direction, activity).`
}
