import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { getDb } from '../database.js';
import { evaluate } from 'mathjs';
import Swal from 'sweetalert2';

const SkYugSwal = Swal.mixin({
  background: '#37444B',       
  color: '#FFFFFF',           
  confirmButtonColor: '#F29A2E', 
  cancelButtonColor: '#4A5A63',  
  borderRadius: '8px',
});

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  background: '#37444B',
  color: '#FFFFFF',
  iconColor: '#F29A2E',
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

export function useCalculator() {
  const route = useRoute(); 
  const projectName = ref('');
  const vatRate = ref(20); 

  const worksDb = ref([]);
  const materialsDb = ref([]);
  const formulasDb = ref([]);
  const coefficientsDb = ref([]);
  const macrosDb = ref([]); 
  const savedTemplatesDb = ref([]);

  const estimateZones = ref([]);

  const overheadExpenses = ref([
    { name: 'Организационные расходы (доставка + накладные)', unit: 'ед', qty: 1, price: 0 },
    { name: 'Утилизация строительного мусора', unit: 'ед', qty: 1, price: 0 }
  ]);

  let nextId = 1000;
  const codeCounters = ref({ work: 1, mat: 1 }); 

  const isTemplateDropdownOpen = ref(false);
  const dropdownRef = ref(null);

  const closeDropdown = (e) => {
    if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
      isTemplateDropdownOpen.value = false;
    }
  };

  const selectTemplate = (id) => {
    addZoneFromTemplate(id);
    isTemplateDropdownOpen.value = false; 
  };

  function applySupplierToZone(zone) {
    if (!zone || !zone.sections) return;
    zone.sections.forEach(sec => {
      sec.materials.forEach(mat => {
        mat.supplier = zone.supplierType;
      });
    });
  }

  const globalRoofParams = computed(() => {
    return estimateZones.value.reduce((acc, zone) => {
      acc.area += (zone.roofParams?.area || 0);
      acc.perimeter += (zone.roofParams?.perimeter || 0);
      acc.parapetDrains += (zone.roofParams?.parapetDrains || 0);
      acc.innerDrains += (zone.roofParams?.innerDrains || 0);
      acc.aerators += (zone.roofParams?.aerators || 0);
      return acc;
    }, { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 });
  });

  const loadDatabases = async () => {
    document.addEventListener('click', closeDropdown);
    try {
      const db = await getDb();
      worksDb.value = await db.select('SELECT * FROM Справочник_видов_работ');
      materialsDb.value = await db.select('SELECT * FROM Справочник_материалов');
      formulasDb.value = await db.select('SELECT * FROM Справочник_формул');
      coefficientsDb.value = await db.select('SELECT * FROM Справочник_коэффициентов');
      
      try { macrosDb.value = await db.select('SELECT * FROM Справочник_макросов'); } catch (e) {}
      try { savedTemplatesDb.value = await db.select('SELECT * FROM Справочник_шаблонов'); } catch(e) {}

      const presetId = route.query.preset;
      if (presetId) {
        await addZoneFromTemplate(presetId);
      } else if (estimateZones.value.length === 0) {
        addZone(); 
      }
    } catch (error) {
      console.error('Ошибка при загрузке баз данных:', error);
    }
  };

  const unloadDatabases = () => {
    document.removeEventListener('click', closeDropdown);
  };

  function updateWorkPrice(work) {
    if (!work.name) return;
    const dbItem = worksDb.value.find(w => w.наименование_работы === work.name);
    if (dbItem) {
      work.unit = dbItem.единица_измерения_работы;
      let qty = work.qty || 0;
      let p = dbItem.цена_0_300;
      if (qty > 300) p = dbItem.цена_300_600;
      if (qty > 600) p = dbItem.цена_600_1000;
      if (qty > 1000) p = dbItem.цена_1000_3000;
      if (qty > 3000) p = dbItem.цена_3000_6000;
      if (qty > 6000) p = dbItem.цена_6000_15000;
      if (qty > 15000) p = dbItem.цена_15000_30000;
      if (qty > 30000) p = dbItem.цена_более_30000;
      work.price = p; 
    }
  }

  function updateMaterialPrice(mat) {
    if (!mat.name) return;
    const dbItem = materialsDb.value.find(m => m.полное_наименование_материала === mat.name);
    if (dbItem) {
      mat.unit = dbItem.единица_измерения;
      mat.price = dbItem.базовая_цена;
    }
  }

  function onWorkNameChange(work, section, zone) {
    updateWorkPrice(work);
    recalculateVolumes();
  }

  function onMaterialNameChange(mat) {
    updateMaterialPrice(mat);
    recalculateVolumes();
  }

  function applyFormula(item) {
    if (item.expression) {
      const dbFormula = formulasDb.value.find(f => f.название_формулы === item.expression);
      if (dbFormula) item.expression = dbFormula.выражение;
    }
    recalculateVolumes();
  }

  function assignMissingCodes() {
    let maxWork = 0;
    let maxMat = 0;
    estimateZones.value.forEach(zone => {
      zone.sections.forEach(sec => {
        sec.works.forEach(w => {
          if (w.code && w.code.startsWith('Р')) {
            const num = parseInt(w.code.substring(1));
            if (!isNaN(num) && num > maxWork) maxWork = num;
          }
        });
        sec.materials.forEach(m => {
          if (m.code && m.code.startsWith('М')) {
            const num = parseInt(m.code.substring(1));
            if (!isNaN(num) && num > maxMat) maxMat = num;
          }
        });
      });
    });
    
    codeCounters.value.work = maxWork + 1;
    codeCounters.value.mat = maxMat + 1;
    
    estimateZones.value.forEach(zone => {
      zone.sections.forEach(sec => {
        sec.works.forEach(w => { if (!w.code) w.code = 'Р' + codeCounters.value.work++; });
        sec.materials.forEach(m => { 
          if (!m.code) m.code = 'М' + codeCounters.value.mat++; 
          if (!m.supplier) m.supplier = zone.supplierType || 'ТехноНИКОЛЬ'; 
        });
      });
    });
  }

  function parseAndEvaluate(expr, itemsMap, currentCode, currentName, zone) {
    if (!expr && expr !== 0) return 0;
    let exprStr = String(expr).trim().replace(/,/g, '.');
    if (exprStr === '') return 0;

    try {
      let parsedExpr = exprStr.replace(/\[(.*?)\]/g, (match, paramName) => {
        let cleanName = paramName.trim();
        const codeMatch = cleanName.match(/^([pPрРmMмМ])(\d+)$/);
        if (codeMatch) {
          const letter = codeMatch[1];
          const num = codeMatch[2];
          if (['p', 'P', 'р', 'Р'].includes(letter)) cleanName = 'Р' + num;
          else if (['m', 'M', 'м', 'М'].includes(letter)) cleanName = 'М' + num;
        }
        if (cleanName === currentCode || (currentName && cleanName === currentName.trim())) return 1; 

        const coef = coefficientsDb.value.find(c => c.название === cleanName);
        if (coef) return coef.значение;

        if (itemsMap && itemsMap[cleanName] !== undefined) return itemsMap[cleanName];
        return 1;
      });

      const context = {
        S: zone.roofParams?.area || 0,        s: zone.roofParams?.area || 0,
        P: zone.roofParams?.perimeter || 0,   p: zone.roofParams?.perimeter || 0,
        ID: zone.roofParams?.innerDrains || 0, id: zone.roofParams?.innerDrains || 0,
        A: zone.roofParams?.aerators || 0,    a: zone.roofParams?.aerators || 0
      };

      if (zone.customParams) {
        zone.customParams.forEach(cp => {
          if (cp.symbol) {
            context[cp.symbol] = cp.value || 0;
            context[cp.symbol.toLowerCase()] = cp.value || 0;
          }
        });
      }
      
      return Number(evaluate(parsedExpr, context).toFixed(2));
    } catch (e) {
      return 0;
    }
  }

  function recalculateVolumes() {
    assignMissingCodes();
    const itemsMap = {};
    for (let pass = 0; pass < 3; pass++) {
      estimateZones.value.forEach(zone => {
        if (!zone.roofParams) zone.roofParams = { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 };
        const zParams = zone.roofParams;

        zone.sections.forEach(section => {
          section.works.forEach(work => {
            let val = parseAndEvaluate(work.expression, itemsMap, work.code, work.name, zone); 
            if (work.code) itemsMap[work.code] = val;
            if (work.name) itemsMap[work.name.trim()] = val;
            if (pass === 2) { work.qty = val; updateWorkPrice(work); }
          });
          
          section.materials.forEach(mat => {
            let val = parseAndEvaluate(mat.expression, itemsMap, mat.code, mat.name, zone); 
            if (mat.code) itemsMap[mat.code] = val;
            if (mat.name) itemsMap[mat.name.trim()] = val;
            if (pass === 2) mat.qty = val;
          });
        });
      });
    }
  }

  async function saveProject() {
    if (!projectName.value) { 
      SkYugSwal.fire('Внимание!', 'Пожалуйста, укажите название проекта!', 'warning'); 
      return; 
    }
    try {
      const db = await getDb();
      const projectSnapshot = { vatRate: vatRate.value, estimateZones: estimateZones.value, overheadExpenses: overheadExpenses.value };
      await db.execute('INSERT INTO Сохраненные_сметы (название_объекта, данные_сметы_json) VALUES ($1, $2)', [projectName.value, JSON.stringify(projectSnapshot)]);
      
      Toast.fire({ icon: 'success', title: 'Смета успешно сохранена!' });
    } catch (error) { 
      console.error('Ошибка сохранения:', error); 
      Toast.fire({ icon: 'error', title: 'Ошибка при сохранении' });
    }
  }

  async function loadProject() {
    const { value: projectId } = await SkYugSwal.fire({
      title: 'Загрузка сметы',
      text: 'Введите ID сохраненной сметы:',
      input: 'text',
      showCancelButton: true,
      confirmButtonText: 'Загрузить',
      cancelButtonText: 'Отмена'
    });

    if (!projectId) return;

    try {
      const db = await getDb();
      const result = await db.select('SELECT данные_сметы_json, название_объекта FROM Сохраненные_сметы WHERE идентификатор = $1', [Number(projectId)]);
      if (result.length > 0) {
        const loadedData = JSON.parse(result[0].данные_сметы_json);
        vatRate.value = loadedData.vatRate !== undefined ? loadedData.vatRate : 22; 
        const fallbackParams = loadedData.roofParams || { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 };
        
        estimateZones.value = loadedData.estimateZones || [];
        estimateZones.value.forEach(zone => {
          if (!zone.supplierType) zone.supplierType = 'ТехноНИКОЛЬ';
          if (!zone.roofParams) zone.roofParams = { ...fallbackParams };
          zone.sections.forEach(sec => {
            sec.works.forEach(w => { if (w.expression === undefined) w.expression = w.qty; });
            sec.materials.forEach(m => { 
              if (m.expression === undefined) m.expression = m.qty; 
              if (!m.supplier) m.supplier = zone.supplierType; 
            });
          });
        });
        overheadExpenses.value = loadedData.overheadExpenses || [];
        projectName.value = result[0].название_объекта;
        recalculateVolumes(); 
        
        Toast.fire({ icon: 'success', title: 'Смета загружена!' });
      } else {
        SkYugSwal.fire('Не найдено', 'Смета с таким ID не найдена.', 'error');
      }
    } catch (error) { 
      console.error('Ошибка загрузки:', error); 
    }
  }

  function addZone() { 
    estimateZones.value.push({ 
      id: nextId++, name: 'Новый участок (ось)', supplierType: 'ТехноНИКОЛЬ',
      roofParams: { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 },
      customParams: [],
      sections: [] 
    }); 
  }

  async function addZoneFromTemplate(templateId) {
    const tmpl = savedTemplatesDb.value.find(t => t.идентификатор === Number(templateId));
    if (!tmpl) return;
    
    let parsedData = JSON.parse(tmpl.данные_json || '{}');
    let parsedSections = [];
    let parsedCustomParams = [];

    if (Array.isArray(parsedData)) {
      parsedSections = parsedData;
    } else {
      parsedSections = parsedData.sections || [];
      parsedCustomParams = parsedData.customParams || [];
    }
    
    estimateZones.value.push({
      id: nextId++, name: `Монтаж системы: ${tmpl.название}`, supplierType: 'ТехноНИКОЛЬ',
      roofParams: { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 },
      customParams: parsedCustomParams.map(p => ({ symbol: p.symbol, name: p.name, value: 0 })),
      sections: parsedSections.map(sec => ({
        ...sec, id: nextId++,
        works: sec.works.map(w => ({ ...w, code: 'Р' + codeCounters.value.work++, qty: 0, price: 0 })),
        materials: sec.materials.map(m => ({ ...m, code: 'М' + codeCounters.value.mat++, supplier: 'ТехноНИКОЛЬ', qty: 0, price: 0 }))
      }))
    });
    setTimeout(() => {
      estimateZones.value.forEach(zone => {
        zone.sections.forEach(sec => {
          sec.works.forEach(w => updateWorkPrice(w));
          sec.materials.forEach(m => updateMaterialPrice(m));
        });
      });
      recalculateVolumes();
    }, 100);
  }

  async function removeZone(index) { 
    const { isConfirmed } = await SkYugSwal.fire({
      title: 'Удалить участок?',
      text: "Это действие нельзя отменить!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Да, удалить',
      cancelButtonText: 'Отмена'
    });
    
    if (isConfirmed) {
      estimateZones.value.splice(index, 1);
      Toast.fire({ icon: 'info', title: 'Участок удален' });
    }
  }

  function addSection(zone) { zone.sections.push({ id: nextId++, title: 'Новый раздел', works: [], materials: [] }); }
  
  async function removeSection(zone, sIdx) { 
    const { isConfirmed } = await SkYugSwal.fire({
      title: 'Удалить раздел?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Да, удалить',
      cancelButtonText: 'Отмена'
    });

    if (isConfirmed) {
      zone.sections.splice(sIdx, 1);
    }
  }

  function addWork(section) { section.works.push({ code: 'Р' + codeCounters.value.work++, name: '', unit: 'м2', expression: '', qty: 0, price: 0 }); }
  function addMaterial(section, zone) { section.materials.push({ code: 'М' + codeCounters.value.mat++, name: '', supplier: zone.supplierType || 'ТехноНИКОЛЬ', unit: 'шт', expression: '', qty: 0, price: 0 }); }
  function addExpense() { overheadExpenses.value.push({ name: 'Новый расход', unit: 'ед', qty: 1, price: 0 }); }

  async function addCustomParam(zone) {
    const { value: name } = await SkYugSwal.fire({
      title: 'Новая переменная',
      text: 'Название (например: Длина конька):',
      input: 'text',
      showCancelButton: true,
      confirmButtonText: 'Далее',
      cancelButtonText: 'Отмена',
      inputValidator: (value) => {
        if (!value) return 'Название не может быть пустым!'
      }
    });

    if (!name) return;

    const { value: symbol } = await SkYugSwal.fire({
      title: 'Символ переменной',
      text: 'Символ для формул (английская буква, например: L):',
      input: 'text',
      showCancelButton: true,
      confirmButtonText: 'Добавить',
      cancelButtonText: 'Отмена',
      inputValidator: (value) => {
        if (!value) return 'Символ не может быть пустым!'
        if (!/^[a-zA-Z]+$/.test(value)) return 'Используйте только английские буквы!'
      }
    });

    if (!symbol) return;
    
    const cleanSymbol = symbol.trim().toUpperCase();

    if (!zone.customParams) zone.customParams = [];
    zone.customParams.push({ name, symbol: cleanSymbol, value: 0 });
    
    Toast.fire({ icon: 'success', title: `Переменная ${cleanSymbol} добавлена` });
  }

  const getSectionTotal = (section) => {
    const worksTotal = section.works.reduce((sum, w) => sum + ((w.qty||0) * (w.price||0)), 0);
    const matTotal = section.materials.reduce((sum, m) => sum + ((m.qty||0) * (m.price||0)), 0);
    return worksTotal + matTotal;
  };

  const grandTotalWorks = computed(() => {
    return estimateZones.value.reduce((zoneSum, zone) => {
      return zoneSum + zone.sections.reduce((secSum, sec) => secSum + sec.works.reduce((sum, w) => sum + ((w.qty||0) * (w.price||0)), 0), 0);
    }, 0);
  });

  const grandTotalMaterials = computed(() => {
    return estimateZones.value.reduce((zoneSum, zone) => {
      return zoneSum + zone.sections.reduce((secSum, sec) => secSum + sec.materials.reduce((sum, m) => sum + ((m.qty||0) * (m.price||0)), 0), 0);
    }, 0);
  });

  const totalExpenses = computed(() => overheadExpenses.value.reduce((sum, e) => sum + ((e.qty||0) * (e.price||0)), 0));
  const subTotalWithoutVat = computed(() => grandTotalWorks.value + grandTotalMaterials.value + totalExpenses.value);
  const vatAmount = computed(() => subTotalWithoutVat.value * (vatRate.value / 100));
  const finalGrandTotalWithVat = computed(() => subTotalWithoutVat.value + vatAmount.value);

  function printEstimate() { window.print(); }

  return {
    projectName, vatRate, estimateZones, overheadExpenses, worksDb, materialsDb, formulasDb, savedTemplatesDb,
    isTemplateDropdownOpen, dropdownRef, closeDropdown, selectTemplate, applySupplierToZone,
    globalRoofParams, loadDatabases, unloadDatabases, onWorkNameChange, onMaterialNameChange, applyFormula, recalculateVolumes,
    saveProject, loadProject, addZone, addZoneFromTemplate, removeZone, addSection, removeSection, addWork, addMaterial, addExpense,
    addCustomParam,
    getSectionTotal, grandTotalWorks, grandTotalMaterials, totalExpenses, subTotalWithoutVat, vatAmount, finalGrandTotalWithVat, printEstimate
  }
}