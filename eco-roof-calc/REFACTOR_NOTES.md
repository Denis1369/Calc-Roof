# Refactor notes

## Что изменено
- Пересобрана структура проекта в более компактную схему.
- Убраны лишние архитектурные прослойки: `application`, `features`, `composables`, `shared`, `infrastructure`, `views`, пустой `app/router`.
- Сведены сервисные обёртки в один файл: `src/core/services/dataApi.js`.
- Объединены view-адаптеры в `src/core/adapters/viewAdapters.js`.
- Исправлены пути импортов и сломанные ссылки.
- Добавлен alias `@` в `vite.config.js`.
- Добавлено разбиение чанков для `vue`, `mathjs` и `tauri`.
- Удалены неиспользуемые файлы: `views/EstimateTable.vue`, `components/EditPieModal.vue`, `components/WorkMaterialBindingModal.vue` и несколько старых обёрток.

## Новая структура
- `src/app` — корневой shell и роутер
- `src/pages` — страницы
- `src/components` — UI-компоненты
- `src/modules` — прикладная логика по модулям
- `src/core` — БД, репозитории, сервисы, утилиты, адаптеры
- `src/styles` — темы и стили

## Результат
- Количество файлов в `src`: 75 → 44
- Количество папок в `src`: 31 → 19
- `vite build` проходит успешно
