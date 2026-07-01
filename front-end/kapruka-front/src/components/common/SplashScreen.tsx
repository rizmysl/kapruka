import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import aylaBotVideo from '../../assets/AylaBot.mp4';

interface SplashScreenProps {
  onEnter: (enableSound: boolean) => void;
}

export default function SplashScreen({ onEnter }: SplashScreenProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleEnter = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      onEnter(soundEnabled);
    }, 900); // Match transition duration (0.9s)
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30">
      {/* Premium background radial ambient light */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.12)_0%,rgba(9,9,11,0)_70%)] pointer-events-none" />
      
      {/* Animated subtle floating background orbs */}
      <motion.div 
        animate={{
          y: [-10, 10, -10],
          x: [-5, 5, -5]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"
      />
      <motion.div 
        animate={{
          y: [10, -10, 10],
          x: [5, -5, 5]
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-pink-500/5 blur-[120px] pointer-events-none"
      />

      <AnimatePresence mode="wait">
        {!isTransitioning ? (
          <motion.div 
            key="splash-content"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: "easeIn" }}
            className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center"
          >
            {/* Glowing avatar wrapper with breathing ring animation */}
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="relative mb-8"
            >
              {/* Outer glowing pulsing rings */}
              <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl scale-110 animate-pulse duration-[3000ms]" />
              
              <motion.div 
                layoutId="video-portal"
                style={{ borderRadius: '9999px' }}
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-28 h-28 rounded-full p-[3px] bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 shadow-2xl overflow-hidden"
              >
                <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-950/20">
                  <video 
                    src={aylaBotVideo} 
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover transform scale-105 rounded-full"
                  />
                </div>
              </motion.div>
            </motion.div>

            {/* Elegant Serif Title */}
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
              className="text-6xl font-light tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-white via-indigo-100 to-slate-300 mb-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]"
            >
              Ayla
            </motion.h1>

            {/* Subtitle with premium shimmer */}
            <motion.p 
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-xs font-semibold tracking-[0.3em] uppercase text-indigo-300/80 mb-10"
            >
              Kapruka AI Gift Concierge
            </motion.p>

            {/* Dynamic interactive sound selection card */}
            <motion.div 
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="w-full mb-8 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-white/[0.08]"
            >
              <div className="text-left">
                <h4 className="text-xs font-bold text-slate-200">Ambient Soundtrack</h4>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Featuring "Precision Mode" audio</p>
              </div>
              
              <button 
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="relative flex items-center justify-center cursor-pointer p-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-900 transition-colors"
              >
                {soundEnabled ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                  </svg>
                )}
              </button>
            </motion.div>

            {/* Elegant premium trigger CTA button */}
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              whileHover={{ scale: 1.03, boxShadow: "0 0 25px rgba(99, 102, 241, 0.4)" }}
              whileTap={{ scale: 0.97 }}
              onClick={handleEnter}
              className="relative w-full py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 rounded-xl font-bold text-sm tracking-widest uppercase cursor-pointer shadow-[0_4px_20px_rgba(99,102,241,0.25)] hover:from-indigo-500 hover:to-indigo-500 transition-all duration-300 overflow-hidden group"
            >
              Enter Experience
            </motion.button>

            {/* Small footer credits */}
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 1.1, duration: 1 }}
              className="text-[10px] tracking-wider uppercase text-slate-500 mt-12"
            >
              Kapruka Customer Service Companion
            </motion.p>
          </motion.div>
        ) : (
          <motion.div 
            key="portal-video"
            layoutId="video-portal"
            style={{ borderRadius: '0px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 overflow-hidden bg-slate-950"
          >
            <video 
              src={aylaBotVideo} 
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
