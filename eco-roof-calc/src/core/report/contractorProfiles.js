export const DEFAULT_CONTRACTOR_PROFILE_ID = 'sk-yug'

export const CONTRACTOR_PROFILES = [
  {
    id: 'sk-yug',
    label: 'ООО «СК-ЮГ»',
    name: 'ООО «СК-ЮГ»',
    innKppLabel: 'ИНН / КПП: 2312330110 / 231201001',
    signatureLabel: 'Зам. ген. директора __________________ / Скуратовский М.О. /',
    requisites: [
      'ОГРН: 1242300053533',
      'СРО: СРО-2312330110-20260212-1027',
      'Адрес: 350911, Краснодарский край, г. Краснодар, ул. им. Евдокии Бершанской, д. 72',
      'Тел.: 8 (800) 101-51-24; 8 (861) 292-70-30',
      'Сайт: https://sk-ug23.ru/',
      'E-mail: info@skkrd23.ru'
    ]
  },
  {
    id: 'ip-skuratovskaya',
    label: 'ИП Скуратовская',
    name: 'ИП Скуратовская Н.С.',
    innKppLabel: 'ИНН: 230556544100',
    signatureLabel: 'ИП __________________ / Скуратовская Н.С. /',
    requisites: [
      'ОГРНИП: 324237500449441',
      'Адрес: 350911, Краснодарский край, г. Краснодар, ул. им. Мачуги В.Н., д. 6/2, кв. 9',
      'Тел.: +7 (918) 246-28-44',
      'Р/с: 40802810826180006687',
      'К/с: 30101810500000000207',
      'БИК: 046015207',
      'Банк: ФИЛИАЛ «РОСТОВСКИЙ» АО «АЛЬФА-БАНК»',
      'E-mail: mo@skuratovskii.ru'
    ]
  }
]

export function resolveContractorProfile(profileId) {
  return (
    CONTRACTOR_PROFILES.find((profile) => profile.id === profileId) ||
    CONTRACTOR_PROFILES.find((profile) => profile.id === DEFAULT_CONTRACTOR_PROFILE_ID) ||
    CONTRACTOR_PROFILES[0]
  )
}
