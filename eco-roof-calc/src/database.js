import Database from '@tauri-apps/plugin-sql';

let dbInstance = null;

export async function getDb() {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:estimates.db');
  }
  return dbInstance;
}

export async function initDatabase() {
  const db = await getDb();

  
  
  

  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_материалов (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      главная_категория TEXT,
      подкатегория TEXT,
      артикул_товара TEXT,
      полное_наименование_материала TEXT,
      единица_измерения TEXT,
      базовая_цена REAL DEFAULT 0,
      ссылка TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_видов_работ (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      категория_работы TEXT DEFAULT 'Общие работы',
      наименование_работы TEXT,
      единица_измерения_работы TEXT,
      цена_0_300 REAL DEFAULT 0,
      цена_300_600 REAL DEFAULT 0,
      цена_600_1000 REAL DEFAULT 0,
      цена_1000_3000 REAL DEFAULT 0,
      цена_3000_6000 REAL DEFAULT 0,
      цена_6000_15000 REAL DEFAULT 0,
      цена_15000_30000 REAL DEFAULT 0,
      цена_более_30000 REAL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_коэффициентов (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      заголовок TEXT,
      название TEXT,
      значение REAL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_формул (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      название_формулы TEXT,
      выражение TEXT
    )
  `);

  
  
  

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Сохраненные_сметы (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      название_объекта TEXT,
      дата_создания DATETIME DEFAULT CURRENT_TIMESTAMP,
      данные_сметы_json TEXT
    )
  `);

  
  await db.execute("ALTER TABLE Справочник_материалов ADD COLUMN избранное INTEGER DEFAULT 0").catch(() => {});
  await db.execute("ALTER TABLE Справочник_видов_работ ADD COLUMN избранное INTEGER DEFAULT 0").catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_шаблонов (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      название TEXT,
      данные_json TEXT
    )
  `);

  console.log('Гибридная база данных успешно инициализирована!');
}