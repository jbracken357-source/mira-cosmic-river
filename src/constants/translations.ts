// Translations for Mira Cosmic River
// Full romantic copy from binary-waltz PRD section 6.1

export const TRANSLATIONS = {
  en: {
    // Title and subtitle
    title: 'Mira - The Binary Waltz',
    subtitle: 'Together, Until the End of Time',

    // Main description (3 paragraphs)
    description: {
      paragraph1: 'This is Mira (Omicron Ceti), a binary star system that has danced together for billions of years.',
      paragraph2: 'The red giant, like you, burns bright and magnificent; the companion, like me, forever follows your light.',
      paragraph3: 'No matter how the universe changes, we orbit each other until the end of time.',
    },

    // Interaction hint
    interactionHint: 'Drag to Rotate · Scroll to Zoom · Feel the Eternity',

    // Star labels
    miraA: 'Mira A',
    miraADesc: 'Red Giant - Pulsating atmosphere',
    miraB: 'Mira B',
    miraBDesc: 'White Dwarf - Accreting matter',

    // Data labels
    spectralType: 'SPECTRAL TYPE',
    spectralValue: 'M7 IIIe + DA',
    distance: 'DISTANCE',
    distanceValue: '~300 light-years',

    // Footer quote
    footerQuote: 'Together, until the end of time',

    // UI labels
    systemTab: 'SYSTEM',
    environmentTab: 'ENVIRONMENT',
    displayMode: 'DISPLAY MODE',

    // Slider labels
    primaryColor: 'Primary Color',
    secondaryColor: 'Secondary Color',
    turbulence: 'Turbulence',
    orbitSpeed: 'Orbit Speed',
    particleDensity: 'Particle Density',
    bloomIntensity: 'Bloom Intensity',

    // Control Panel specific
    stellarBreath: 'Stellar Breath',
    cosmicDance: 'Cosmic Dance',
    stardustDensity: 'Stardust Density',
    starlightGlow: 'Starlight Glow',
    autoRotate: 'Auto Rotate',
    reset: 'Reset',

    // Mode names
    modeGlow: 'GLOW',
    modeWave: 'WAVE',
    modeParticles: 'PARTICLES',
  },
  ch: {
    // Title and subtitle
    title: 'Mira - 双星共舞',
    subtitle: '在宇宙的尽头，我们依然相伴',

    // Main description (3 paragraphs)
    description: {
      paragraph1: '这是蒭藁增二 (Mira)，一对已共舞数十亿年的双星。',
      paragraph2: '红巨星如你，炽热而耀眼；伴星如我，永远追随你的光芒。',
      paragraph3: '无论宇宙如何变迁，我们始终彼此环绕，直到时间的尽头。',
    },

    // Interaction hint
    interactionHint: '拖拽旋转 · 滚轮缩放 · 感受永恒',

    // Star labels
    miraA: '蒭藁增二 A',
    miraADesc: '红巨星 - 脉动大气',
    miraB: '蒭藁增二 B',
    miraBDesc: '白矮星 - 吸积物质',

    // Data labels
    spectralType: '光谱类型',
    spectralValue: 'M7 IIIe + DA',
    distance: '距离',
    distanceValue: '~300 光年',

    // Footer quote
    footerQuote: '在宇宙的尽头，我们依然相伴',

    // UI labels
    systemTab: '系统',
    environmentTab: '环境',
    displayMode: '显示模式',

    // Slider labels
    primaryColor: '主星颜色',
    secondaryColor: '伴星颜色',
    turbulence: '湍流强度',
    orbitSpeed: '轨道速度',
    particleDensity: '粒子密度',
    bloomIntensity: '辉光强度',

    // Control Panel specific
    stellarBreath: '恒星呼吸',
    cosmicDance: '宇宙之舞',
    stardustDensity: '星尘密度',
    starlightGlow: '星光辉光',
    autoRotate: '自动旋转',
    reset: '重置',

    // Mode names
    modeGlow: '辉光',
    modeWave: '物质流',
    modeParticles: '粒子',
  },
} as const;

export type Language = keyof typeof TRANSLATIONS;
export type TranslationKey = keyof typeof TRANSLATIONS.en;
