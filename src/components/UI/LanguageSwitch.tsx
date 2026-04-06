import { motion } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import type { Language } from '../../types';

const LANGUAGE_LABELS: Record<Language, Record<Language, string>> = {
  en: { en: 'EN', ch: 'CH' },
  ch: { en: '英文', ch: '中文' },
};

export default function LanguageSwitch() {
  const language = useBinaryStar((state) => state.language);
  const setLanguage = useBinaryStar((state) => state.setLanguage);

  const labels = LANGUAGE_LABELS[language];

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ch' : 'en');
  };

  return (
    <motion.button
      onClick={toggleLanguage}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="px-2 py-1 glass-button font-mono text-xs"
      aria-label={`Switch language: ${labels[language]}`}
    >
      {labels[language]}
    </motion.button>
  );
}