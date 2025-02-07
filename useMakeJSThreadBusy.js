import { useEffect } from "react";

const useMakeJSThreadBusy = (shouldBlock = false, duration = 5000) => {
  useEffect(() => {
    if (shouldBlock) {
      const start = Date.now();
      while (Date.now() - start < duration) {
        // Busy-wait loop to block the JS thread
      }
    }
  }, [shouldBlock, duration]);
};

export default useMakeJSThreadBusy;
