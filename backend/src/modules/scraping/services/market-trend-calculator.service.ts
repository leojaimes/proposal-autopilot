export interface MarketTrendSnapshot {
  taxonomyNodeId: string;
  asOf: Date;
  demand30d: number;
  medianProposals: number | null;
  overallOpportunity: number | null;
}

export interface MarketTrend {
  comparedTo: Date;
  elapsedDays: number;
  demand30dDelta: number;
  medianProposalsDelta: number | null;
  overallOpportunityDelta: number | null;
}

/**
 * Compares each category's newest persisted snapshot with its immediately
 * preceding daily snapshot. Unknown measurements remain unavailable.
 */
export class MarketTrendCalculator {
  calculate(snapshots: MarketTrendSnapshot[]): Map<string, MarketTrend | null> {
    const grouped = new Map<string, MarketTrendSnapshot[]>();
    for (const snapshot of snapshots) {
      const categorySnapshots = grouped.get(snapshot.taxonomyNodeId) ?? [];
      categorySnapshots.push(snapshot);
      grouped.set(snapshot.taxonomyNodeId, categorySnapshots);
    }

    return new Map([...grouped.entries()].map(([taxonomyNodeId, categorySnapshots]) => {
      const ordered = [...categorySnapshots].sort((left, right) => right.asOf.getTime() - left.asOf.getTime());
      const current = ordered[0];
      const previous = ordered.find((snapshot) => snapshot.asOf.getTime() < current.asOf.getTime());

      if (!previous) return [taxonomyNodeId, null];

      return [taxonomyNodeId, {
        comparedTo: previous.asOf,
        elapsedDays: Math.round((current.asOf.getTime() - previous.asOf.getTime()) / (24 * 60 * 60 * 1000)),
        demand30dDelta: current.demand30d - previous.demand30d,
        medianProposalsDelta: current.medianProposals == null || previous.medianProposals == null
          ? null
          : Number((current.medianProposals - previous.medianProposals).toFixed(2)),
        overallOpportunityDelta: current.overallOpportunity == null || previous.overallOpportunity == null
          ? null
          : Number((current.overallOpportunity - previous.overallOpportunity).toFixed(2)),
      }];
    }));
  }
}
