import type { Look } from '../world/characters';
import type { NeoLife } from './state';

/**
 * Halcyon's clothes: named pieces sold in the boutiques, each a slot and a patch on the body's look. Buying one
 * keeps it in the wardrobe for good; wearing it swaps out whatever was in that slot.
 */

export type Slot = 'top' | 'legs' | 'shoes' | 'head' | 'eyes' | 'bag';
export const SLOT_NAME: Record<Slot, string> = { top: 'Tops', legs: 'Legs', shoes: 'Shoes', head: 'Headwear', eyes: 'Eyewear', bag: 'Bags' };

export interface Garment {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  /** What it changes on the body. */
  patch: Partial<Look>;
  /** Swatch colours for the card: main and trim. */
  sw: [number, number];
  text: string;
}

export type BoutiqueKind = 'street' | 'corpo' | 'tech' | 'thrift';

export interface Boutique {
  kind: BoutiqueKind;
  /** Shop names (the n-th boutique of a kind takes the n-th name) and their keepers. */
  names: string[];
  keepers: string[];
  keeperLook: Partial<Look>;
  label: string;
  lines: string[];
  stock: string[];
}

const g = (id: string, name: string, slot: Slot, price: number, patch: Partial<Look>, sw: [number, number], text: string): Garment => ({ id, name, slot, price, patch, sw, text });

export const GARMENTS: Garment[] = [
  // street
  g('rainshell', 'Rainshell jacket', 'top', 120, { topStyle: 'jacket', top: 0x1a2a4a, accent: 0x2ad8ff }, [0x1a2a4a, 0x2ad8ff], 'Taped seams, cyan piping that glows after dark. Halcyon\'s uniform.'),
  g('pinkbomber', 'Hot pink bomber', 'top', 140, { topStyle: 'jacket', top: 0xff5fb4, accent: 0x16161c }, [0xff5fb4, 0x16161c], 'Loud on purpose. Pairs with black everything.'),
  g('glowtee', 'Glow-print tee', 'top', 45, { topStyle: 'tee', top: 0x16161c, accent: 0x7dffa8 }, [0x16161c, 0x7dffa8], 'A circuit print that charges in daylight and glows all night.'),
  g('cargo', 'Cargo pants', 'legs', 70, { bottom: 0x2a2a34, skirt: false, shorts: false }, [0x2a2a34, 0x5a5a62], 'Nine pockets. You will lose things in all of them.'),
  g('pleat', 'Vinyl pleat skirt', 'legs', 85, { bottom: 0x16161c, skirt: true, shorts: false }, [0x16161c, 0xa47bff], 'Shines like a puddle under the neon.'),
  g('hightops', 'Neon hi-tops', 'shoes', 95, { shoes: 0x2ad8ff }, [0x2ad8ff, 0xf2efe7], 'Light up when you run. Mostly when you run.'),
  g('snapcap', 'Snapback, Halo logo', 'head', 35, { hat: 'cap', hatColor: 0x16161c }, [0x16161c, 0x2ad8ff], 'The Halo ring stitched in reflective thread.'),
  g('slingpack', 'Courier sling', 'bag', 60, { backpack: 0xff9a4a }, [0xff9a4a, 0x16161c], 'Waterproof, slash-proof, holds two bao and a cat.'),
  // corpo
  g('helixsuit', 'Graphite suit', 'top', 380, { topStyle: 'suit', top: 0x2a2a34, accent: 0xf2efe7 }, [0x2a2a34, 0xf2efe7], 'Cut by a machine in Zurich, pressed by a person in Halcyon.'),
  g('whitesuit', 'Ivory suit, gold pin', 'top', 520, { topStyle: 'suit', top: 0xf2efe7, accent: 0xc8a040 }, [0xf2efe7, 0xc8a040], 'For people who never have to walk in the rain.'),
  g('slacks', 'Tailored slacks', 'legs', 160, { bottom: 0x16161c, skirt: false, shorts: false }, [0x16161c, 0x2a2a34], 'A crease you could cut synth-fruit with.'),
  g('oxfords', 'Black oxfords', 'shoes', 210, { shoes: 0x16161c }, [0x16161c, 0x2a2a34], 'They click on marble. That is the point.'),
  g('aviators', 'Mirror aviators', 'eyes', 180, { glasses: true }, [0x9fa4a9, 0xf2efe7], 'Nobody can read your eyes. Nobody can read your mood.'),
  g('briefcase', 'Carbon case', 'bag', 240, { backpack: 0x2a2a34 }, [0x2a2a34, 0x5a5a62], 'Holds a terminal, a contract and a protein bar.'),
  // tech
  g('netvest', 'Netrunner vest', 'top', 210, { topStyle: 'vest', top: 0x16161c, accent: 0xa47bff }, [0x16161c, 0xa47bff], 'Cooling mesh, cable loops, violet status light.'),
  g('techjacket', 'Techwear shell', 'top', 290, { topStyle: 'jacket', top: 0x2a2a34, accent: 0x7dffa8 }, [0x2a2a34, 0x7dffa8], 'Twelve straps. Three of them do something.'),
  g('hudshades', 'HUD shades', 'eyes', 260, { glasses: true }, [0x16161c, 0x2ad8ff], 'A heads-up display that mostly shows the weather.'),
  g('techboots', 'Grip boots', 'shoes', 170, { shoes: 0x2a2a34 }, [0x2a2a34, 0x7dffa8], 'Rated for wet metal, roof edges and dance floors.'),
  g('cyberband', 'LED headband', 'head', 75, { hat: 'headband', hatColor: 0x2ad8ff }, [0x2ad8ff, 0x16161c], 'Scrolls a message of your choice. Yours says HUNGRY.'),
  g('rigpack', 'Rig pack', 'bag', 190, { backpack: 0xa47bff }, [0xa47bff, 0x16161c], 'A deck, a battery and a cooling fan, on your back.'),
  // thrift
  g('oldknit', 'Grandad\'s long knit', 'top', 30, { topStyle: 'cardigan', top: 0x4a3a2a, accent: 0xd9534a }, [0x4a3a2a, 0xd9534a], 'Smells faintly of noodles from 2019.'),
  g('happi', 'Festival happi coat', 'top', 55, { topStyle: 'happi', top: 0xd8282e, accent: 0xf2efe7 }, [0xd8282e, 0xf2efe7], 'From the last Lantern Festival before the floods.'),
  g('denim', 'Faded denim shorts', 'legs', 25, { bottom: 0x3f6e9a, shorts: true, skirt: false }, [0x3f6e9a, 0xd8d8dc], 'Cut-offs from the century before.'),
  g('bucket', 'Bucket hat, check', 'head', 20, { hat: 'bucket', hatColor: 0xf2c74a }, [0xf2c74a, 0x4a3a2a], 'Keeps off rain, sun and eye contact.'),
  g('beanie', 'Orange dock beanie', 'head', 18, { hat: 'beanie', hatColor: 0xff9a4a }, [0xff9a4a, 0x16161c], 'Every dock hand owns three.'),
  g('canvas', 'Canvas sneakers', 'shoes', 28, { shoes: 0xf2efe7 }, [0xf2efe7, 0xd8282e], 'Old enough to be cool again.'),
  g('scarfhood', 'Rain scarf', 'head', 40, { hat: 'scarf', hatColor: 0x6a3a7a }, [0x6a3a7a, 0x16161c], 'Wraps over the head when the acid rain comes.'),
  g('reading', 'Round specs', 'eyes', 22, { glasses: true }, [0x6b4630, 0xd8d8dc], 'No prescription. Pure style.'),
];
export const GARMENT: Record<string, Garment> = Object.fromEntries(GARMENTS.map((x) => [x.id, x]));

