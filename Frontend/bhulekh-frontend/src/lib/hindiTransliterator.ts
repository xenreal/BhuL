// Client-side Phonetic Hindi (Devanagari) Transliterator
// Designed for Indian Revenue Records (Jamabandi / RoR / Patwari workflows)

const COMMON_REVENUE_DICTIONARY: Record<string, string> = {
  // Common Names & Surnames
  ram: "राम",
  shyam: "श्याम",
  kumar: "कुमार",
  singh: "सिंह",
  lal: "लाल",
  chand: "चन्द",
  chander: "चन्द्र",
  chandra: "चन्द्र",
  devi: "देवी",
  leela: "लीला",
  lila: "लीला",
  prakash: "प्रकाश",
  krishan: "कृष्ण",
  krishna: "कृष्ण",
  madhavindra: "माधविन्द्र",
  madhav: "माधव",
  inder: "इन्द्र",
  indra: "इन्द्र",
  sharma: "शर्मा",
  verma: "वर्मा",
  gupta: "गुप्ता",
  yadav: "यादव",
  patel: "पटेल",
  shukla: "शुक्ला",
  mishra: "मिश्रा",
  das: "दास",
  dutt: "दत्त",
  rana: "राणा",
  thakur: "ठाकुर",
  rajput: "राजपूत",
  chauhan: "चौहान",
  bhardwaj: "भारद्वाज",

  // Land & Cadastral Terminology
  khasra: "खसरा",
  khata: "खाता",
  khewat: "खेवट",
  khatauni: "खतौनी",
  rakba: "रकबा",
  jamabandi: "जमाबंदी",
  bhulekh: "भूलेख",
  patta: "पट्टा",
  chitta: "चिट्टा",
  intiqal: "इंतकाल",
  dakhil: "दाखिल",
  kharij: "खारिज",
  girdawari: "गिरदावरी",
  misal: "मिसल",
  haqiat: "हकीयत",
  shajra: "शजरा",
  aks: "अक्स",
  naqsha: "नक्शा",

  // Units of Measurement
  bigha: "बीघा",
  biswa: "बिस्वा",
  biswansi: "बिस्वांसी",
  kanal: "कनाल",
  marla: "मरला",
  sarsahi: "सरसाही",
  acre: "एकड़",
  hectare: "हेक्टेयर",
  gaj: "गज",
  yard: "यार्ड",

  // Land Classifications (किस्म ज़मीन)
  barani: "बारानी",
  chahi: "चाही",
  nahri: "नहरी",
  sailab: "सैलाब",
  banjar: "बंजर",
  kadim: "कदीम",
  jadid: "जदीद",
  gair: "ग़ैर",
  mumkin: "मुमकिन",
  abadi: "आबादी",
  deh: "देह",
  charagah: "चारागाह",
  maqbooza: "मकबूज़ा",
  malkan: "मालकान",
  kashtkar: "काश्तकार",
  hissedar: "हिस्सेदार",

  // Administrative Divisions
  tehsil: "तहसील",
  subtehsil: "उप-तहसील",
  zila: "ज़िला",
  district: "ज़िला",
  village: "गाँव",
  mauza: "मौज़ा",
  mohalla: "मोहल्ला",
  ward: "वार्ड",
  pradesh: "प्रदेश",
  himachal: "हिमाचल",
  punjab: "पंजाब",
  haryana: "हरियाणा",
  rajasthan: "राजस्थान",
  uttar: "उत्तर",
  bihar: "बिहार",
  anu: "अणु",
  hamirpur: "हमीरपुर",
  shimla: "शिमला",
  kangra: "कांगड़ा",
  mandi: "मंडी",
  kullu: "कुल्लू",
  solan: "सोलन",
  sirmaur: "सिरमौर",
  bilaspur: "बिलासपुर",
  una: "ऊना",
  chamba: "चंबा",
  deon: "देओन",
  bathinda: "बठिंडा",
}

// Consonant clusters & mapping
const CONSONANT_MAP: Record<string, string> = {
  k: "क",
  kh: "ख",
  g: "ग",
  gh: "घ",
  ng: "ङ",
  ch: "च",
  chh: "छ",
  j: "ज",
  jh: "झ",
  ny: "ञ",
  t: "त",
  th: "थ",
  d: "द",
  dh: "ध",
  n: "न",
  p: "प",
  ph: "फ",
  f: "फ़",
  b: "ब",
  bh: "भ",
  m: "म",
  y: "य",
  r: "र",
  l: "ल",
  v: "व",
  w: "व",
  sh: "श",
  shh: "ष",
  s: "स",
  h: "ह",
  ksh: "क्ष",
  tr: "त्र",
  gy: "ज्ञ",
  z: "ज़",
  q: "क़",
}

