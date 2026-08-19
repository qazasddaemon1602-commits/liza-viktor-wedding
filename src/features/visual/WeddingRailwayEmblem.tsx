type WeddingRailwayEmblemProps = {
  className?: string;
};

export function WeddingRailwayEmblem({ className = '' }: WeddingRailwayEmblemProps) {
  return (
    <svg
      className={className}
      data-testid="wedding-railway-emblem"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 96"
      fill="none"
    >
      <path d="M18 69H221" stroke="currentColor" />
      <path d="M44 61H177L190 69H36L44 61Z" stroke="currentColor" />
      <rect x="71" y="34" width="74" height="27" rx="2" stroke="currentColor" />
      <path d="M83 34V24H105V34M119 34V18H132V34" stroke="currentColor" />
      <circle cx="68" cy="70" r="9" stroke="currentColor" />
      <circle cx="151" cy="70" r="9" stroke="currentColor" />
      <path d="M159 42H177L190 61H159V42Z" stroke="currentColor" />
      <path d="M93 44H108M116 44H131" stroke="currentColor" />
    </svg>
  );
}
