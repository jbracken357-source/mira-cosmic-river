import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBinaryStar, useParameters, useMobile } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  formatValue?: (v: number) => string;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step, onChange, formatValue }) => (
  <div className="flex flex-col gap-2 group">
    <div className="flex justify-between items-end">
      <span className="text-[10px] uppercase tracking-wider text-white/60">{label}</span>
      <span className="text-[10px] font-mono text-orange-400/80">
        {formatValue ? formatValue(value) : value.toFixed(2)}
      </span>
    </div>
    <div className="relative h-4 flex items-center cursor-pointer">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 z-10 w-full opacity-0 cursor-pointer"
      />
      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500/50 to-orange-400 transition-all"
          style={{ width: `${((value - min) / (max - min)) * 100}%` }}
        />
      </div>
      <div
        className="absolute w-3 h-3 bg-white rounded-full shadow-lg pointer-events-none transition-all group-hover:scale-125"
        style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 6px)` }}
      />
    </div>
  </div>
);

export default function ControlPanel() {
  const [activeTab, setActiveTab] = useState<'SYSTEM' | 'ENVIRONMENT'>('SYSTEM');
  const [isExpanded, setIsExpanded] = useState(false);
  const language = useBinaryStar((state) => state.language);
  const parameters = useParameters();
  const isMobile = useMobile();
  const setParameter = useBinaryStar((state) => state.setParameter);
  const resetParameters = useBinaryStar((state) => state.resetParameters);
  const mode = useBinaryStar((state) => state.mode);
  const setMode = useBinaryStar((state) => state.setMode);

  const t = TRANSLATIONS[language];

  const modes = [
    { mode: 'glow', label: 'GLOW' },
    { mode: 'wave', label: 'WAVE' },
    { mode: 'particles', label: 'PARTICLES' },
  ] as const;

  // Mobile: render as bottom sheet
  if (isMobile) {
    return (
      <>
        {/* Collapsed trigger bar - always visible at bottom */}
        <motion.div
          onClick={() => setIsExpanded(!isExpanded)}
          className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-3xl bg-[#0a0612]/80 border-t border-white/10 px-4 py-3 md:hidden pointer-events-auto cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-white/60">Settings</span>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="w-5 h-5 text-white/40"
            >
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </motion.div>
          </div>
        </motion.div>

        {/* Expanded bottom sheet */}
        <AnimatePresence>
          {isExpanded && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsExpanded(false)}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              />

              {/* Sheet content */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto backdrop-blur-3xl bg-[#0a0612]/95 border-t border-white/10 rounded-t-3xl md:hidden pointer-events-auto"
              >
                <div className="p-4">
                  {/* Handle bar */}
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

                  {/* Tabs */}
                  <div className="flex border-b border-white/5 mb-4">
                    {(['SYSTEM', 'ENVIRONMENT'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 text-[9px] tracking-widest font-medium transition-colors relative ${
                          activeTab === tab ? 'text-orange-400' : 'text-white/40 hover:text-white/70'
                        }`}
                      >
                        {tab === 'SYSTEM' ? t.systemTab : t.environmentTab}
                        {activeTab === tab && (
                          <motion.div
                            layoutId="activeTab"
                            className="absolute bottom-0 inset-x-0 h-0.5 bg-orange-400"
                          />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Content */}
                  <div className="min-h-[300px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-4"
                      >
                        {activeTab === 'SYSTEM' && (
                          <>
                            <div className="space-y-3">
                              <h3 className="text-[9px] uppercase tracking-widest text-white/30 font-bold">
                                {t.miraA}
                              </h3>
                              <Slider
                                label={t.primaryColor}
                                value={parameters.primaryColor}
                                min={0}
                                max={360}
                                step={1}
                                onChange={(v) => setParameter('primaryColor', v)}
                                formatValue={(v) => `${v}°`}
                              />
                              <Slider
                                label={t.stellarBreath}
                                value={parameters.turbulence}
                                min={0}
                                max={1}
                                step={0.01}
                                onChange={(v) => setParameter('turbulence', v)}
                                formatValue={(v) => `${Math.round(v * 100)}%`}
                              />
                            </div>
                            <div className="w-full h-px bg-white/5" />
                            <div className="space-y-3">
                              <h3 className="text-[9px] uppercase tracking-widest text-white/30 font-bold">
                                {t.miraB}
                              </h3>
                              <Slider
                                label={t.secondaryColor}
                                value={parameters.secondaryColor}
                                min={180}
                                max={300}
                                step={1}
                                onChange={(v) => setParameter('secondaryColor', v)}
                                formatValue={(v) => `${v}°`}
                              />
                              <Slider
                                label={t.cosmicDance}
                                value={parameters.orbitSpeed}
                                min={0.1}
                                max={3}
                                step={0.1}
                                onChange={(v) => setParameter('orbitSpeed', v)}
                                formatValue={(v) => `${v.toFixed(1)}x`}
                              />
                            </div>
                            <div className="w-full h-px bg-white/5" />
                            <div className="space-y-3">
                              <h3 className="text-[9px] uppercase tracking-widest text-white/30 font-bold">
                                {t.displayMode}
                              </h3>
                              <div className="flex gap-2">
                                {modes.map(({ mode: m, label }) => (
                                  <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`flex-1 py-2 rounded-lg text-[9px] tracking-widest font-medium transition-all ${
                                      mode === m
                                        ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/30'
                                        : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {activeTab === 'ENVIRONMENT' && (
                          <div className="space-y-3">
                            <Slider
                              label={t.stardustDensity}
                              value={parameters.particleDensity}
                              min={100}
                              max={10000}
                              step={100}
                              onChange={(v) => setParameter('particleDensity', v)}
                            />
                            <div className="w-full h-px bg-white/5" />
                            <Slider
                              label={t.starlightGlow}
                              value={parameters.bloomIntensity}
                              min={0}
                              max={3}
                              step={0.1}
                              onChange={(v) => setParameter('bloomIntensity', v)}
                              formatValue={(v) => v.toFixed(1)}
                            />
                            <div className="w-full h-px bg-white/5" />
                            <Slider
                              label={t.autoRotate}
                              value={0.5}
                              min={0}
                              max={2}
                              step={0.1}
                              onChange={() => {}}
                              formatValue={(v) => v.toFixed(1)}
                            />
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Reset Button */}
                  <div className="mt-4 pb-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={resetParameters}
                      className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-[9px] uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
                    >
                      {t.reset}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Desktop: render as fixed side panel

  // Desktop: render as fixed side panel
  return (
    <div className="w-80 backdrop-blur-3xl bg-[#0a0612]/60 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto">
      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {(['SYSTEM', 'ENVIRONMENT'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-4 text-[10px] tracking-widest font-medium transition-colors hover:bg-white/5 relative ${
              activeTab === tab ? 'text-orange-400' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab === 'SYSTEM' ? t.systemTab : t.environmentTab}
            {activeTab === tab && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-orange-400 shadow-[0_-2px_10px_rgba(255,100,50,0.5)]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-6"
          >
            {activeTab === 'SYSTEM' && (
              <>
                <div className="space-y-4">
                  <h3 className="text-xs uppercase tracking-widest text-white/30 font-bold mb-2">
                    {t.miraA}
                  </h3>
                  <Slider
                    label={t.primaryColor}
                    value={parameters.primaryColor}
                    min={0}
                    max={360}
                    step={1}
                    onChange={(v) => setParameter('primaryColor', v)}
                    formatValue={(v) => `${v}°`}
                  />
                  <Slider
                    label={t.stellarBreath}
                    value={parameters.turbulence}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setParameter('turbulence', v)}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                  />
                </div>
                <div className="w-full h-px bg-white/5 my-2" />
                <div className="space-y-4">
                  <h3 className="text-xs uppercase tracking-widest text-white/30 font-bold mb-2">
                    {t.miraB}
                  </h3>
                  <Slider
                    label={t.secondaryColor}
                    value={parameters.secondaryColor}
                    min={180}
                    max={300}
                    step={1}
                    onChange={(v) => setParameter('secondaryColor', v)}
                    formatValue={(v) => `${v}°`}
                  />
                  <Slider
                    label={t.cosmicDance}
                    value={parameters.orbitSpeed}
                    min={0.1}
                    max={3}
                    step={0.1}
                    onChange={(v) => setParameter('orbitSpeed', v)}
                    formatValue={(v) => `${v.toFixed(1)}x`}
                  />
                </div>
                <div className="w-full h-px bg-white/5 my-2" />
                <div className="space-y-4">
                  <h3 className="text-xs uppercase tracking-widest text-white/30 font-bold mb-2">
                    {t.displayMode}
                  </h3>
                  <div className="flex gap-2">
                    {modes.map(({ mode: m, label }) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex-1 py-3 rounded-xl text-[10px] tracking-widest font-medium transition-all ${
                          mode === m
                            ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/30 scale-105'
                            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'ENVIRONMENT' && (
              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-widest text-white/30 font-bold mb-2">
                  {t.environmentTab}
                </h3>
                <Slider
                  label={t.stardustDensity}
                  value={parameters.particleDensity}
                  min={100}
                  max={10000}
                  step={100}
                  onChange={(v) => setParameter('particleDensity', v)}
                />

                <div className="w-full h-px bg-white/5 my-2" />
                <Slider
                  label={t.starlightGlow}
                  value={parameters.bloomIntensity}
                  min={0}
                  max={3}
                  step={0.1}
                  onChange={(v) => setParameter('bloomIntensity', v)}
                  formatValue={(v) => v.toFixed(1)}
                />

                <div className="w-full h-px bg-white/5 my-2" />
                <h3 className="text-xs uppercase tracking-widest text-white/30 font-bold mb-2">
                  {t.autoRotate}
                </h3>
                <Slider
                  label={t.autoRotate}
                  value={0.5}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={() => {}}
                  formatValue={(v) => v.toFixed(1)}
                />
                <div className="my-4 p-4 rounded-xl bg-white/5 text-[10px] text-white/50 italic leading-relaxed">
                  Interactive controls allow for manual zooming and orbiting. Use this slider to adjust automatic rotation speed.
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Reset Button */}
      <div className="px-6 pb-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={resetParameters}
          className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
        >
          {t.reset}
        </motion.button>
      </div>
    </div>
  );
}
