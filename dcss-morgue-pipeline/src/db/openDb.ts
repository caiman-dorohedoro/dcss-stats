import BetterSqlite3 from 'better-sqlite3'

export type Database = BetterSqlite3.Database

function configureDb(db: Database) {
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
}

export function openDb(filePath: string): Database {
  const db = new BetterSqlite3(filePath)
  configureDb(db)
  return db
}

export function createInMemoryDb(): Database {
  const db = new BetterSqlite3(':memory:')
  configureDb(db)
  return db
}
