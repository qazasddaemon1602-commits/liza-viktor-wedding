import type { CSSProperties, ImgHTMLAttributes } from 'react';

type BunkerAsset =
  | 'tunnel-relief-wide'
  | 'tunnel-relief-mobile'
  | 'train-tunnel'
  | 'bunker-exterior'
  | 'bunker-door-closed'
  | 'bunker-door-open'
  | 'evidence-01'
  | 'evidence-02'
  | 'evidence-03'
  | 'evidence-04'
  | 'evidence-05'
  | 'evidence-06'
  | 'tunnel-map-master'
  | 'archive-bk17'
  | 'archive-card'
  | 'archive-document';

type AssetSpec = {
  width: number;
  height: number;
  responsiveWidths: readonly number[];
};

const ASSETS: Record<BunkerAsset, AssetSpec> = {
  'tunnel-relief-wide': { width: 1920, height: 600, responsiveWidths: [960, 1920] },
  'tunnel-relief-mobile': { width: 960, height: 720, responsiveWidths: [480, 960] },
  'train-tunnel': { width: 1920, height: 1080, responsiveWidths: [960, 1920] },
  'bunker-exterior': { width: 1920, height: 1080, responsiveWidths: [960, 1920] },
  'bunker-door-closed': { width: 1920, height: 1080, responsiveWidths: [960, 1920] },
  'bunker-door-open': { width: 1920, height: 1080, responsiveWidths: [960, 1920] },
  'evidence-01': { width: 960, height: 720, responsiveWidths: [480, 960] },
  'evidence-02': { width: 960, height: 720, responsiveWidths: [480, 960] },
  'evidence-03': { width: 960, height: 720, responsiveWidths: [480, 960] },
  'evidence-04': { width: 960, height: 720, responsiveWidths: [480, 960] },
  'evidence-05': { width: 960, height: 720, responsiveWidths: [480, 960] },
  'evidence-06': { width: 960, height: 720, responsiveWidths: [480, 960] },
  'tunnel-map-master': { width: 1920, height: 640, responsiveWidths: [960, 1920] },
  'archive-bk17': { width: 960, height: 720, responsiveWidths: [480, 960] },
  'archive-card': { width: 960, height: 720, responsiveWidths: [480, 960] },
  'archive-document': { width: 960, height: 720, responsiveWidths: [480, 960] },
};

function candidateSet(asset: BunkerAsset, format: 'avif' | 'webp'): string {
  return ASSETS[asset].responsiveWidths
    .map((width) => `/images/bunker/${asset}-${width}.${format} ${width}w`)
    .join(', ');
}

type BunkerResponsivePictureProps = {
  asset: BunkerAsset;
  className?: string;
  testId?: string;
  sizes?: string;
  loading?: ImgHTMLAttributes<HTMLImageElement>['loading'];
  mobileAsset?: BunkerAsset;
  mobileMedia?: string;
  style?: CSSProperties;
  fragmentIndex?: number;
  fragmentCount?: number;
};

/**
 * Generated Bunker plates are context only: visible mission copy remains the
 * authoritative source of meaning, so every plate is deliberately decorative.
 */
export function BunkerResponsivePicture({
  asset,
  className,
  testId,
  sizes = '100vw',
  loading = 'lazy',
  mobileAsset,
  mobileMedia = '(max-width: 640px)',
  style,
  fragmentIndex,
  fragmentCount,
}: BunkerResponsivePictureProps) {
  const spec = ASSETS[asset];

  return (
    <picture
      className={className}
      aria-hidden="true"
      data-testid={testId}
      data-fragment-index={fragmentIndex}
      data-fragment-count={fragmentCount}
      style={style}
    >
      {mobileAsset && (
        <>
          <source
            media={mobileMedia}
            type="image/avif"
            srcSet={candidateSet(mobileAsset, 'avif')}
            sizes={sizes}
          />
          <source
            media={mobileMedia}
            type="image/webp"
            srcSet={candidateSet(mobileAsset, 'webp')}
            sizes={sizes}
          />
        </>
      )}
      <source type="image/avif" srcSet={candidateSet(asset, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={candidateSet(asset, 'webp')} sizes={sizes} />
      <img
        src={`/images/bunker/${asset}.png`}
        alt=""
        width={spec.width}
        height={spec.height}
        loading={loading}
        decoding="async"
        draggable="false"
      />
    </picture>
  );
}

export type { BunkerAsset };
