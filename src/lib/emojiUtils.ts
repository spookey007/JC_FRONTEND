/**
 * Kawaii text emoji utilities - only cute kawaii text emojis! ⸜(｡˃ ᵕ ˂ )⸝♡
 */

// Complete collection of kawaii text emojis
const KAWAII_TEXT_EMOJIS = [
  // Happy & Love
  '⸜(｡˃ ᵕ ˂ )⸝♡',
  '♡(˃͈ દ ˂͈ ༶ )',
  '(´｡• ᵕ •｡`) ♡',
  '♡( ˃͈ દ ˂͈ ༶ )',
  '( ˶ᵔ ᵕ ᵔ˶ )',
  '(˶ᵔ ᵕ ᵔ˶)',
  '(´∀｀)♡',
  '(◡ ‿ ◡)',
  '(◕‿◕)♡',
  '(˘▾˘)~♪',
  '(´꒳`)♡',
  '(｡♡‿♡｡)',
  '♡(◡ ‿ ◡)♡',
  
  // Cute & Shy
  '(｡•́︿•̀｡)',
  '(˘⌣˘)',
  '(◞‸◟)',
  '(´･ω･`)',
  '(◡ ω ◡)',
  '(◕‿◕)',
  '(◡‿◡)',
  '(´▽`)',
  '(◠‿◠)',
  '(´∀`)',
  '(◕ᴗ◕✿)',
  '(◕‿◕)✿',
  '(◕▿◕)',
  
  // Excited & Playful
  '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
  '✧(｡•̀ᴗ-)✧',
  '(◕‿◕)✧',
  '(ﾉ´ヮ`)ﾉ*: ･ﾟ',
  '٩(◕‿◕)۶',
  '(｡◕‿◕｡)',
  '(✿◠‿◠)',
  '(◕‿◕)♪',
  '(◠‿◠)♡',
  '(◡ ‿ ◡)✿',
  
  // Sleepy & Dreamy
  '(˘▾˘)~',
  '(´-ω-`)',
  '(◡ ‿ ◡)zzz',
  '(´｡• ᵕ •｡`)',
  '(◞‸◟ )',
  
  // Surprised & Wonder
  '(◉‿◉)',
  '(◕o◕)',
  '(⊙_⊙)',
  '(◎_◎)',
  '(◕‿◕)!',
  
  // Cool & Confident
  '(⌐■_■)',
  '(｀･ω･´)',
  '(◕‿◕)ノ',
  '(◠‿◠)✌',
  
  // Special Characters
  '♡(˃͈ દ ˂͈ ༶ )♡',
  '✧*:･ﾟ✧(◕‿◕)✧*:･ﾟ✧',
  '♡～(◡ ‿ ◡)～♡',
  '(◕‿◕)っ♡',
  '～(◡ ‿ ◡)～',
  '(◕‿◕)✨',
  '♡⸜(˃ ᵕ ˂ )⸝♡'
];

// Only kawaii text category - removed unused KAWAII_CATEGORIES

export interface EmojiData {
  content: string;
  name: string;
  type?: string;
}

/**
 * Get all kawaii text emojis
 */
export function getAllKawaiiTextEmojis(): string[] {
  return KAWAII_TEXT_EMOJIS;
}

/**
 * Get kawaii text emojis grouped by type
 */
export function getKawaiiEmojisByType(): Record<string, string[]> {
  return {
    'Happy & Love': KAWAII_TEXT_EMOJIS.slice(0, 13),
    'Cute & Shy': KAWAII_TEXT_EMOJIS.slice(13, 26),
    'Excited & Playful': KAWAII_TEXT_EMOJIS.slice(26, 36),
    'Sleepy & Dreamy': KAWAII_TEXT_EMOJIS.slice(36, 41),
    'Surprised & Wonder': KAWAII_TEXT_EMOJIS.slice(41, 46),
    'Cool & Confident': KAWAII_TEXT_EMOJIS.slice(46, 50),
    'Special Characters': KAWAII_TEXT_EMOJIS.slice(50)
  };
}

/**
 * Only kawaii text category
 */
export const EMOJI_CATEGORIES = ['kawaii_text'] as const;

export type EmojiCategory = typeof EMOJI_CATEGORIES[number];
