// Translations for Mira Cosmic River - Cinematic Experience
// Romantic copy for the love letter narrative

export const TRANSLATIONS = {
  en: {
    // Cinematic opening (3 text fades)
    cinematic1: 'In all this vastness, we found each other.',
    cinematic2: 'Drawn together. Moving onward.',
    cinematic3: 'Behind us, a river of light.',

    // Title and subtitle
    title: 'Mira',
    subtitle: 'Together, Until the End of Time',

    // Star info cards
    miraA: 'Mira A',
    miraADesc: 'Red Giant. 300x the Sun\'s radius. Pulsing every 332 days. Temperature: 3,000K.',
    phaseDaysToMax: 'About {n} days to next maximum',
    phaseDaysToMin: 'About {n} days to next minimum',
    phaseAtMaximum: 'At maximum light',
    phaseAtMinimum: 'At minimum light',
    phaseBrightening: 'Brightening',
    phaseFading: 'Fading',
    milestoneMaximum: 'Mira is at its brightest this cycle',
    milestoneMinimum: 'Mira is at its faintest this cycle',
    miraB: 'Mira B',
    miraBDesc: 'White Dwarf. Accreting matter from its companion. One day, it may trigger a nova.',
    tailLabel: 'The Tail',
    tailDesc: '13 light-years long. Discovered by GALEX in 2007. The longest stellar tail ever observed.',

    // UI
    timeSpeed: 'Time Speed',
    interactionHint: 'Drag to Rotate · Scroll to Zoom',
    interactionHintMobile: 'Drag to Rotate · Pinch to Zoom',
    replayOpening: 'Full cinematic',
    pause: 'Pause',
    resume: 'Resume',
    returnToView: 'Main view',
    tailHint: 'Find her tail',
    tailFound: 'You found her tail.',
    loading: 'Loading Mira...',

    // Ambient sound (#22): opt-in, honest states — pending never claims to be playing
    ambientSound: 'Ambient sound',
    ambientTapToStart: 'Tap to start ambient sound',
    ambientStarting: 'Starting ambient sound…',
    ambientRetry: 'Retry ambient sound',

    // 今晚的 Mira (#23): the fixed companionship phrase and the save flow's honest
    // states — a lost scene is never passed off as a live capture
    tonightSave: 'Tonight\'s Mira',
    tonightPhrase: 'Drawn to each other, travelling together',
    tonightAddDate: 'Add the date',
    tonightAddPhrase: 'Add the phrase',
    tonightDownload: 'Save image',
    tonightSaving: 'Saving…',
    tonightSaved: 'Tonight\'s Mira is saved',
    tonightRetry: 'Retry saving',
    tonightFailed: 'Saving failed — tonight\'s frame is still here',
    tonightSceneLost: 'The scene is restoring — save again once it returns',
    tonightClose: 'Close',

    // Closing message
    closingMessage: 'We are made of starstuff. And my starstuff chose yours.',
  },
  ch: {
    // Cinematic opening (3 text fades)
    cinematic1: '在浩瀚宇宙里，我们遇见彼此。',
    cinematic2: '彼此牵引，一起走向更远。',
    cinematic3: '走过的路，留成一条光河。',

    // Title and subtitle
    title: 'Mira',
    subtitle: '在宇宙的尽头，我们依然相伴',

    // Star info cards
    miraA: '蒭藁增二 A',
    miraADesc: '红巨星。太阳半径的300倍。每332天脉动一次。表面温度3,000K。',
    phaseDaysToMax: '距下次最亮约 {n} 天',
    phaseDaysToMin: '距下次最暗约 {n} 天',
    phaseAtMaximum: '正处于最亮',
    phaseAtMinimum: '正处于最暗',
    phaseBrightening: '正在变亮',
    phaseFading: '正在变暗',
    milestoneMaximum: '本周期最亮',
    milestoneMinimum: '本周期最暗',
    miraB: '蒭藁增二 B',
    miraBDesc: '白矮星。从伴星吸积物质。终有一天，它可能触发新星爆发。',
    tailLabel: '尾巴',
    tailDesc: '13光年长。2007年由GALEX卫星发现。人类观测到的最长的恒星尾巴。',

    // UI
    timeSpeed: '时间速度',
    interactionHint: '拖拽旋转 · 滚轮缩放',
    interactionHintMobile: '拖拽旋转 · 双指缩放',
    replayOpening: '完整开场',
    pause: '暂停',
    resume: '恢复',
    returnToView: '主视角',
    tailHint: '去找她的尾巴',
    tailFound: '你找到了她的尾巴。',
    loading: '正在点亮 Mira...',

    // 环境音（#22）：主动开启，状态如实——等待手势时绝不冒充正在播放
    ambientSound: '环境音',
    ambientTapToStart: '点按开启环境音',
    ambientStarting: '正在开启环境音…',
    ambientRetry: '重试环境音',

    // 今晚的 Mira（#23）：固定的相伴短句与如实状态——画面未恢复时绝不冒充实时截图
    tonightSave: '今晚的 Mira',
    tonightPhrase: '彼此牵引，共同前行',
    tonightAddDate: '附上日期',
    tonightAddPhrase: '附上短句',
    tonightDownload: '保存图片',
    tonightSaving: '正在保存…',
    tonightSaved: '已存好今晚的 Mira',
    tonightRetry: '重试保存',
    tonightFailed: '这次没能存下，今晚的画面还在',
    tonightSceneLost: '画面正在恢复，等它回来后再保存',
    tonightClose: '关闭',

    // Closing message
    closingMessage: '我们都是星尘。而我的星尘，选择了你的。',
  },
} as const;

export type Language = keyof typeof TRANSLATIONS;
export type TranslationKey = keyof typeof TRANSLATIONS.en;
