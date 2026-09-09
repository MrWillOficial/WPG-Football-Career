/** Official CBF calendar anchors for Copa do Brasil 2026.
 * Only dates explicitly verified from CBF are encoded. Other phase windows
 * remain pending instead of being fabricated.
 */
const COPA_DO_BRASIL_2026_CALENDAR = {
  competition: 'copa_do_brasil_2026', seasonYear: 2026,
  officialAnchors: [
    { phase: 'fase1', startDate: '2026-02-18', endDate: '2026-02-19', status: 'official_base_dates' },
    { phase: 'final', startDate: '2026-12-06', endDate: '2026-12-06', status: 'official_base_date' },
  ],
  pendingOfficialWindows: ['fase2','fase3','fase4','fase5','oitavas','quartas','semifinal'],
  collisionPolicy: 'conflict_pending',
};
export { COPA_DO_BRASIL_2026_CALENDAR };