// Independent vowels at the start of a syllable
const VOWEL_INDEPENDENT: Record<string, string> = {
  a: "अ",
  aa: "आ",
  i: "इ",
  ee: "ई",
  ii: "ई",
  u: "उ",
  oo: "ऊ",
  uu: "ऊ",
  ri: "ऋ",
  e: "ए",
  ai: "ऐ",
  o: "ओ",
  au: "औ",
  ou: "औ",
}

// Dependent vowel signs (matras) after a consonant
const VOWEL_MATRA: Record<string, string> = {
  a: "", // implicit vowel
  aa: "ा",
  i: "ि",
  ee: "ी",
  ii: "ी",
  u: "ु",
  oo: "ू",
  uu: "ू",
  ri: "ृ",
  e: "े",
  ai: "ै",
  o: "ो",
  au: "ौ",
  ou: "ौ",
}

/**
 * Phonetically transliterates a single English Roman word to Devanagari.
 */
export function transliterateWord(word: string): string {
  if (!word) return ""
  const cleanWord = word.trim().toLowerCase()

  // 1. Direct dictionary lookup for high accuracy with legal revenue terms
  if (COMMON_REVENUE_DICTIONARY[cleanWord]) {
    return COMMON_REVENUE_DICTIONARY[cleanWord]
  }

  // If word contains non-alphabet characters (e.g. numbers, slashes), return as is
  if (!/^[a-z]+$/i.test(cleanWord)) {
    return word
  }

  // 2. Rule-based syllable/phonetic parser
  let result = ""
  let i = 0
  const len = cleanWord.length

  while (i < len) {
    // Check 3-letter consonant clusters (ksh, chh, etc.)
    const three = cleanWord.slice(i, i + 3)
    const two = cleanWord.slice(i, i + 2)
    const one = cleanWord.slice(i, i + 1)

    // Check independent vowel at the beginning or after another vowel
    if (i === 0 || (result.length > 0 && !result.endsWith("्") && isDevanagariVowel(result[result.length - 1]))) {
      let matchedVowel = ""
      if (VOWEL_INDEPENDENT[two]) {
        matchedVowel = VOWEL_INDEPENDENT[two]
        i += 2
      } else if (VOWEL_INDEPENDENT[one]) {
        matchedVowel = VOWEL_INDEPENDENT[one]
        i += 1
      }
      if (matchedVowel) {
        result += matchedVowel
        continue
      }
    }

    // Identify consonant
    let c = ""
    let cLen = 0
    if (CONSONANT_MAP[three]) {
      c = CONSONANT_MAP[three]
      cLen = 3
    } else if (CONSONANT_MAP[two]) {
      c = CONSONANT_MAP[two]
      cLen = 2
    } else if (CONSONANT_MAP[one]) {
      c = CONSONANT_MAP[one]
      cLen = 1
    }

    if (c) {
      i += cLen
      // Now look for subsequent vowel matra
      const nextTwo = cleanWord.slice(i, i + 2)
      const nextOne = cleanWord.slice(i, i + 1)

      if (i >= len) {
        // End of word: in Hindi phonetics, final consonants typically don't take a halant (e.g., 'ram' -> 'राम', not 'राम्')
        result += c
      } else if (VOWEL_MATRA[nextTwo] !== undefined) {
        result += c + VOWEL_MATRA[nextTwo]
        i += 2
      } else if (VOWEL_MATRA[nextOne] !== undefined) {
        result += c + VOWEL_MATRA[nextOne]
        i += 1
      } else {
        // Another consonant follows -> create conjunct with halant
        result += c + "्"
      }
    } else {
      // Unrecognized or vowel in middle
      if (VOWEL_INDEPENDENT[two]) {
        result += VOWEL_INDEPENDENT[two]
        i += 2
      } else if (VOWEL_INDEPENDENT[one]) {
        result += VOWEL_INDEPENDENT[one]
        i += 1
      } else {
        result += cleanWord[i]
        i += 1
      }
    }
  }

  return result
}

function isDevanagariVowel(char: string): boolean {
  return "अआइईउऊऋएऐओऔािीुूृेैोौ".includes(char)
}

/**
 * Transliterates an entire text string word by word,
 * preserving punctuation, spacing, numerals, commas, and delimiters.
 */
export function transliterateSentence(text: string): string {
  if (!text) return ""

  // Split by word boundaries while keeping delimiters intact
  const tokens = text.split(/([ \t\n\r,./;:\-_()\[\]{}]+)/)
  return tokens
    .map((token) => {
      // If token is punctuation or pure whitespace, preserve it
      if (!token || /^[ \t\n\r,./;:\-_()\[\]{}]+$/.test(token)) {
        return token
      }
      // If token contains digits or is already in non-Latin script, keep as is
      if (/\d/.test(token) || /[^\u0000-\u007F]/.test(token)) {
        return token
      }
      return transliterateWord(token)
    })
    .join("")
}

