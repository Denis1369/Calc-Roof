
function normalize(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(name, fragments = []) {
  return fragments.some((fragment) => name.includes(fragment))
}

function safeCode(number) {
  return `C${Math.max(1, Number(number) || 1)}`
}

function isBrmContext({ waterproofing = '', name = '', role = '' }) {
  const wp = normalize(waterproofing)
  const title = normalize(name)
  const r = normalize(role)
  return wp.includes('brm') || includesAny(title, ['унифлекс', 'техноэласт', 'технобарьер']) || ['primer_bucket', 'gas'].includes(r)
}

function isCleanAreaWorkLayer(layer) {
  return [
    'base',
    'vapor_barrier',
    'lower_insulation',
    'upper_insulation',
    'insulation',
    'slope',
    'screed',
    'primer',
    'separator',
    'waterproofing'
  ].includes(layer)
}

export function deriveTemplateCellCode({
  roofBase = '',
  waterproofing = '',
  layerCode = '',
  type = 'material',
  role = '',
  name = '',
  index = 0
}) {
  const roof = normalize(roofBase)
  const wp = normalize(waterproofing)
  const layer = normalize(layerCode)
  const title = normalize(name)
  const r = normalize(role)

  if (layer === 'base') {
    if (roof.includes('proflist')) {
      if (type === 'work') return 'C22'
      if (includesAny(title, ['заклеп']) || r === 'base_rivet') return 'C27'
      if (includesAny(title, ['harpoon', 'саморез']) || r === 'base_fastener') return 'C26'
      return 'C25'
    }

    return type === 'work' ? 'C21' : 'C25'
  }

  if (layer === 'vapor_barrier') {
    if (isBrmContext({ waterproofing: wp, name: title, role: r }) && roof.includes('concrete')) {
      if (type === 'work') {
        if (includesAny(title, ['праймер', 'нанесение'])) return 'C26'
        return 'C27'
      }

      if (includesAny(title, ['праймер']) || r === 'primer_bucket') return 'C30'
      if (includesAny(title, ['газ', 'пропан']) || r === 'gas') return 'C32'
      return 'C31'
    }

    if (type === 'work') return 'C47'
    if (includesAny(title, ['скотч', 'tape']) || r === 'tape') return 'C51'
    if (includesAny(title, ['праймер']) || r === 'primer_bucket') return 'C30'
    if (includesAny(title, ['газ', 'пропан']) || r === 'gas') return 'C32'
    return 'C50'
  }

  if (layer === 'lower_insulation') {
    if (roof.includes('concrete') && wp.includes('pvc')) {
      if (type === 'work') return includesAny(title, ['механичес', 'креплен']) ? 'C64' : 'C63'
      if (includesAny(title, ['клей', 'пена']) || r === 'adhesive') return 'C68'
      return 'C67'
    }

    if (roof.includes('concrete') && wp.includes('brm')) {
      if (type === 'work') return 'C37'
      if (includesAny(title, ['клей', 'пена']) || r === 'adhesive') return 'C41'
      return 'C40'
    }

    if (type === 'work') return includesAny(title, ['механичес', 'креплен']) ? 'C57' : 'C56'
    if (includesAny(title, ['телескоп'])) return 'C62'
    if (includesAny(title, ['саморез', 'screw'])) return 'C63'
    if (includesAny(title, ['остроконеч', 'анкер'])) return 'C64'
    return 'C61'
  }

  if (layer === 'upper_insulation' || layer === 'insulation') {
    if (type === 'work') return includesAny(title, ['механичес', 'креплен']) ? 'C57' : 'C56'
    if (includesAny(title, ['телескоп'])) return 'C62'
    if (includesAny(title, ['саморез', 'screw'])) return 'C63'
    if (includesAny(title, ['остроконеч', 'анкер'])) return 'C64'
    return 'C61'
  }

  if (layer === 'slope') {
    if (type === 'work') return includesAny(title, ['механичес', 'креплен']) ? 'C71' : 'C70'
    if (includesAny(title, ['телескоп'])) return 'C77'
    if (includesAny(title, ['саморез'])) return 'C84'
    if (includesAny(title, ['анкер'])) return 'C86'
    return safeCode(74 + Number(index || 0))
  }

  if (layer === 'screed') {
    return type === 'work' ? 'C46' : 'C49'
  }

  if (layer === 'primer') {
    return type === 'work' ? 'C62' : 'C65'
  }

  if (layer === 'separator') {
    return type === 'work' ? 'C91' : 'C98'
  }

  if (layer === 'waterproofing') {
    if (wp.includes('brm')) {
      if (type === 'work') {
        if (includesAny(title, ['механичес', 'креплен'])) return 'C71'
        return 'C70'
      }

      if (includesAny(title, ['газ', 'пропан']) || r === 'gas') return 'C75'
      if (includesAny(title, ['эпп', 'вент']) || r === 'bottom_layer') return 'C74'
      return 'C73'
    }

    if (type === 'work') {
      if (includesAny(title, ['0.5', '0,5', '0.5-1', '0,5-1', 'ветров'])) return 'C93'
      if (includesAny(title, ['механичес', 'креплен'])) return 'C94'
      return 'C92'
    }

    if (includesAny(title, ['очиститель', 'cleaner']) || r === 'cleaner') return 'C103'
    if (includesAny(title, ['анкер'])) return 'C105'
    if (includesAny(title, ['тарельчат', 'телескоп', 'держатель']) || r === 'fastener') return 'C101'
    if (includesAny(title, ['саморез', 'screw'])) return 'C102'
    return 'C100'
  }

  if (layer === 'parapets') {
    if (wp.includes('brm')) {
      if (type === 'work') {
        if (includesAny(title, ['планк', 'рейк'])) return 'C91'
        if (includesAny(title, ['усиления галтели', 'внутренних', 'внешних'])) return 'C80'
        return 'C81'
      }

      if (includesAny(title, ['планк', 'рейк'])) return 'C94'
      if (includesAny(title, ['мастик'])) return 'C95'
      if (includesAny(title, ['дюбель'])) return 'C96'
      if (includesAny(title, ['газ', 'пропан']) || r === 'gas') return 'C86'
      if (includesAny(title, ['эпп', 'вент']) || r === 'bottom_layer') return 'C85'
      return 'C84'
    }

    if (type === 'work') {
      if (includesAny(title, ['прижимн', 'краев', 'планк'])) return 'C140'
      if (Number(index || 0) === 1) return 'C131'
      return 'C130'
    }

    if (includesAny(title, ['армирован']) || r === 'main_membrane') return 'C134'
    if (includesAny(title, ['неармирован']) || r === 'aux_membrane') return 'C135'
    if (includesAny(title, ['прижимн'])) return 'C142'
    if (includesAny(title, ['краев'])) return 'C143'
    if (includesAny(title, ['крепеж', 'саморез']) || r === 'planck_fastener') return 'C144'
    if (includesAny(title, ['герметик']) || r === 'sealant') return 'C145'
    return safeCode(134 + Number(index || 0))
  }

  if (layer === 'inner_drains') {
    return type === 'work' ? 'C190' : 'C193'
  }

  if (layer === 'outer_drains') {
    return type === 'work' ? 'C191' : 'C194'
  }

  if (layer === 'aerators') {
    return type === 'work' ? 'C185' : 'C188'
  }

  if (layer === 'walkways') {
    return type === 'work' ? 'C149' : 'C152'
  }

  if (layer === 'counter_slopes' || layer === 'counter_slope') {
    return type === 'work' ? 'C160' : 'C162'
  }

  if (layer === 'fire_protection' || layer === 'fire_substrate') {
    return type === 'work' ? 'C174' : 'C177'
  }

  return safeCode((type === 'work' ? 300 : 350) + Number(index || 0))
}

export function deriveExpressionOverride({
  roofBase = '',
  waterproofing = '',
  type = 'material',
  layerCode = '',
  role = '',
  name = '',
  fallbackExpression = ''
}) {
  const roof = normalize(roofBase)
  const wp = normalize(waterproofing)
  const layer = normalize(layerCode)
  const title = normalize(name)
  const r = normalize(role)

  if (type === 'work' && isCleanAreaWorkLayer(layer)) {
    return 'S'
  }

  if (layer === 'base' && roof.includes('proflist') && type === 'material') {
    if (includesAny(title, ['заклеп']) || r === 'base_rivet') {
      return 'C22 * 3'
    }

    if (includesAny(title, ['harpoon', 'саморез']) || r === 'base_fastener') {
      return 'C22 * 1.5'
    }

    return 'C22 * 1.25'
  }

  if (layer === 'vapor_barrier') {
    if (isBrmContext({ waterproofing: wp, name: title, role: r }) && roof.includes('concrete')) {
      if (type === 'work') {
        return includesAny(title, ['праймер', 'нанесение']) ? 'S + (P * 0.2)' : 'S + (P * 0.2)'
      }

      if (includesAny(title, ['праймер']) || r === 'primer_bucket') {
        return 'max(1, ceil(C26 / 70))'
      }

      if (includesAny(title, ['газ', 'пропан']) || r === 'gas') {
        return 'C26 * 0.47'
      }

      return 'C27 * 1.15'
    }

    if (type === 'material') {
      if (includesAny(title, ['скотч', 'tape']) || r === 'tape') {
        return '((C47 / 3) + max(P, C130 + C131) + CS) / 25'
      }

      if (includesAny(title, ['праймер']) || r === 'primer_bucket') {
        return 'max(1, ceil(C26 / 70))'
      }

      if (includesAny(title, ['газ', 'пропан']) || r === 'gas') {
        return 'C26 * 0.47'
      }

      return 'C47 * 1.15'
    }

    return ''
  }

  if (layer === 'separator' && type === 'material') {
    return 'C91 * 1.18'
  }

  if (layer === 'lower_insulation') {
    if (roof.includes('concrete') && wp.includes('brm') && type === 'material') {
      if (includesAny(title, ['клей', 'пена']) || r === 'adhesive') {
        return 'max(1, ceil(C37 / 150))'
      }
      return ''
    }

    if (roof.includes('concrete') && wp.includes('pvc') && type === 'material') {
      if (includesAny(title, ['клей', 'пена']) || r === 'adhesive') {
        return 'max(1, ceil(C63 / 150))'
      }
      return ''
    }
  }

  if ((layer === 'insulation' || layer === 'upper_insulation' || layer === 'fire_protection' || layer === 'fire_substrate') && type === 'material') {
    if (includesAny(title, ['телескоп'])) return 'C57 * 5'
    if (includesAny(title, ['саморез', 'анкер'])) return 'C57 * 5'
    return ''
  }

  if (layer === 'waterproofing') {
    if (wp.includes('brm') && type === 'material') {
      if (includesAny(title, ['газ', 'пропан']) || r === 'gas') {
        return '(C70 * 0.47) * 2'
      }

      if (includesAny(title, ['эпп', 'вент']) || r === 'bottom_layer') {
        return 'C73'
      }

      return 'C70 * 1.16'
    }

    if (type === 'material') {
      if (includesAny(title, ['очиститель', 'cleaner']) || r === 'cleaner') {
        return 'max(1, ceil(max(C100, S) / 500))'
      }

      if (includesAny(title, ['телескоп', 'тарельчат', 'держатель']) || r === 'fastener') {
        return 'max(C94, C92 + C93, S) * 5'
      }

      if (includesAny(title, ['саморез', 'анкер'])) {
        return 'max(C94, C92 + C93, S) * 5'
      }

      if (includesAny(title, ['мембрана', 'logicroof'])) {
        return 'max(C92 + C93, S) * [ПВХ рулон 1,05 м]'
      }
    }

    return ''
  }

  if (layer === 'parapets') {
    if (wp.includes('brm') && type === 'material') {
      if (includesAny(title, ['планк', 'рейк'])) {
        return 'C91'
      }

      if (includesAny(title, ['мастик'])) {
        return 'C94 / 5'
      }

      if (includesAny(title, ['дюбель'])) {
        return 'C94 / 0.2'
      }

      if (includesAny(title, ['газ', 'пропан']) || r === 'gas') {
        return 'C81 * 0.196'
      }

      if (includesAny(title, ['эпп', 'вент']) || r === 'bottom_layer') {
        return '(C81 * 0.55 * 1.2) + (C81 * 0.35 * 1.2)'
      }

      return 'C81 * 0.8 * 1.2'
    }

    if (type === 'material') {
      if (includesAny(title, ['армирован']) || r === 'main_membrane') {
        return 'max(P, C130 + C131) * [Мембрана на парапет]'
      }

      if (includesAny(title, ['неармирован']) || r === 'aux_membrane') {
        return 'max(P, C130 + C131) * [Доборная мембрана парапета]'
      }

      if (includesAny(title, ['прижимн'])) {
        return 'max(P, C130 + C131)'
      }

      if (includesAny(title, ['краев'])) {
        return 'max(P, C130 + C131)'
      }

      if (includesAny(title, ['крепеж', 'саморез']) || r === 'planck_fastener') {
        return 'max(P, C130 + C131) * [Крепеж планок]'
      }

      if (includesAny(title, ['герметик']) || r === 'sealant') {
        return 'max(P, C130 + C131) * [Герметик планок]'
      }
    }

    return ''
  }

  if (layer === 'inner_drains' && type === 'material' && r === 'item_count') {
    return 'ID'
  }

  if (layer === 'outer_drains' && type === 'material' && r === 'item_count') {
    return 'OD'
  }

  if (layer === 'aerators' && type === 'material' && r === 'item_count') {
    return 'A'
  }

  if (layer === 'walkways' && type === 'material' && r === 'walkway_item') {
    return 'WL / 0.6'
  }

  if ((layer === 'counter_slopes' || layer === 'counter_slope') && type === 'work') {
    return 'K'
  }

  return ''
}
