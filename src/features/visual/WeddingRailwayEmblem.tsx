type WeddingRailwayEmblemProps = {
  className?: string;
};

export function WeddingRailwayEmblem({ className = '' }: WeddingRailwayEmblemProps) {
  return (
    <picture
      className={className}
      data-testid="wedding-railway-emblem"
      aria-hidden="true"
    >
      <source
        type="image/avif"
        srcSet="/images/ticket/locomotive-engraving-480.avif 480w, /images/ticket/locomotive-engraving-960.avif 960w"
        sizes="160px"
      />
      <source
        type="image/webp"
        srcSet="/images/ticket/locomotive-engraving-480.webp 480w, /images/ticket/locomotive-engraving-960.webp 960w"
        sizes="160px"
      />
      <img
        src="/images/ticket/locomotive-engraving.png"
        alt=""
        width="2048"
        height="1152"
        decoding="async"
      />
    </picture>
  );
}

