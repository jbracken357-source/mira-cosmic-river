// Translations for Mira Cosmic River - Cinematic Experience
// Romantic copy for the love letter narrative

export const TRANSLATIONS = {
  en: {
    // Cinematic opening (3 text fades)
    cinematic1: '300 light-years from Earth, two stars have been dancing for billions of years.',
    cinematic2: 'She leaves a trail 13 light-years long. 200 times the size of our solar system. The longest stellar tail ever observed.',
    cinematic3: 'Mira. Named for the Latin word for "wonderful." Like you.',

    // Title and subtitle
    title: 'Mira',
    subtitle: 'Together, Until the End of Time',

    // Star info cards
    miraA: 'Mira A',
    miraADesc: 'Red Giant. 300x the Sun\'s radius. Pulsing every 332 days. Temperature: 3,000K.',
    miraB: 'Mira B',
    miraBDesc: 'White Dwarf. Accreting matter from its companion. One day, it may trigger a nova.',
    tailLabel: 'The Tail',
    tailDesc: '13 light-years long. Discovered by GALEX in 2007. The longest stellar tail ever observed.',

    // UI
    timeSpeed: 'Time Speed',
    interactionHint: 'Drag to Rotate · Scroll to Zoom',

    // Closing message
    closingMessage: 'We are made of starstuff. And my starstuff chose yours.',
  },
  ch: {
    // Cinematic opening (3 text fades)
    cinematic1: '距离地球300光年，两颗星星已经共舞了数十亿年。',
    cinematic2: '她留下了一条13光年长的尾巴——太阳系的200倍大。这是人类观测到的最长的恒星尾巴。',
    cinematic3: 'Mira。拉丁语意为"奇妙"。就像你一样。',

    // Title and subtitle
    title: 'Mira',
    subtitle: '在宇宙的尽头，我们依然相伴',

    // Star info cards
    miraA: '蒭藁增二 A',
    miraADesc: '红巨星。太阳半径的300倍。每332天脉动一次。表面温度3,000K。',
    miraB: '蒭藁增二 B',
    miraBDesc: '白矮星。从伴星吸积物质。终有一天，它可能触发新星爆发。',
    tailLabel: '尾巴',
    tailDesc: '13光年长。2007年由GALEX卫星发现。人类观测到的最长的恒星尾巴。',

    // UI
    timeSpeed: '时间速度',
    interactionHint: '拖拽旋转 · 滚轮缩放',

    // Closing message
    closingMessage: '我们都是星尘。而我的星尘，选择了你的。',
  },
} as const;

export type Language = keyof typeof TRANSLATIONS;
export type TranslationKey = keyof typeof TRANSLATIONS.en;
