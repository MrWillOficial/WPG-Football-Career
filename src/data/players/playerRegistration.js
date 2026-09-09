/**
 * Registro contextual do jogador no elenco.
 * Número da camisa pertence ao clube/temporada, não à identidade permanente.
 */
function createPlayerRegistration({ clubId = null, seasonYear = null, competitionId = null, shirtNumber = null, shirtNumberStatus = 'pending_official', registeredClubId = clubId, currentClubId = clubId, relationshipType = 'unknown', relationshipStatus = 'pending_official', loan = null } = {}) {
  return {
    clubId,
    seasonYear,
    competitionId,
    shirtNumber,
    shirtNumberStatus,
    source: shirtNumber == null ? null : 'official',
    registeredClubId,
    currentClubId,
    relationshipType,
    relationshipStatus,
    loan,
  };
}

function validatePlayerRegistration(registration) {
  if (!registration || typeof registration !== 'object') return { valid: false, errors: ['registration_missing'] };
  const errors = [];
  if (registration.shirtNumber != null && (!Number.isInteger(registration.shirtNumber) || registration.shirtNumber < 1 || registration.shirtNumber > 99)) errors.push('shirt_number_invalid');
  if (!['official', 'pending_official', 'not_applicable'].includes(registration.shirtNumberStatus)) errors.push('shirt_number_status_invalid');
  if (!['permanent', 'loan', 'unknown'].includes(registration.relationshipType)) errors.push('relationship_type_invalid');
  if (!['confirmed', 'pending_official'].includes(registration.relationshipStatus)) errors.push('relationship_status_invalid');
  if (registration.relationshipType === 'loan' && registration.relationshipStatus !== 'confirmed') errors.push('loan_must_be_confirmed');
  return { valid: errors.length === 0, errors };
}

export { createPlayerRegistration, validatePlayerRegistration };
