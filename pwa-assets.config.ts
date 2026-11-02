// PWA icons and iOS splash screens, generated from public/icon.svg by `npm run icons`.
// The output is committed under public/; re-run after changing the icon. The CLI prints the
// <link> tags for index.html (favicons, apple-touch-icon and the splash screens). When pasting
// them, add `(prefers-color-scheme: light)` to the light splash queries, as index.html does, so
// a dark-mode device never matches a light launch screen as well as its dark one.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import {
  appleSplashScreenSizes,
  defineConfig,
  type AppleDeviceName,
  type AppleDeviceSize,
  type Preset,
} from '@vite-pwa/assets-generator/config'

// Paper and pen colours from src/styles/tokens.css.
const PAPER = '#f6f3ee'
const PAPER_DARK = '#1a1816'
const RED = '#c42b22'
const RED_DARK = '#ef5a4f'

/**
 * The maskable safe zone is a centred circle with a 40% radius. The tick's furthest point sits
 * ~36% from the centre of icon.svg, so shrinking by a quarter leaves it comfortably inside.
 */
const MASKABLE_PADDING = 0.25

/** Width of the (invisible) paper tile on splash screens, in points: the tick is ~54% of it. */
const SPLASH_TILE_PT = 144

/**
 * One device per distinct screen size; the generator writes portrait and landscape, light and
 * dark for each. Other devices sharing a size are listed alongside.
 */
const SPLASH_DEVICES: AppleDeviceName[] = [
  'iPhone SE 4.7"', //       750x1334: SE 2nd/3rd gen, 8
  'iPhone 11', //            828x1792: XR, 11
  'iPhone 13 mini', //       1125x2436: X, XS, 11 Pro, 12 mini
  'iPhone 11 Pro Max', //    1242x2688: XS Max
  'iPhone 14', //            1170x2532: 12, 12 Pro, 13, 13 Pro, 16e
  'iPhone 14 Plus', //       1284x2778: 12 Pro Max, 13 Pro Max
  'iPhone 16', //            1179x2556: 14 Pro, 15, 15 Pro
  'iPhone 16 Plus', //       1290x2796: 14 Pro Max, 15 Plus, 15 Pro Max
  'iPhone 17 Pro', //        1206x2622: 16 Pro, 17
  'iPhone Air', //           1260x2736
  'iPhone 17 Pro Max', //    1320x2868: 16 Pro Max
  'iPad 10.2"', //           1620x2160: iPad 7th to 9th gen
  'iPad 11"', //             1640x2360: iPad 10th gen and later, Air 10.9"/11"
  'iPad Pro 11"', //         1668x2388
  'iPad Pro 12.9"', //       2048x2732: Air 13"
]

/** Same physical tick size on every device: padding is whatever is left around the tile. */
function splashSize(device: AppleDeviceName): AppleDeviceSize {
  const size = appleSplashScreenSizes[device]
  const tilePx = SPLASH_TILE_PT * size.scaleFactor
  const shortSide = Math.min(size.width, size.height)
  return { ...size, padding: 1 - tilePx / shortSide }
}

/** icon.svg in night colours, for the dark splash screens. */
async function darkIcon(imageName: string): Promise<Buffer> {
  const svg = await readFile(resolve(process.cwd(), imageName), 'utf8')
  for (const colour of [PAPER, RED]) {
    if (!svg.toLowerCase().includes(colour)) {
      throw new Error(`${imageName} no longer uses ${colour}; update darkIcon() in pwa-assets.config.ts`)
    }
  }
  const dark = svg.replace(new RegExp(PAPER, 'gi'), PAPER_DARK).replace(new RegExp(RED, 'gi'), RED_DARK)
  return Buffer.from(dark)
}

/**
 * sharp's PNG `quality` quantises to a palette; the generator's default (60) leaves only a
 * handful of colours for the anti-aliased pen edges, which then look stepped. Full quality
 * keeps the edges smooth and the files are still small (two flat colours).
 */
const PNG = { compressionLevel: 9, quality: 100 } as const

const preset: Preset = {
  png: PNG,
  // Rounded paper tile on transparency: manifest "any" icons and favicon.ico.
  transparent: {
    sizes: [64, 192, 512],
    favicons: [[48, 'favicon.ico']],
    padding: 0,
  },
  // Full-bleed paper; the tile blends into the background because it is the same colour.
  maskable: {
    sizes: [512],
    padding: MASKABLE_PADDING,
    resizeOptions: { fit: 'contain', background: PAPER },
  },
  // iOS shows transparency as black, so the touch icon is opaque paper. iOS applies its own
  // rounded mask, which matches the tile's corner radius.
  apple: {
    sizes: [180],
    padding: 0,
    resizeOptions: { fit: 'contain', background: PAPER },
  },
  appleSplashScreens: {
    sizes: SPLASH_DEVICES.map(splashSize),
    resizeOptions: { fit: 'contain', background: PAPER },
    darkResizeOptions: { fit: 'contain', background: PAPER_DARK },
    darkImageResolver: darkIcon,
    png: PNG,
    linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/', xhtml: false },
  },
}

export default defineConfig({
  preset,
  images: ['public/icon.svg'],
  headLinkOptions: {
    preset: '2023',
    // The tab favicon is a separate, heavier drawing (public/favicon.svg) that follows the
    // system colour scheme.
    resolveSvgName: () => 'favicon.svg',
  },
})
