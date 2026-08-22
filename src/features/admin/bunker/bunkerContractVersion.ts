type ProjectionContract = {
  contractVersion?: unknown;
  status?: unknown;
} | null | undefined;

export function resolveBunkerContractVersion(
  projections: readonly ProjectionContract[],
): 1 | 2 | undefined {
  if (projections.some((projection) => projection?.status === 'legacy')) return 1;
  if (projections.some((projection) => projection?.contractVersion === 1)) return 1;
  if (projections.some((projection) => (
    projection !== null
    && projection !== undefined
    && projection.contractVersion === 2
    && projection.status !== 'legacy'
    && projection.status !== undefined
  ))) return 2;
  return undefined;
}
