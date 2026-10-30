'use client';

import React, { useState } from 'react';
import { ChevronDownIcon } from '@/components/ui/icons';

export function TrendChart() {
  const [selectedRange, setSelectedRange] = useState('Feb 01 - Feb 14');
  const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(9); // Default hover on Feb 10 matching Image 1

  const dates = ['Feb 01', 'Feb 02', 'Feb 03', 'Feb 04', 'Feb 05', 'Feb 06', 'Feb 07', 'Feb 08', 'Feb 09', 'Feb 10', 'Feb 11', 'Feb 12', 'Feb 13'];

  // Normalized values matching Reference Image 1 curves (0-500 scale)
  const pendingData = [220, 260, 240, 270, 310, 400, 380, 410, 370, 375, 250, 320, 440];
  const inProgressData = [160, 220, 200, 210, 320, 360, 340, 370, 310, 320, 190, 260, 380];

  const yTicks = [500, 400, 300, 200, 100, 0];

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 240;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const getX = (index: number) => paddingLeft + (index / (dates.length - 1)) * plotWidth;
  const getY = (val: number) => paddingTop + plotHeight - (val / 500) * plotHeight;

  // Generate SVG path string with smooth curves
  const generatePath = (data: number[]) => {
    return data.reduce((acc, val, i, arr) => {
      const x = getX(i);
      const y = getY(val);
      if (i === 0) return `M ${x} ${y}`;
      const prevX = getX(i - 1);
      const prevY = getY(arr[i - 1]);
      const cpX1 = prevX + (x - prevX) / 2;
      const cpY1 = prevY;
      const cpX2 = prevX + (x - prevX) / 2;
      const cpY2 = y;
      return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
    }, '');
  };

  const pendingPath = generatePath(pendingData);
  const inProgressPath = generatePath(inProgressData);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-subtle space-y-4 transition-colors">
      {/* Chart Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          Total Complaints Trend
        </h3>

        <div className="flex items-center gap-4">
          {/* Legend Pill Card */}
          <div className="flex items-center gap-4 text-xs font-semibold bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 bg-[#0B4FC2] dark:bg-blue-400 rounded-full" />
              <span className="text-slate-600 dark:text-slate-400">Pending</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">231</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 bg-[#0284C7] dark:bg-cyan-400 rounded-full" />
              <span className="text-slate-600 dark:text-slate-400">In Progress</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">43</span>
            </div>
          </div>

          {/* Date Range Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setRangeDropdownOpen(!rangeDropdownOpen)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors"
            >
              <span>{selectedRange}</span>
              <ChevronDownIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            </button>
            {rangeDropdownOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-elevated border border-slate-200 dark:border-slate-700 py-1 z-30 text-xs font-medium">
                {['Feb 01 - Feb 14', 'Jan 15 - Jan 31', 'Past 30 Days'].map((rng) => (
                  <button
                    key={rng}
                    type="button"
                    onClick={() => { setSelectedRange(rng); setRangeDropdownOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    {rng}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[650px] overflow-visible"
        >
          {/* Y Axis Grid Lines & Labels */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-slate-100 dark:text-slate-800"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 dark:fill-slate-400 font-mono"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Area under Curves */}
          <path
            d={`${pendingPath} L ${getX(dates.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`}
            fill="url(#pendingGradient)"
            opacity="0.15"
          />

          {/* Linear Gradients */}
          <defs>
            <linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0B4FC2" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0B4FC2" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="inProgressGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284C7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Curve 1: Pending (Royal Blue) */}
          <path
            d={pendingPath}
            fill="none"
            stroke="#0B4FC2"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Curve 2: In Progress (Cyan / Light Blue) */}
          <path
            d={inProgressPath}
            fill="none"
            stroke="#0284C7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="2 0"
          />

          {/* X Axis Labels & Data Point Circles */}
          {dates.map((date, idx) => {
            const x = getX(idx);
            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={date}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
              >
                {/* Vertical hover indicator line */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={svgHeight - paddingBottom}
                    stroke="#0B4FC2"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />
                )}

                {/* Data point circle: Pending */}
                <circle
                  cx={x}
                  cy={getY(pendingData[idx])}
                  r={isHovered ? 4.5 : 3}
                  fill="#0B4FC2"
                  stroke="#FFFFFF"
                  strokeWidth={isHovered ? 2 : 1}
                  className="transition-all"
                />

                {/* X Axis Date Label */}
                <text
                  x={x}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  className={`text-[10px] font-mono transition-colors ${
                    isHovered
                      ? 'fill-[#0B4FC2] font-bold'
                      : 'fill-slate-400 dark:fill-slate-400'
                  }`}
                >
                  {date}
                </text>
              </g>
            );
          })}

          {/* Dynamic Interactive Tooltip matching Reference Image 1 on hovered point */}
          {hoveredIndex !== null && (
            <g
              transform={`translate(${Math.min(
                Math.max(getX(hoveredIndex) - 45, paddingLeft),
                svgWidth - paddingRight - 90
              )}, ${getY(pendingData[hoveredIndex]) - 40})`}
              className="pointer-events-none transition-transform"
            >
              <rect
                width="90"
                height="32"
                rx="6"
                fill="#0F172A"
                className="shadow-elevated"
              />
              <text
                x="45"
                y="14"
                textAnchor="middle"
                fill="#FFFFFF"
                className="text-[9px] font-mono font-bold"
              >
                {dates[hoveredIndex]}: {pendingData[hoveredIndex]} complaints
              </text>
              <text
                x="45"
                y="24"
                textAnchor="middle"
                fill="#94A3B8"
                className="text-[8px] font-mono"
              >
                In Prog: {inProgressData[hoveredIndex]}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
