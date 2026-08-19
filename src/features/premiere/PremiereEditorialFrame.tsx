type PremiereEditorialFrameProps = {
  index?: string;
};

export function PremiereEditorialFrame({ index = 'PRM · 01' }: PremiereEditorialFrameProps) {
  return (
    <div className="premiere-frame" data-testid="premiere-editorial-frame" aria-hidden="true">
      <span className="premiere-frame__corner premiere-frame__corner--tl" />
      <span className="premiere-frame__corner premiere-frame__corner--tr" />
      <span className="premiere-frame__corner premiere-frame__corner--bl" />
      <span className="premiere-frame__corner premiere-frame__corner--br" />
      <span className="premiere-frame__index premiere-frame__index--top">{index}</span>
      <span className="premiere-frame__index premiere-frame__index--bottom">LIZA × VIKTOR</span>
      <span className="premiere-frame__grain" />
    </div>
  );
}
