import { motion } from 'framer-motion';
import type { ParameterSliderProps } from '../../types';

export default function ParameterSlider({
  label,
  labelZh,
  value,
  min,
  max,
  step,
  onChange,
  language,
  formatValue,
}: ParameterSliderProps) {
  const displayLabel = language === 'ch' ? labelZh : label;
  const displayValue = formatValue ? formatValue(value) : value.toString();

  // Calculate percentage for visual slider
  const percentage = ((value - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  };

  return (
    <div className="space-y-1">
      {/* Label and value display */}
      <div className="flex justify-between items-center">
        <label className="font-body text-xs text-solar-white/80">
          {displayLabel}
        </label>
        <span className="font-mono text-xs text-nebula-violet">
          {displayValue}
        </span>
      </div>

      {/* Slider track and thumb */}
      <div className="relative h-1.5 rounded-full bg-glass-base">
        {/* Filled portion */}
        <motion.div
          className="absolute h-full rounded-full bg-nebula-violet/50"
          style={{ width: `${percentage}%` }}
          layout
        />

        {/* Input slider (invisible, handles interaction) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={displayLabel}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
        />

        {/* Visual thumb */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-solar-white shadow-glow-violet"
          style={{ left: `${percentage}%`, marginLeft: '-6px' }}
          whileHover={{ scale: 1.2 }}
          layout
        />
      </div>
    </div>
  );
}