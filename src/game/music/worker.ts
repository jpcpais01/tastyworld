/// <reference lib="webworker" />
/**
 * Renders the lo-fi band's sounds off the main thread. Gets a list of keys, sends each one back as it is done (the
 * samples are transferred, not copied), in the order asked, so the tune that is about to play comes first.
 */
import { renderSound } from './instruments';

self.onmessage = (e: MessageEvent<string[]>) => {
  for (const key of e.data) {
    const p = renderSound(key);
    (self as unknown as Worker).postMessage({ key, data: p.data, sr: p.sr }, [p.data.buffer]);
  }
};
