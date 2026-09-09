PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS api_sources (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  base_url TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  official_name TEXT NOT NULL,
  competition TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  cbf_team_id TEXT,
  cbf_team_url TEXT,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  official_name TEXT NOT NULL,
  common_name TEXT,
  birth_date TEXT,
  nationality TEXT,
  height_cm INTEGER,
  weight_kg INTEGER,
  source_status TEXT NOT NULL,
  primary_source TEXT
);

CREATE TABLE IF NOT EXISTS player_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  competition TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  shirt_number INTEGER,
  position TEXT,
  official_cbf_id TEXT,
  registration_status TEXT NOT NULL,
  source_url TEXT,
  FOREIGN KEY(player_id) REFERENCES players(id),
  FOREIGN KEY(club_id) REFERENCES clubs(id)
);

CREATE TABLE IF NOT EXISTS player_registration_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  registered_club_id TEXT NOT NULL,
  current_club_id TEXT,
  competition TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'unknown',
  relationship_status TEXT NOT NULL DEFAULT 'pending_official',
  source_provider TEXT NOT NULL,
  source_url TEXT,
  notes TEXT,
  FOREIGN KEY(player_id) REFERENCES players(id),
  FOREIGN KEY(registered_club_id) REFERENCES clubs(id),
  FOREIGN KEY(current_club_id) REFERENCES clubs(id),
  CHECK(relationship_type IN ('permanent','loan','unknown')),
  CHECK(relationship_status IN ('confirmed','pending_official'))
);

CREATE TABLE IF NOT EXISTS cbf_player_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registered_club_id TEXT NOT NULL,
  name TEXT NOT NULL,
  nickname TEXT,
  current_club_name TEXT,
  competition TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  source_provider TEXT NOT NULL DEFAULT 'CBF',
  source_url TEXT NOT NULL,
  observation_status TEXT NOT NULL DEFAULT 'staging_only',
  relationship_type TEXT NOT NULL DEFAULT 'unknown',
  relationship_status TEXT NOT NULL DEFAULT 'pending_official',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(relationship_type IN ('permanent','loan','unknown')),
  CHECK(relationship_status IN ('confirmed','pending_official'))
);

CREATE TABLE IF NOT EXISTS player_transfer_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT,
  player_name TEXT NOT NULL,
  origin_club_name TEXT,
  destination_club_name TEXT,
  transfer_type TEXT NOT NULL DEFAULT 'unknown',
  transfer_status TEXT NOT NULL DEFAULT 'pending_official',
  season_year INTEGER NOT NULL,
  source_provider TEXT NOT NULL,
  source_url TEXT NOT NULL,
  evidence_text TEXT,
  transfer_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(transfer_type IN ('permanent','loan','unknown')),
  CHECK(transfer_status IN ('confirmed','pending_official'))
);

CREATE TABLE IF NOT EXISTS player_loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  origin_club_id TEXT NOT NULL,
  destination_club_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  start_date TEXT,
  end_date TEXT,
  option_to_buy INTEGER,
  obligation_to_buy INTEGER,
  status TEXT NOT NULL DEFAULT 'pending_official',
  source_provider TEXT NOT NULL,
  source_url TEXT,
  notes TEXT,
  FOREIGN KEY(player_id) REFERENCES players(id),
  FOREIGN KEY(origin_club_id) REFERENCES clubs(id),
  FOREIGN KEY(destination_club_id) REFERENCES clubs(id),
  CHECK(status IN ('confirmed','pending_official')),
  CHECK(option_to_buy IN (0,1) OR option_to_buy IS NULL),
  CHECK(obligation_to_buy IN (0,1) OR obligation_to_buy IS NULL)
);

CREATE TABLE IF NOT EXISTS player_external_ids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  season_year INTEGER,
  source_url TEXT,
  FOREIGN KEY(player_id) REFERENCES players(id),
  UNIQUE(provider, external_id, season_year)
);

CREATE TABLE IF NOT EXISTS player_season_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  club_id TEXT,
  competition TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  appearances INTEGER,
  lineups INTEGER,
  minutes INTEGER,
  goals INTEGER,
  assists INTEGER,
  yellow_cards INTEGER,
  red_cards INTEGER,
  shots INTEGER,
  shots_on_target INTEGER,
  passes INTEGER,
  pass_accuracy REAL,
  rating REAL,
  source_provider TEXT NOT NULL,
  source_url TEXT,
  FOREIGN KEY(player_id) REFERENCES players(id),
  FOREIGN KEY(club_id) REFERENCES clubs(id)
);

CREATE TABLE IF NOT EXISTS kits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  kit_type TEXT NOT NULL,
  asset_status TEXT NOT NULL,
  source_url TEXT,
  FOREIGN KEY(club_id) REFERENCES clubs(id)
);

CREATE TABLE IF NOT EXISTS source_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  provider TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_status TEXT NOT NULL,
  retrieved_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS collection_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  club_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  last_attempt TEXT,
  notes TEXT,
  UNIQUE(competition, season_year, club_id, provider),
  FOREIGN KEY(club_id) REFERENCES clubs(id)
);

CREATE TABLE IF NOT EXISTS collection_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  provider TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_registration_club_season ON player_registrations(club_id, season_year);
CREATE INDEX IF NOT EXISTS idx_registration_player ON player_registrations(player_id);
CREATE INDEX IF NOT EXISTS idx_external_player ON player_external_ids(player_id, provider);
CREATE INDEX IF NOT EXISTS idx_stats_player_season ON player_season_stats(player_id, season_year, competition);
CREATE INDEX IF NOT EXISTS idx_source_entity ON source_records(entity_type, entity_id, season_year);
CREATE INDEX IF NOT EXISTS idx_collection_targets ON collection_targets(competition, season_year, status);

CREATE INDEX IF NOT EXISTS idx_registration_history_player_season ON player_registration_history(player_id, season_year);
CREATE INDEX IF NOT EXISTS idx_registration_history_registered ON player_registration_history(registered_club_id, season_year);
CREATE INDEX IF NOT EXISTS idx_registration_history_current ON player_registration_history(current_club_id, season_year);
CREATE INDEX IF NOT EXISTS idx_cbf_observations_registered ON cbf_player_observations(registered_club_id, season_year);
CREATE INDEX IF NOT EXISTS idx_cbf_observations_name ON cbf_player_observations(name, season_year);
CREATE INDEX IF NOT EXISTS idx_transfer_evidence_player ON player_transfer_evidence(player_id, season_year);
CREATE INDEX IF NOT EXISTS idx_transfer_evidence_name ON player_transfer_evidence(player_name, season_year);
CREATE INDEX IF NOT EXISTS idx_player_loans_player_season ON player_loans(player_id, season_year);
CREATE INDEX IF NOT EXISTS idx_player_loans_destination ON player_loans(destination_club_id, season_year);
CREATE INDEX IF NOT EXISTS idx_player_loans_origin ON player_loans(origin_club_id, season_year);
