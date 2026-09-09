/**
 * Registry data-driven de clubes.
 *
 * O glob carrega somente `club.json`. Elencos, base, comissão, histórico e
 * fontes continuam dentro da pasta individual de cada clube.
 */
const clubModules = import.meta.glob('./brazil/**/club.json', {
  eager: true,
  query: '?json',
  import: 'default',
});

export const CLUB_DATA_REGISTRY = Object.values(clubModules);
export const CLUB_DATA_BY_ID = Object.fromEntries(
  CLUB_DATA_REGISTRY.map(club => [club.id, club])
);

export function getClubData(clubId) {
  return CLUB_DATA_BY_ID[clubId] || null;
}
