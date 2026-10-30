import React from 'react';

export interface CircularGaugeProps {
  percentage: number;
  label?: string;
  target?: string;
  size?: number;
  strokeWidth?: number;
  strokeColor?: string;
}

export function CircularGauge({
  percentage,
  label = 'Service Level',
  target = 'Target 75%',
  size = 130,
  strokeWidth = 10,
  strokeColor = '#10B981', // Emerald green matching Reference Image 1
}: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-200 dark:text-slate-800 transition-colors"
        />
        {/* Progress stroke circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Centered text display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
          {label}
        </span>
        <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight leading-none mt-0.5">
          {percentage}%
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium mt-0.5">
          {target}
        </span>
      </div>
    </div>
  );
}
