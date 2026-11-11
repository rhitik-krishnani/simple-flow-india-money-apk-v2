import React from 'react';
import { motion } from 'motion/react';

interface BrandLogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, className = "", animate = true }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="main-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="40%" stopColor="#0d9488" />
            <stop offset="70%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Minimalist Bold Rupee Symbol ₹ */}
        <motion.path
          initial={animate ? { pathLength: 0, opacity: 0 } : {}}
          animate={animate ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          d="M30 20 H70 M30 36 H70 M70 20 C70 20 35 20 35 55 C35 55 40 55 65 55 L35 95"
          stroke="url(#main-grad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />
        
        {/* Subtle Growth Arrow overlay */}
        <motion.path
           initial={animate ? { pathLength: 0, opacity: 0 } : {}}
           animate={animate ? { pathLength: 1, opacity: 0.6 } : {}}
           transition={{ delay: 1, duration: 1 }}
           d="M60 90 C75 80 85 60 85 30 L78 38 M85 30 L92 38"
           stroke="#fbbf24"
           strokeWidth="6"
           strokeLinecap="round"
           strokeLinejoin="round"
        />

      </svg>
      
      {/* Outer Glow for animation */}
      {animate && (
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full -z-10"
        />
      )}
    </div>
  );
};
