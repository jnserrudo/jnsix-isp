import React, { useEffect, useState } from 'react';

interface TopProgressBarProps {
  loading: boolean;
}

/**
 * Thin 2px bar fixed at the very top of the screen.
 * Grows from 0 → 80% while `loading` is true, then rapidly completes to 100% and fades out.
 * This gives instant visual feedback that "something is happening" without blocking the UI.
 */
const TopProgressBar: React.FC<TopProgressBarProps> = ({ loading }) => {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    let growTimer: ReturnType<typeof setTimeout>;
    let fadeTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;

    if (loading) {
      // Start bar
      setVisible(true);
      setOpacity(1);
      setWidth(0);

      // Quickly jump to 15%, then slowly creep to 80%
      growTimer = setTimeout(() => setWidth(15), 30);
      const slowGrow = setTimeout(() => setWidth(55), 300);
      const slowerGrow = setTimeout(() => setWidth(78), 900);

      return () => {
        clearTimeout(growTimer);
        clearTimeout(slowGrow);
        clearTimeout(slowerGrow);
      };
    } else {
      // Complete to 100%
      setWidth(100);

      // Fade out after completion
      fadeTimer = setTimeout(() => setOpacity(0), 300);
      hideTimer = setTimeout(() => {
        setVisible(false);
        setWidth(0);
        setOpacity(1);
      }, 700);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [loading]);

  if (!visible) return null;

  return (
    <div
      className="top-progress-bar"
      style={{
        width: `${width}%`,
        opacity,
      }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
    />
  );
};

export default TopProgressBar;
