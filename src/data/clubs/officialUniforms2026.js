/**
 * Uniformes oficiais 2026.
 * A estrutura fica preparada para assets licenciados/oficiais sem embutir
 * escudos ou imagens protegidas por padrão.
 */
function createUniformRecord(clubId) {
  return {
    clubId,
    seasonYear: 2026,
    primary: { status: 'pending_official_asset', source: null, asset: null },
    secondary: { status: 'pending_official_asset', source: null, asset: null },
    third: { status: 'pending_official_asset', source: null, asset: null },
    goalkeeper: { status: 'pending_official_asset', source: null, asset: null },
  };
}

const OFFICIAL_UNIFORMS_2026 = Object.freeze({});

function getOfficialUniforms2026(clubId) {
  return OFFICIAL_UNIFORMS_2026[clubId] || createUniformRecord(clubId);
}

export { OFFICIAL_UNIFORMS_2026, getOfficialUniforms2026 };
