/**
 * Números de camisa -- propriedade configurável do jogador, nunca fixa.
 *
 * Estrutura pronta pra checar ocupação real assim que um clube tiver um
 * elenco individual modelado (club.knownRoster: [{ shirtNumber, ... }]).
 * Hoje nenhum clube do jogo modela jogadores individuais além do usuário
 * (só overall agregado), então não existe número ocupado conhecido -- nunca
 * fabricamos essa lista. Quando a coleta oficial de elenco entrar, esta
 * função passa a refletir números realmente ocupados sem que quem a chama
 * precise mudar nada.
 */
function getOccupiedShirtNumbers(club) {
  return (club?.knownRoster || []).map(p => p.shirtNumber).filter(n => Number.isInteger(n));
}

function isShirtNumberAvailable(club, number) {
  return Number.isInteger(number) && number >= 1 && number <= 99 && !getOccupiedShirtNumbers(club).includes(number);
}

function getAvailableShirtNumbers(club) {
  const occupied = new Set(getOccupiedShirtNumbers(club));
  const available = [];
  for (let n = 1; n <= 99; n++) if (!occupied.has(n)) available.push(n);
  return available;
}

export { getOccupiedShirtNumbers, isShirtNumberAvailable, getAvailableShirtNumbers };
