import { motion } from 'framer-motion';
import { useBinaryStar, useParameters } from '../../hooks';
import ModeToggle from './ModeToggle';
import ParameterSlider from './ParameterSlider';
import LanguageSwitch from './LanguageSwitch';
import { ANIMATION } from '../../constants';

const TRANSLATIONS = {
  en: {
    title: 'Mira Cosmic River',
    subtitle: 'Binary Star System Visualization',
    controls: 'Controls',
    primaryColor: 'Primary Star Color',
    secondaryColor: 'Secondary Star Color',
    turbulence: 'Turbulence',
    orbitSpeed: 'Orbit Speed',
    bloomIntensity: 'Bloom Intensity',
    particleDensity: 'Particle Density',
    reset: 'Reset',
  },
  ch: {
    title: 'Mira 星河',
    subtitle: '双星系统可视化',
    controls: '控制面板',
    primaryColor: '主星颜色',
    secondaryColor: '伴星颜色',
    turbulence: '湍流强度',
    orbitSpeed: '轨道速度',
    bloomIntensity: '辉光强度',
    particleDensity: '粒子密度',
    reset: '重置',
  },
};

export default function ControlPanel() {
  const language = useBinaryStar((state) => state.language);
  const parameters = useParameters();
  const setParameter = useBinaryStar((state) => state.setParameter);
  const resetParameters = useBinaryStar((state) => state.resetParameters);
  const mode = useBinaryStar((state) => state.mode);

  const t = TRANSLATIONS[language];

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: ANIMATION.INTRO_STAGGER.UI_PANEL / 1000,
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="fixed right-4 top-1/2 -translate-y-1/2 w-72 glass-panel p-4 z-10"
      role="region"
      aria-label="Control Panel"
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-display text-lg text-solar-white mb-1">
          {t.controls}
        </h2>
        <div className="flex items-center justify-between">
          <ModeToggle />
          <LanguageSwitch />
        </div>
      </div>

      {/* Parameter Sliders */}
      <div className="space-y-3">
        <ParameterSlider
          label={t.primaryColor}
          labelZh={TRANSLATIONS.ch.primaryColor}
          value={parameters.primaryColor}
          min={0}
          max={360}
          step={1}
          onChange={(v) => setParameter('primaryColor', v)}
          language={language}
          formatValue={(v) => `${v}deg`}
        />

        <ParameterSlider
          label={t.secondaryColor}
          labelZh={TRANSLATIONS.ch.secondaryColor}
          value={parameters.secondaryColor}
          min={180}
          max={300}
          step={1}
          onChange={(v) => setParameter('secondaryColor', v)}
          language={language}
          formatValue={(v) => `${v}deg`}
        />

        <ParameterSlider
          label={t.turbulence}
          labelZh={TRANSLATIONS.ch.turbulence}
          value={parameters.turbulence}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setParameter('turbulence', v)}
          language={language}
          formatValue={(v) => `${Math.round(v * 100)}%`}
        />

        <ParameterSlider
          label={t.orbitSpeed}
          labelZh={TRANSLATIONS.ch.orbitSpeed}
          value={parameters.orbitSpeed}
          min={0.1}
          max={3}
          step={0.1}
          onChange={(v) => setParameter('orbitSpeed', v)}
          language={language}
          formatValue={(v) => `${v.toFixed(1)}x`}
        />

        <ParameterSlider
          label={t.bloomIntensity}
          labelZh={TRANSLATIONS.ch.bloomIntensity}
          value={parameters.bloomIntensity}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => setParameter('bloomIntensity', v)}
          language={language}
          formatValue={(v) => v.toFixed(1)}
        />

        {mode === 'particles' && (
          <ParameterSlider
            label={t.particleDensity}
            labelZh={TRANSLATIONS.ch.particleDensity}
            value={parameters.particleDensity}
            min={100}
            max={10000}
            step={100}
            onChange={(v) => setParameter('particleDensity', v)}
            language={language}
            formatValue={(v) => `${v}`}
          />
        )}
      </div>

      {/* Reset Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={resetParameters}
        className="w-full mt-4 py-2 glass-button font-mono text-sm text-solar-white"
        aria-label={t.reset}
      >
        {t.reset}
      </motion.button>
    </motion.div>
  );
}