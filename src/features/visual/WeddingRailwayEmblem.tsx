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
      viewBox="0 0 240 100"
      fill="none"
    >
      {/* Detailed engraving-style locomotive */}
      <path d="M20 85H220" stroke="currentColor" strokeWidth="0.5" />
      <path d="M40 78H180L195 85H30L40 78Z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.05" />
      
      {/* Boiler */}
      <rect x="65" y="35" width="80" height="35" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M65 40H145" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
      <path d="M65 52H145" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
      <path d="M65 64H145" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />

      {/* Chimney */}
      <path d="M75 35V20H95V35" stroke="currentColor" strokeWidth="1.2" />
      <path d="M72 20H98" stroke="currentColor" strokeWidth="1.2" />
      
      {/* Dome */}
      <path d="M110 35V28H125V35" stroke="currentColor" strokeWidth="1.2" />
      
      {/* Cab */}
      <path d="M145 35H180V78H145V35Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.05" />
      <rect x="152" y="42" width="18" height="20" stroke="currentColor" strokeWidth="1" />
      <path d="M140 35H185" stroke="currentColor" strokeWidth="1.5" />

      {/* Wheels */}
      <circle cx="65" cy="78" r="10" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="65" cy="78" r="3" fill="currentColor" />
      <circle cx="95" cy="78" r="10" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="95" cy="78" r="3" fill="currentColor" />
      <circle cx="125" cy="78" r="10" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="125" cy="78" r="3" fill="currentColor" />
      <circle cx="160" cy="78" r="12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="160" cy="78" r="4" fill="currentColor" />
      
      {/* Cowcatcher */}
      <path d="M30 78L20 85H40L30 78Z" stroke="currentColor" strokeWidth="1" />
      
      {/* Connectors */}
      <path d="M65 78H160" stroke="currentColor" strokeWidth="2" opacity="0.3" />
    </svg>
  );
}
