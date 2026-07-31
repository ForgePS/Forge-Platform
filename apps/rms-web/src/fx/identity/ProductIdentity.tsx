export function ProductIdentity({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rms-fx-product-identity" data-testid="rms-fx-product-identity">
      <span className="rms-fx-product-identity__name">Forge RMS</span>
      {!compact ? <span className="rms-fx-product-identity__mark">Records</span> : null}
    </div>
  );
}
