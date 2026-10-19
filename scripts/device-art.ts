/**
 * Generates vector product renders for seed data (public/images/devices/*.svg).
 * These are stylised illustrations, not Apple photography — upload real product photos via the admin.
 */
export type CameraStyle = "dual-diagonal" | "dual-vertical" | "pro-triple" | "plateau-pro" | "plateau-air";

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 255) + amt);
  const b = clamp((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function lens(cx: number, cy: number, r: number, id: string) {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="url(#ring${id})"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0b0d12"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="url(#glass${id})"/>
    <circle cx="${cx - r * 0.28}" cy="${cy - r * 0.3}" r="${r * 0.16}" fill="#ffffff" opacity="0.35"/>`;
}

export function deviceSvg(opts: { colour: string; camera: CameraStyle; label: string; id: string }) {
  const { colour, camera, id } = opts;
  const light = shade(colour, 28);
  const dark = shade(colour, -38);
  const frame = shade(colour, -18);
  const bx = 300, by = 70, bw = 220, bh = 460;
  let cam = "";
  if (camera === "dual-diagonal" || camera === "dual-vertical") {
    const mx = bx + 18, my = by + 18;
    cam = `<rect x="${mx}" y="${my}" width="92" height="92" rx="26" fill="${shade(colour, 12)}" stroke="${dark}" stroke-opacity=".35"/>
      ${camera === "dual-diagonal" ? lens(mx + 28, my + 28, 15, id) + lens(mx + 64, my + 64, 15, id) : lens(mx + 30, my + 26, 15, id) + lens(mx + 30, my + 66, 15, id)}
      <circle cx="${mx + 70}" cy="${my + 24}" r="5" fill="#f5e7c8" opacity=".8"/>`;
  } else if (camera === "pro-triple") {
    const mx = bx + 16, my = by + 16;
    cam = `<rect x="${mx}" y="${my}" width="110" height="110" rx="30" fill="${shade(colour, -8)}" stroke="${dark}" stroke-opacity=".4"/>
      ${lens(mx + 32, my + 32, 18, id)}${lens(mx + 32, my + 80, 18, id)}${lens(mx + 80, my + 56, 18, id)}
      <circle cx="${mx + 84}" cy="${my + 20}" r="6" fill="#f5e7c8" opacity=".8"/>`;
  } else if (camera === "plateau-pro") {
    const my = by + 14;
    cam = `<rect x="${bx + 8}" y="${my}" width="${bw - 16}" height="118" rx="30" fill="${shade(colour, -14)}" stroke="${dark}" stroke-opacity=".4"/>
      ${lens(bx + 44, my + 34, 18, id)}${lens(bx + 44, my + 84, 18, id)}${lens(bx + 92, my + 59, 18, id)}
      <circle cx="${bx + 170}" cy="${my + 40}" r="7" fill="#f5e7c8" opacity=".8"/><circle cx="${bx + 170}" cy="${my + 78}" r="5" fill="#222"/>`;
  } else {
    const my = by + 16;
    cam = `<rect x="${bx + 10}" y="${my}" width="${bw - 20}" height="66" rx="30" fill="${shade(colour, -10)}" stroke="${dark}" stroke-opacity=".35"/>
      ${lens(bx + 46, my + 33, 18, id)}<circle cx="${bx + 100}" cy="${my + 33}" r="6" fill="#f5e7c8" opacity=".8"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 600" role="img" aria-label="${opts.label}">
  <defs>
    <linearGradient id="back${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${colour}"/><stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <linearGradient id="sheen${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="screen${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(colour, 40)}"/><stop offset=".5" stop-color="${shade(colour, -20)}"/><stop offset="1" stop-color="#0b1020"/>
    </linearGradient>
    <radialGradient id="glass${id}" cx=".4" cy=".35" r=".8">
      <stop offset="0" stop-color="#3b4a6b"/><stop offset=".6" stop-color="#111522"/><stop offset="1" stop-color="#05060a"/>
    </radialGradient>
    <linearGradient id="ring${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(frame, 50)}"/><stop offset="1" stop-color="${shade(frame, -30)}"/>
    </linearGradient>
    <filter id="shadow${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/><feOffset dy="18"/><feComponentTransfer><feFuncA type="linear" slope=".22"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <ellipse cx="330" cy="560" rx="230" ry="16" fill="#0b1220" opacity=".08"/>
  <g filter="url(#shadow${id})">
    <!-- front -->
    <g transform="translate(-6 30) rotate(-6 200 320)">
      <rect x="110" y="70" width="${bw}" height="${bh}" rx="40" fill="${frame}"/>
      <rect x="118" y="78" width="${bw - 16}" height="${bh - 16}" rx="33" fill="#05070c"/>
      <rect x="126" y="86" width="${bw - 32}" height="${bh - 32}" rx="27" fill="url(#screen${id})"/>
      <rect x="${110 + bw / 2 - 34}" y="98" width="68" height="20" rx="10" fill="#05070c"/>
      <text x="${110 + bw / 2}" y="210" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="52" font-weight="300" fill="#fff" opacity=".92">9:41</text>
      <text x="${110 + bw / 2}" y="238" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="13" fill="#fff" opacity=".7">Monday, 19 October</text>
    </g>
    <!-- back -->
    <g transform="rotate(5 410 300)">
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="40" fill="${frame}"/>
      <rect x="${bx + 5}" y="${by + 5}" width="${bw - 10}" height="${bh - 10}" rx="36" fill="url(#back${id})"/>
      <rect x="${bx + 5}" y="${by + 5}" width="${bw - 10}" height="${bh - 10}" rx="36" fill="url(#sheen${id})"/>
      ${cam}
    </g>
  </g>
</svg>`;
}

export function bannerSvg(opts: { title: string; colourA: string; colourB: string; mobile?: boolean }) {
  const w = opts.mobile ? 800 : 1600;
  const h = opts.mobile ? 1000 : 640;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${opts.title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1220"/><stop offset="1" stop-color="#111a33"/></linearGradient>
    <radialGradient id="glowA" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${opts.colourA}" stop-opacity=".55"/><stop offset="1" stop-color="${opts.colourA}" stop-opacity="0"/></radialGradient>
    <radialGradient id="glowB" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${opts.colourB}" stop-opacity=".45"/><stop offset="1" stop-color="${opts.colourB}" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#fff" stroke-opacity=".04"/></pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#grid)"/>
  <circle cx="${w * 0.78}" cy="${h * (opts.mobile ? 0.72 : 0.45)}" r="${h * 0.55}" fill="url(#glowA)"/>
  <circle cx="${w * 0.95}" cy="${h * 0.1}" r="${h * 0.4}" fill="url(#glowB)"/>
</svg>`;
}
