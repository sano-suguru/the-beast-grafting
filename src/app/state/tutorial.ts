import { signal, effect } from "@preact/signals";
import { safeGetItem, safeSetItem } from "./storage";

const STORAGE_KEY = "beastGrafterTutorialDone";

function loadTutorialDone(): boolean {
  return safeGetItem(STORAGE_KEY) === "1";
}

export const tutorialDone = signal(loadTutorialDone());

effect(() => {
  if (tutorialDone.value) {
    safeSetItem(STORAGE_KEY, "1");
  }
});

export function markTutorialDone() {
  tutorialDone.value = true;
}
