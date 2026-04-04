import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

const DELAY_MS = 300;

/** Returns a signal that turns true only after `flag` has been true for `DELAY_MS`. */
export function useDelayedFlag(flag: boolean) {
  const delayed = useSignal(false);
  useEffect(() => {
    if (!flag) {
      delayed.value = false;
      return;
    }
    const id = setTimeout(() => {
      delayed.value = true;
    }, DELAY_MS);
    return () => clearTimeout(id);
  }, [flag]);
  return delayed;
}