export const BOUTIQUES: Record<BoutiqueKind, Boutique> = {
  street: {
    kind: 'street', label: 'Streetwear', names: ['Drip Theory', 'Rainside Supply', 'Pixel Thread'], keepers: ['Kenji', 'Moss', 'Bebe'],
    keeperLook: { topStyle: 'jacket', top: 0xff5fb4, accent: 0x16161c, hat: 'cap', hatColor: 0x16161c },
    lines: ['New drop came in this morning. Half the Mile already wants it.', 'Rain is the season, every season. Dress for it.', 'Try it on. The mirror does not lie, it just flatters.'],
    stock: ['rainshell', 'pinkbomber', 'glowtee', 'cargo', 'pleat', 'hightops', 'snapcap', 'slingpack'],
  },
  corpo: {
    kind: 'corpo', label: 'Tailoring', names: ['Atelier Vanta', 'Zenith Bespoke'], keepers: ['Mr. Okonkwo', 'Madame Ilse'],
    keeperLook: { topStyle: 'suit', top: 0x16161c, accent: 0xc8a040, hat: 'none', glasses: true },
    lines: ['A good suit opens doors. Some doors in the Spire open for nothing else.', 'Measurements by laser, stitching by hand. As it should be.', 'Helix people come here. Walk like them and nobody asks for your badge.'],
    stock: ['helixsuit', 'whitesuit', 'slacks', 'oxfords', 'aviators', 'briefcase'],
  },
  tech: {
    kind: 'tech', label: 'Techwear', names: ['Kowa Gear', 'Ghostline'], keepers: ['Static', 'Juno'],
    keeperLook: { topStyle: 'vest', top: 0x16161c, accent: 0x7dffa8, hat: 'headband', hatColor: 0x7dffa8 },
    lines: ['Everything here is rated for rain, heat and bad decisions.', 'The shades show a map if you squint. And if you pay for the firmware.', 'Netrunners buy the vest. Then they come back for the pack.'],
    stock: ['netvest', 'techjacket', 'hudshades', 'techboots', 'cyberband', 'rigpack'],
  },
  thrift: {
    kind: 'thrift', label: 'Thrift', names: ['Second Life', 'The Rag Stack'], keepers: ['Old Wen', 'Mama Teo'],
    keeperLook: { topStyle: 'cardigan', top: 0x4a3a2a, accent: 0xd9534a, glasses: true, hair: 0xb9b6b0 },
    lines: ['All of it from before. Before what? Before everything, dear.', 'Cheap, warm, and with a story stitched in.', 'Somebody left a note in a coat pocket once. A map. Never did follow it.'],
    stock: ['oldknit', 'happi', 'denim', 'bucket', 'beanie', 'canvas', 'scarfhood', 'reading'],
  },
};

/** Put a piece on. */
export function wear(life: NeoLife, id: string): void {
  const x = GARMENT[id];
  if (!x || !life.look) return;
  life.look = { ...life.look, ...x.patch };
  life.outfit[x.slot] = id;
}

/** Take a slot off where that makes sense (a hat, glasses, a bag). */
export function takeOff(life: NeoLife, slot: Slot): void {
  if (!life.look) return;
  if (slot === 'head') life.look = { ...life.look, hat: 'none' };
  else if (slot === 'eyes') life.look = { ...life.look, glasses: false };
  else if (slot === 'bag') life.look = { ...life.look, backpack: undefined };
  else return;
  delete life.outfit[slot];
}
