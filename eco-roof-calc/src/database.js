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
      артикул_товара TEXT UNIQUE,
      полное_наименование_материала TEXT,
      единица_измерения TEXT,
      базовая_цена REAL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_видов_работ (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      наименование_работы TEXT,
      единица_измерения_работы TEXT,
      базовая_стоимость_работы REAL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_систем (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      наименование_системы TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Шаблоны_разделов_системы (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      идентификатор_системы INTEGER,
      наименование_раздела TEXT,
      порядок_сортировки INTEGER,
      FOREIGN KEY(идентификатор_системы) REFERENCES Справочник_систем(идентификатор)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Нормы_в_разделе (
      идентификатор_связи INTEGER PRIMARY KEY AUTOINCREMENT,
      идентификатор_раздела INTEGER,
      тип_записи TEXT, -- 'работа' или 'материал'
      идентификатор_элемента INTEGER, -- ID работы или ID материала
      коэффициент_расхода REAL,
      привязка_к_параметру TEXT, -- 'площадь', 'периметр', 'воронки'
      FOREIGN KEY(идентификатор_раздела) REFERENCES Шаблоны_разделов_системы(идентификатор)
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

  console.log('Гибридная база данных успешно инициализирована!');
}