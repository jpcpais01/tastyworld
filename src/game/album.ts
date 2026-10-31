/**
 * The photo album: snapshots from photo mode, kept in IndexedDB (pictures are far too big for the
 * localStorage save). Each photo keeps a small thumbnail beside the full picture so the album page
 * never has to decode the big ones.
 */
export interface Photo {
  id: number;
  /** When it was taken (ms since epoch). */
  t: number;
  place: string;
  clock: string;
  w: number;
  h: number;
  blob: Blob;
  thumb: Blob;
}

/** Plenty for a trip; past this the oldest have to go before new ones fit. */
export const ALBUM_MAX = 120;

const DB = 'tastyworld-album';
const STORE = 'photos';
let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => { opening = null; throw e; });
  return opening;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export const album = {
  add: (p: Omit<Photo, 'id'>) => run('readwrite', (s) => s.add(p)).then((id) => id as number),
  /** Newest first. */
  list: () => run<Photo[]>('readonly', (s) => s.getAll()).then((all) => all.sort((a, b) => b.t - a.t)),
  count: () => run('readonly', (s) => s.count()),
  remove: (id: number) => run('readwrite', (s) => s.delete(id)).then(() => {}),
};

/** A file name like "tasty-world-2026-10-31-1842.jpg". */
export function photoName(p: Pick<Photo, 't'>): string {
  const d = new Date(p.t), two = (n: number) => String(n).padStart(2, '0');
  return `tasty-world-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}.jpg`;
}

/** Hands a photo to the system share sheet when it can take files (phones), otherwise downloads it. */
export async function sharePhoto(p: Pick<Photo, 't' | 'blob' | 'place'>, share = true): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([p.blob], photoName(p), { type: 'image/jpeg' });
  if (share && canShareFiles()) {
    try {
      await navigator.share({ files: [file], title: `Tasty World · ${p.place}` });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // fall through to a download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'saved';
}

export function canShareFiles(): boolean {
  try {
    return !!navigator.canShare?.({ files: [new File([new Blob()], 'x.jpg', { type: 'image/jpeg' })] });
  } catch {
    return false;
  }
}
