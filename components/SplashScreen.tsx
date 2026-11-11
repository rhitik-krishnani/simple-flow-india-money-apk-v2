import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogo } from './BrandLogo';
import { translations, Language } from '../translations';

interface SplashScreenProps {
  lang: Language;
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ lang, onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const t = translations[lang];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Wait for exit animation before calling onComplete
      setTimeout(onComplete, 500);
    }, 1200);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black overflow-hidden"
        >
          {/* Animated Background Gradients */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
                x: [0, 50, 0],
                y: [0, -30, 0]
              }}
              transition={{ duration: 10, repeat: Infinity }}
              className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/30 blur-[120px]"
            />
            <motion.div 
              animate={{ 
                scale: [1.2, 1, 1.2],
                opacity: [0.3, 0.5, 0.3],
                x: [0, -40, 0],
                y: [0, 60, 0]
              }}
              transition={{ duration: 12, repeat: Infinity }}
              className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-600/30 blur-[120px]"
            />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {/* Logo Animation */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ 
                duration: 1, 
                ease: "easeOut",
                type: "spring",
                stiffness: 100 
              }}
              className="mb-8"
            >
              <BrandLogo size={120} />
            </motion.div>

            {/* Title Animation */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-3xl md:text-5xl font-display font-black text-white tracking-tight mb-6 text-center px-4 whitespace-nowrap"
            >
              {t.assetForge}
            </motion.h1>

            {/* Tagline Animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 1 }}
              className="flex flex-col items-center gap-2"
            >
              <p className="text-emerald-400 font-black uppercase tracking-[0.3em] text-[10px]">
                {t.primaryTagline}
              </p>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 1.2, duration: 1 }}
                className="h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"
              />
            </motion.div>
          </div>

          {/* Loading Indicator */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-16 flex items-center gap-2"
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{ 
                    duration: 1, 
                    repeat: Infinity, 
                    delay: i * 0.2 
                  }}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                />
              ))}
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              Initializing Secure Environment
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
