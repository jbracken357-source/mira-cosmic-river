import { motion } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import ControlPanel from './ControlPanel';
import LanguageSwitch from './LanguageSwitch';
import { TRANSLATIONS } from '../../constants/translations';

export default function UI() {
  const language = useBinaryStar((state) => state.language);
  const t = TRANSLATIONS[language];

  return (
    <div className="relative z-10 flex flex-col h-screen pointer-events-none select-none">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="flex items-center justify-between px-4 md:px-14 py-4 md:py-8"
      >
        <div className="flex items-center gap-3 md:gap-6 pointer-events-auto">
          <LanguageSwitch />
          <span className="font-display text-2xl md:text-4xl text-orange-400 italic tracking-widest">
            Mira
          </span>
          <div className="h-6 md:h-8 w-px bg-orange-400/20" />
          <h2 className="text-[8px] md:text-[9px] tracking-[0.3em] uppercase opacity-50 hidden md:block">
            {t.subtitle}
          </h2>
        </div>

        <div className="pointer-events-auto hidden md:block">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 px-4 py-2 rounded-full flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[9px] tracking-[0.2em] uppercase opacity-60">
                {t.interactionHint}
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col lg:flex-row items-center justify-between px-4 md:px-20 py-6 md:py-10 overflow-hidden">
        {/* Left: Hero & Info */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="w-full lg:w-[45%] flex flex-col justify-center h-full gap-6 md:gap-10 lg:gap-16 pb-20 md:pb-0"
        >
          <div>
            <h1 className="font-display text-4xl md:text-7xl lg:text-8xl font-light leading-[0.9] text-white">
              <span className="block opacity-90">{t.title.split(' - ')[0]}</span>
              <span className="text-orange-400 italic">
                {t.title.split(' - ').slice(1).join(' - ')}
              </span>
            </h1>
          </div>

          <div className="flex gap-4 md:gap-8">
            <div className="flex flex-col gap-2 md:gap-3">
              <span className="text-[8px] md:text-[9px] tracking-[0.3em] uppercase opacity-30 font-light">
                {t.miraA}
              </span>
              <div className="w-12 md:w-16 h-[1px] bg-gradient-to-r from-orange-500/60 to-transparent" />
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-orange-500 animate-pulse" />
                <p className="text-xs md:text-sm font-extralight italic opacity-80">{t.miraADesc}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 md:gap-3">
              <span className="text-[8px] md:text-[9px] tracking-[0.3em] uppercase opacity-30 font-light">
                {t.miraB}
              </span>
              <div className="w-12 md:w-16 h-[1px] bg-gradient-to-r from-violet-400/60 to-transparent" />
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-white animate-pulse" />
                <p className="text-xs md:text-sm font-extralight italic opacity-80">{t.miraBDesc}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right: Control Panel - hidden on mobile (uses bottom sheet) */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="relative pointer-events-auto hidden md:block"
        >
          <ControlPanel />
        </motion.div>
      </main>

      {/* Footer - simplified on mobile */}
      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.6 }}
        className="px-4 md:px-14 py-4 md:py-8 flex justify-between items-end border-t border-white/5 bg-gradient-to-t from-black/60 to-transparent backdrop-blur-sm pb-6 md:pb-8"
      >
        <div className="flex flex-col gap-1 md:gap-2">
          <span className="text-[7px] md:text-[8px] uppercase tracking-[0.3em] opacity-30">{t.spectralType}</span>
          <span className="font-display text-base md:text-lg italic text-orange-400/80">{t.spectralValue}</span>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="text-right hidden md:block">
            <span className="block text-[7px] md:text-[8px] uppercase tracking-[0.3em] opacity-30">
              {t.distance}
            </span>
            <span className="font-display text-xs md:text-sm italic text-white/50">{t.distanceValue}</span>
          </div>
          <div className="h-6 md:h-8 w-px bg-white/10 mx-2 md:mx-4 hidden md:block" />
          <p className="text-[8px] md:text-[10px] font-extralight opacity-40 italic max-w-[150px] md:max-w-[200px] text-right">
            {t.footerQuote}
          </p>
        </div>
      </motion.footer>
    </div>
  );
}
