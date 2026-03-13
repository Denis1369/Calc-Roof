import { ref, computed, watch } from 'vue';
import { getDb } from '../database.js';

export function useDirectories() {
  const materials = ref([]);
  const works = ref([]);

  
  const searchMaterial = ref('');
  const searchWork = ref('');
  const onlyFavMaterials = ref(false); 
  const onlyFavWorks = ref(false); 

  
  const collapsedGroups = ref({});
  const collapsedMatMain = ref({});
  const collapsedMatSub = ref({});

  
  const newMaterial = ref({ 
    главная_категория: '', подкатегория: '', артикул_товара: '', 
    полное_наименование_материала: '', единица_измерения: 'м2', базовая_цена: 0, ссылка: ''
  });

  const newWork = ref({
    категория_работы: '', наименование_работы: '', единица_измерения_работы: 'м2',
    цена_0_300: 0, цена_300_600: 0, цена_600_1000: 0, цена_1000_3000: 0,
    цена_3000_6000: 0, цена_6000_15000: 0, цена_15000_30000: 0, цена_более_30000: 0
  });

  
  
  
  async function loadData() {
    const db = await getDb();
    materials.value = await db.select('SELECT * FROM Справочник_материалов ORDER BY избранное DESC, главная_категория, подкатегория, полное_наименование_материала ASC');
    works.value = await db.select('SELECT * FROM Справочник_видов_работ ORDER BY избранное DESC, идентификатор ASC');
    
    
    if (!searchMaterial.value && !onlyFavMaterials.value) {
      for (const mainCat in groupedMaterials.value) {
        collapsedMatMain.value[mainCat] = true;
        for (const subCat in groupedMaterials.value[mainCat]) {
          collapsedMatSub.value[`${mainCat}_${subCat}`] = true;
        }
      }
    }
    if (!searchWork.value && !onlyFavWorks.value) {
      for (const cat in groupedWorks.value) collapsedGroups.value[cat] = true;
    }
  }

  
  
  
  const filteredMaterials = computed(() => {
    let list = materials.value;
    if (onlyFavMaterials.value) list = list.filter(m => m.избранное);
    if (!searchMaterial.value) return list;
    const query = searchMaterial.value.toLowerCase();
    return list.filter(m => 
      (m.полное_наименование_материала && m.полное_наименование_материала.toLowerCase().includes(query)) ||
      (m.артикул_товара && String(m.артикул_товара).toLowerCase().includes(query)) ||
      (m.главная_категория && m.главная_категория.toLowerCase().includes(query)) ||
      (m.подкатегория && m.подкатегория.toLowerCase().includes(query))
    );
  });

  const groupedMaterials = computed(() => {
    const groups = {};
    filteredMaterials.value.forEach(mat => {
      const main = mat.главная_категория || 'Без категории';
      const sub = mat.подкатегория || 'Без подкатегории';
      if (!groups[main]) groups[main] = {};
      if (!groups[main][sub]) groups[main][sub] = [];
      groups[main][sub].push(mat);
    });
    return groups;
  });

  async function addMaterial() {
    try {
      const db = await getDb();
      await db.execute(
        `INSERT INTO Справочник_материалов (главная_категория, подкатегория, артикул_товара, полное_наименование_материала, единица_измерения, базовая_цена, ссылка, избранное) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
        [newMaterial.value.главная_категория || 'Без категории', newMaterial.value.подкатегория || 'Без подкатегории', newMaterial.value.артикул_товара, newMaterial.value.полное_наименование_материала, newMaterial.value.единица_измерения, newMaterial.value.базовая_цена || 0, newMaterial.value.ссылка]
      );
      newMaterial.value = { главная_категория: '', подкатегория: '', артикул_товара: '', полное_наименование_материала: '', единица_измерения: 'м2', базовая_цена: 0, ссылка: '' };
      await loadData();
    } catch (e) { alert('Ошибка при добавлении материала.'); console.error(e); }
  }

  async function updateMaterial(mat) {
    try {
      const db = await getDb();
      await db.execute(`UPDATE Справочник_материалов SET артикул_товара = $1, полное_наименование_материала = $2, единица_измерения = $3, базовая_цена = $4, ссылка = $5 WHERE идентификатор = $6`, 
        [mat.артикул_товара, mat.полное_наименование_материала, mat.единица_измерения, mat.базовая_цена, mat.ссылка, mat.идентификатор]);
    } catch (e) { console.error("Ошибка обновления", e); }
  }

  async function toggleFavMaterial(mat) {
    mat.избранное = mat.избранное ? 0 : 1;
    try { const db = await getDb(); await db.execute("UPDATE Справочник_материалов SET избранное = $1 WHERE идентификатор = $2", [mat.избранное, mat.идентификатор]); } catch(e) {}
  }

  async function deleteMaterial(id) {
    if (confirm('Удалить материал?')) {
      const db = await getDb(); await db.execute('DELETE FROM Справочник_материалов WHERE идентификатор = $1', [id]); await loadData();
    }
  }

  
  
  
  const filteredWorks = computed(() => {
    let list = works.value;
    if (onlyFavWorks.value) list = list.filter(w => w.избранное);
    if (!searchWork.value) return list;
    const query = searchWork.value.toLowerCase();
    return list.filter(w => 
      (w.наименование_работы && w.наименование_работы.toLowerCase().includes(query)) ||
      (w.категория_работы && w.категория_работы.toLowerCase().includes(query))
    );
  });

  const groupedWorks = computed(() => {
    const groups = {};
    filteredWorks.value.forEach(work => {
      const cat = work.категория_работы || 'Общие работы';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(work);
    });
    return groups;
  });

  const uniqueCategories = computed(() => Array.from(new Set(works.value.map(w => w.категория_работы || 'Общие работы'))));

  async function addWork() {
    try {
      const db = await getDb();
      await db.execute(
        `INSERT INTO Справочник_видов_работ (категория_работы, наименование_работы, единица_измерения_работы, цена_0_300, цена_300_600, цена_600_1000, цена_1000_3000, цена_3000_6000, цена_6000_15000, цена_15000_30000, цена_более_30000, избранное) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
        [newWork.value.категория_работы || 'Общие работы', newWork.value.наименование_работы, newWork.value.единица_измерения_работы, newWork.value.цена_0_300 || 0, newWork.value.цена_300_600 || 0, newWork.value.цена_600_1000 || 0, newWork.value.цена_1000_3000 || 0, newWork.value.цена_3000_6000 || 0, newWork.value.цена_6000_15000 || 0, newWork.value.цена_15000_30000 || 0, newWork.value.цена_более_30000 || 0]
      );
      newWork.value = { категория_работы: '', наименование_работы: '', единица_измерения_работы: 'м2', цена_0_300: 0, цена_300_600: 0, цена_600_1000: 0, цена_1000_3000: 0, цена_3000_6000: 0, цена_6000_15000: 0, цена_15000_30000: 0, цена_более_30000: 0 };
      await loadData();
    } catch (error) { console.error(error); alert('Ошибка добавления работы'); }
  }

  async function updateWork(work) {
    try {
      const db = await getDb();
      await db.execute(`UPDATE Справочник_видов_работ SET наименование_работы = $1, единица_измерения_работы = $2, цена_0_300 = $3, цена_300_600 = $4, цена_600_1000 = $5, цена_1000_3000 = $6, цена_3000_6000 = $7, цена_6000_15000 = $8, цена_15000_30000 = $9, цена_более_30000 = $10 WHERE идентификатор = $11`, 
        [work.наименование_работы, work.единица_измерения_работы, work.цена_0_300 || 0, work.цена_300_600 || 0, work.цена_600_1000 || 0, work.цена_1000_3000 || 0, work.цена_3000_6000 || 0, work.цена_6000_15000 || 0, work.цена_15000_30000 || 0, work.цена_более_30000 || 0, work.идентификатор]);
    } catch (e) { console.error("Ошибка обновления расценки", e); }
  }

  async function toggleFavWork(work) {
    work.избранное = work.избранное ? 0 : 1;
    try { const db = await getDb(); await db.execute("UPDATE Справочник_видов_работ SET избранное = $1 WHERE идентификатор = $2", [work.избранное, work.идентификатор]); } catch(e) {}
  }

  async function deleteWork(id) {
    if (confirm('Удалить расценку на работу?')) {
      const db = await getDb(); await db.execute('DELETE FROM Справочник_видов_работ WHERE идентификатор = $1', [id]); await loadData();
    }
  }

  
  
  
  watch([searchMaterial, onlyFavMaterials], () => {
    if (searchMaterial.value.trim().length > 0 || onlyFavMaterials.value) {
      for (const mainCat in groupedMaterials.value) {
        collapsedMatMain.value[mainCat] = false;
        for (const subCat in groupedMaterials.value[mainCat]) {
          collapsedMatSub.value[`${mainCat}_${subCat}`] = false;
        }
      }
    }
  });

  watch([searchWork, onlyFavWorks], () => {
    if (searchWork.value.trim().length > 0 || onlyFavWorks.value) {
      for (const cat in groupedWorks.value) collapsedGroups.value[cat] = false;
    }
  });

  function toggleMatMain(mainCat) { collapsedMatMain.value[mainCat] = !collapsedMatMain.value[mainCat]; }
  function toggleMatSub(mainCat, subCat) { collapsedMatSub.value[`${mainCat}_${subCat}`] = !collapsedMatSub.value[`${mainCat}_${subCat}`]; }
  function toggleGroup(category) { collapsedGroups.value[category] = !collapsedGroups.value[category]; }

  return {
    materials, works, loadData,
    searchMaterial, searchWork, onlyFavMaterials, onlyFavWorks,
    collapsedGroups, collapsedMatMain, collapsedMatSub,
    newMaterial, newWork, uniqueCategories,
    groupedMaterials, addMaterial, updateMaterial, toggleFavMaterial, deleteMaterial, toggleMatMain, toggleMatSub,
    groupedWorks, addWork, updateWork, toggleFavWork, deleteWork, toggleGroup
  };
}