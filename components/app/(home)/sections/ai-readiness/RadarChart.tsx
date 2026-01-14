"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface RadarChartProps {
  data: {
    label: string;
    score: number;
    maxScore?: number;
  }[];
  size?: number;
  variant?: 'color' | 'mono';
  showLegend?: boolean;
  disableAnimation?: boolean;
}

export default function RadarChart({ data, size = 300, variant = 'color', showLegend = true, disableAnimation = false }: RadarChartProps) {
  const [isAnimated, setIsAnimated] = useState(disableAnimation ? true : false);
  const center = size / 2;
  const radius = (size / 2) - 60; // Increased padding for labels
  const angleStep = (Math.PI * 2) / data.length;
  
  useEffect(() => {
    if (!disableAnimation) setIsAnimated(true);
  }, [disableAnimation]);
  
  // Calculate points for the polygon
  const getPoint = (value: number, index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };
  
  // Create polygon points string
  const polygonPoints = data
    .map((item, i) => {
      const point = getPoint(isAnimated ? item.score : 0, i);
      return `${point.x},${point.y}`;
    })
    .join(' ');
  
  // Grid levels
  const gridLevels = [20, 40, 60, 80, 100];
  
  return (
    <div className="relative">
      <svg width={size} height={size} className="overflow-visible">
        {variant === 'color' && (
          <defs>
            <linearGradient id="radar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF4A00" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FF8533" stopOpacity="0.3" />
            </linearGradient>
            <filter id="radar-glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        )}
        
        {/* Grid circles */}
        {gridLevels.map((level) => (
          <circle
            key={level}
            cx={center}
            cy={center}
            r={(level / 100) * radius}
            fill="none"
            stroke="rgba(0,0,0,0.05)"
            strokeWidth="1"
          />
        ))}
        
        {/* Axis lines */}
        {data.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke="rgba(0,0,0,0.05)"
              strokeWidth="1"
            />
          );
        })}
        
        {/* Data polygon */}
        <motion.polygon
          points={polygonPoints}
          fill={variant === 'color' ? 'url(#radar-gradient)' : 'rgba(0,0,0,0.10)'}
          stroke={variant === 'color' ? '#FF4A00' : '#111111'}
          strokeWidth="2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          filter={variant === 'color' ? 'url(#radar-glow)' : undefined}
        />
        
        {/* Data points */}
        {data.map((item, i) => {
          const point = getPoint(item.score, i);
          return (
            <motion.circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={variant === 'color' ? '#FF4A00' : '#111111'}
              stroke={variant === 'color' ? 'white' : '#ffffff'}
              strokeWidth="2"
              initial={{ scale: 0 }}
              animate={{ scale: isAnimated ? 1 : 0 }}
              transition={{ delay: 0.8 + i * 0.1, duration: 0.3 }}
            />
          );
        })}
        
        {/* Labels */}
        {data.map((item, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelRadius = radius + 40; // Increased label distance
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle);
          
          // Better text anchor logic based on quadrant
          let textAnchor = "middle";
          let dy = 0;
          
          // Left side
          if (x < center - 20) {
            textAnchor = "end";
          }
          // Right side
          else if (x > center + 20) {
            textAnchor = "start";
          }
          
          // Top
          if (y < center - 20) {
            dy = -5;
          }
          // Bottom
          else if (y > center + 20) {
            dy = 5;
          }
          
          return (
            <motion.g key={i}>
              {/* Background for better readability */}
              <motion.rect
                x={x - (textAnchor === "middle" ? 30 : textAnchor === "end" ? 60 : 0)}
                y={y - 10}
                width={60}
                height={20}
                fill="white"
                fillOpacity={0.9}
                rx={4}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 + i * 0.05 }}
              />
              <motion.text
                x={x}
                y={y + dy}
                textAnchor={textAnchor as any}
                dominantBaseline="middle"
                fill="rgba(0,0,0,0.80)"
                fontSize="10"
                fontWeight="600"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 + i * 0.05 }}
                style={{ pointerEvents: 'none' }}
              >
                {item.label}
              </motion.text>
              {/* Score value */}
              <motion.text
                x={x}
                y={y + dy + 12}
                textAnchor={textAnchor as any}
                dominantBaseline="middle"
                fill={variant === 'color' ? '#FF4A00' : 'rgba(0,0,0,0.70)'}
                fontSize="9"
                fontWeight="700"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 + i * 0.05 }}
                style={{ pointerEvents: 'none' }}
              >
                {item.score}%
              </motion.text>
            </motion.g>
          );
        })}
      </svg>
      
      {/* Legend */}
      {showLegend && (
        <div className="mt-16 flex justify-center">
          <div className="inline-flex flex-row gap-16 text-xs text-black-alpha-48 bg-white px-16 py-8 rounded-6 shadow-sm">
            <div className="flex items-center gap-8">
              <div className={`w-12 h-12 rounded-full ${variant === 'color' ? 'bg-heat-200' : 'bg-black'}`} />
              <span className="whitespace-nowrap">80-100%</span>
            </div>
            <div className="flex items-center gap-8">
              <div className={`w-12 h-12 rounded-full ${variant === 'color' ? 'bg-heat-100' : 'bg-black-alpha-64'}`} />
              <span className="whitespace-nowrap">60-79%</span>
            </div>
            <div className="flex items-center gap-8">
              <div className={`w-12 h-12 rounded-full ${variant === 'color' ? 'bg-heat-50' : 'bg-black-alpha-32'}`} />
              <span className="whitespace-nowrap">&lt;60%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}