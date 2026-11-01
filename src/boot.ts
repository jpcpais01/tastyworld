import './styles.css';
import './neo/theme.css';
import { holdLanding } from './ui/arrival';
import { peekResume } from './world/cityId';

/**
 * The page's first script, kept tiny. When the page is a reload into another city mid-landing (the plane has just
 * touched down on the page before), the arrival veil goes straight back up, already covering, before the game's
 * code is even parsed, and keeps playing on the compositor while the city is built; the game lifts it once the
 * streets are in and running smoothly. Then (or right away, on any other visit) the game itself loads.
 */
const resume = peekResume();
if (resume && 'board' in resume) {
  const app = document.getElementById('app')!;
  void holdLanding(app, resume.board, !!resume.night).then(() => import('./main'));
} else {
  void import('./main');
}
