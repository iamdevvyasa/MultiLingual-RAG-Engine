import { motion } from "motion/react";
import OrbFace from "./OrbFace";

function OrbVisual({
  isListening = false,
  level = 0,
  compact = false,
}) {
  return (
    <div
      aria-hidden="true"
      className="relative h-full w-full"
    >
      {/* Ambient glow */}
      <motion.div
        className="
          absolute
          inset-[5%]
          z-0
          rounded-full
          bg-[#52616B]/15
          blur-[36px]
        "
        animate={{
          scale: isListening
            ? 1 + level * 0.12
            : [1, 1.04, 1],

          opacity: isListening
            ? 0.35 + level * 0.3
            : [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: isListening ? 0.12 : 3.5,
          repeat: isListening ? 0 : Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Orb body */}
      <motion.div
        className="
          absolute
          inset-0
          z-10
          h-full
          w-full
          rounded-full
          bg-gradient-to-br from-[#687983] to-[#46545D]
          shadow-[0_12px_30px_rgba(47,62,70,0.18)]
          border
          border-[#D8DEE1]/70
          select-none
        "
        animate={{
          y: isListening
            ? level * -4
            : [0, -2, 0, 2, 0],

          scale: isListening
            ? 1 + level * 0.025
            : 1,
        }}
        transition={{
          duration: isListening ? 0.12 : 4,
          repeat: isListening ? 0 : Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-[7%] z-20 rounded-full border border-[#D8DEE1]/45"
        animate={{
          rotate: isListening ? 360 : [0, 360],
          scale: isListening ? 1 + level * 0.04 : [1, 1.03, 1],
        }}
        transition={{
          rotate: { duration: isListening ? 5 : 14, repeat: Infinity, ease: "linear" },
          scale: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {/* Face */}
      <div className="absolute inset-0 z-30">
        <OrbFace
          level={level}
          isListening={isListening}
          compact={compact}
        />
      </div>
    </div>
  );
}

export default OrbVisual;