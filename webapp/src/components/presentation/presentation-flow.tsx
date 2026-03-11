"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { slides } from "./presentation-data";
import { PresentationSlideView } from "./presentation-slide";
import { SlideNavigation } from "./slide-navigation";

export function PresentationFlow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 = left, 1 = right

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= slides.length || index === currentIndex) return;
      setDirection(index > currentIndex ? 1 : -1);
      setCurrentIndex(index);
    },
    [currentIndex],
  );

  const prev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  const slide = slides[currentIndex];

  return (
    <div className="flex flex-col h-full">
      {/* Slide content */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <PresentationSlideView slide={slide} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <SlideNavigation
        current={currentIndex}
        total={slides.length}
        onPrev={prev}
        onNext={next}
        onGoTo={goTo}
      />
    </div>
  );
}
