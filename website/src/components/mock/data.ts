// Mirrors the Search view in renderer/app.js: the same tabs, the sources each tab searches,
// and the three licence badges. Titles are illustrative.

export type Tier = "free" | "credit" | "check";
export type Scene = "rain" | "city" | "neon" | "window" | "forest" | "storm" | "puddle" | "umbrella" | "dusk";

export const licence: Record<Tier, { label: string; cls: string }> = {
  free: { label: "Copyright-free", cls: "bg-lic-free/12 text-lic-free" },
  credit: { label: "Free · credit author", cls: "bg-lic-credit/13 text-lic-credit" },
  check: { label: "Copyrighted", cls: "bg-lic-check/13 text-lic-check" },
};

export type Result = { title: string; site: string; tier: Tier; scene: Scene; meta: string };

export type Collection = {
  id: string;
  label: string;
  kind: "video" | "image" | "audio" | "gif";
  picks: string[];
  more: string[];
  results: Result[];
};

export const collections: Collection[] = [
  {
    id: "video",
    label: "Videos",
    kind: "video",
    picks: ["Mixkit", "YouTube"],
    more: ["Pexels", "Pixabay", "Coverr", "Envato"],
    results: [
      { title: "Rain on a city window at night", site: "Mixkit", tier: "free", scene: "window", meta: "0:14" },
      { title: "Neon street in the rain", site: "Mixkit", tier: "free", scene: "neon", meta: "0:21" },
      { title: "Raindrops falling in a puddle", site: "Mixkit", tier: "free", scene: "puddle", meta: "0:09" },
      { title: "Storm clouds over the skyline", site: "Mixkit", tier: "free", scene: "storm", meta: "0:17" },
      { title: "Walking in Tokyo rain, 4K", site: "YouTube", tier: "check", scene: "city", meta: "12:48" },
      { title: "Forest rain, ambient footage", site: "YouTube", tier: "check", scene: "forest", meta: "1:02:10" },
    ],
  },
  {
    id: "images",
    label: "Images",
    kind: "image",
    picks: ["Flickr", "Wikimedia"],
    more: ["Unsplash", "Pexels", "Pixabay", "Google Images", "Envato"],
    results: [
      { title: "Umbrellas, Shibuya crossing", site: "Flickr", tier: "credit", scene: "umbrella", meta: "4032 × 3024" },
      { title: "Rain on glass", site: "Wikimedia", tier: "free", scene: "window", meta: "3000 × 2000" },
      { title: "Wet street at dusk", site: "Flickr", tier: "credit", scene: "dusk", meta: "5472 × 3648" },
      { title: "Monsoon over the hills", site: "Wikimedia", tier: "credit", scene: "storm", meta: "2560 × 1707" },
      { title: "Puddle reflections", site: "Flickr", tier: "free", scene: "puddle", meta: "4000 × 2667" },
      { title: "Rainforest canopy", site: "Wikimedia", tier: "free", scene: "forest", meta: "3264 × 2448" },
    ],
  },
  {
    id: "music",
    label: "Music",
    kind: "audio",
    picks: ["Mixkit", "YouTube"],
    more: ["Pixabay", "Free Music Archive", "Envato"],
    results: [
      { title: "Rainy Day Lo-fi", site: "Mixkit", tier: "free", scene: "rain", meta: "2:31" },
      { title: "After the Rain", site: "Mixkit", tier: "free", scene: "dusk", meta: "3:05" },
      { title: "Raindrops, piano", site: "Mixkit", tier: "free", scene: "window", meta: "2:12" },
      { title: "Rain jazz for focus", site: "YouTube", tier: "check", scene: "neon", meta: "58:40" },
    ],
  },
  {
    id: "sfx",
    label: "Sound effects",
    kind: "audio",
    picks: ["Mixkit"],
    more: ["Freesound", "Pixabay", "Envato"],
    results: [
      { title: "Light rain loop", site: "Mixkit", tier: "free", scene: "rain", meta: "0:30" },
      { title: "Heavy rain on a roof", site: "Mixkit", tier: "free", scene: "storm", meta: "0:45" },
      { title: "Thunder crack", site: "Mixkit", tier: "free", scene: "storm", meta: "0:06" },
      { title: "Rain on a car window", site: "Mixkit", tier: "free", scene: "window", meta: "0:38" },
    ],
  },
  {
    id: "gifs",
    label: "GIFs",
    kind: "gif",
    picks: ["Tenor"],
    more: ["GIPHY", "Google GIFs"],
    results: [
      { title: "rain window", site: "Tenor", tier: "check", scene: "window", meta: "GIF" },
      { title: "anime rain", site: "Tenor", tier: "check", scene: "neon", meta: "GIF" },
      { title: "rainy mood", site: "Tenor", tier: "check", scene: "umbrella", meta: "GIF" },
      { title: "storm", site: "Tenor", tier: "check", scene: "storm", meta: "GIF" },
    ],
  },
];
