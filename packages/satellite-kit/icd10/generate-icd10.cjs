"use strict";

/**
 * WHO ICD-10 (2019) catalog generator — NOT ICD-10-CM, NOT ICD-11.
 * Produces CHAPTER / BLOCK / CATEGORY / LEAF rows for clinic IcdCode seed.
 */

const ICD10_VERSION = "WHO-ICD-10-2019";

/** @type {Array<[string, string, string, string, string]>} range, roman, en, ru, az */
const CHAPTERS = [
  ["A00-B99", "I", "Certain infectious and parasitic diseases", "Некоторые инфекционные и паразитарные болезни", "Bəzi infeksion və parazitar xəstəliklər"],
  ["C00-D48", "II", "Neoplasms", "Новообразования", "Yenitörəmələr"],
  ["D50-D89", "III", "Diseases of the blood and blood-forming organs and certain disorders involving the immune mechanism", "Болезни крови, кроветворных органов и отдельные нарушения, вовлекающие иммунный механизм", "Qan və qanyaradıcı orqanların xəstəlikləri və immun mexanizmi əhatə edən bəzi pozğunluqlar"],
  ["E00-E90", "IV", "Endocrine, nutritional and metabolic diseases", "Болезни эндокринной системы, расстройства питания и нарушения обмена веществ", "Endokrin sistem xəstəlikləri, qidalanma pozğunluqları və maddələr mübadiləsi pozğunluqları"],
  ["F00-F99", "V", "Mental and behavioural disorders", "Психические расстройства и расстройства поведения", "Psixi və davranış pozğunluqları"],
  ["G00-G99", "VI", "Diseases of the nervous system", "Болезни нервной системы", "Sinir sistemi xəstəlikləri"],
  ["H00-H59", "VII", "Diseases of the eye and adnexa", "Болезни глаза и его придаточного аппарата", "Göz və onun əlavə aparatının xəstəlikləri"],
  ["H60-H95", "VIII", "Diseases of the ear and mastoid process", "Болезни уха и сосцевидного отростка", "Qulaq və məməyəbənzər çıxıntı xəstəlikləri"],
  ["I00-I99", "IX", "Diseases of the circulatory system", "Болезни системы кровообращения", "Qan dövranı sistemi xəstəlikləri"],
  ["J00-J99", "X", "Diseases of the respiratory system", "Болезни органов дыхания", "Tənəffüs orqanları xəstəlikləri"],
  ["K00-K93", "XI", "Diseases of the digestive system", "Болезни органов пищеварения", "Həzm orqanları xəstəlikləri"],
  ["L00-L99", "XII", "Diseases of the skin and subcutaneous tissue", "Болезни кожи и подкожной клетчатки", "Dəri və dərialtı toxuma xəstəlikləri"],
  ["M00-M99", "XIII", "Diseases of the musculoskeletal system and connective tissue", "Болезни костно-мышечной системы и соединительной ткани", "Sümük-əzələ sistemi və birləşdirici toxuma xəstəlikləri"],
  ["N00-N99", "XIV", "Diseases of the genitourinary system", "Болезни мочеполовой системы", "Sidik-cinsiyyət sistemi xəstəlikləri"],
  ["O00-O99", "XV", "Pregnancy, childbirth and the puerperium", "Беременность, роды и послеродовой период", "Hamiləlik, doğuş və doğuşdan sonrakı dövr"],
  ["P00-P96", "XVI", "Certain conditions originating in the perinatal period", "Отдельные состояния, возникающие в перинатальном периоде", "Perinatal dövrdə yaranan bəzi vəziyyətlər"],
  ["Q00-Q99", "XVII", "Congenital malformations, deformations and chromosomal abnormalities", "Врожденные аномалии [пороки развития], деформации и хромосомные нарушения", "Anadangəlmə anomaliyalar, deformasiyalar və xromosom pozğunluqları"],
  ["R00-R99", "XVIII", "Symptoms, signs and abnormal clinical and laboratory findings, not elsewhere classified", "Симптомы, признаки и отклонения от нормы, выявленные при клинических и лабораторных исследованиях, не классифицированные в других рубриках", "Simptomlar, əlamətlər və digər rubrikalarda təsnif edilməyən klinik və laborator sapmalar"],
  ["S00-T98", "XIX", "Injury, poisoning and certain other consequences of external causes", "Травмы, отравления и некоторые другие последствия воздействия внешних причин", "Travmalar, zəhərlənmələr və xarici səbəblərin digər nəticələri"],
  ["V01-Y98", "XX", "External causes of morbidity and mortality", "Внешние причины заболеваемости и смертности", "Xəstələnmə və ölümün xarici səbəbləri"],
  ["Z00-Z99", "XXI", "Factors influencing health status and contact with health services", "Факторы, влияющие на состояние здоровья населения и обращения в учреждения здравоохранения", "Əhalinin sağlamlıq vəziyyətinə və səhiyyə xidmətlərinə müraciətə təsir edən amillər"],
  ["U00-U89", "XXII", "Codes for special purposes", "Коды для специальных целей", "Xüsusi məqsədlər üçün kodlar"],
];

/** @type {Array<[string, string, string, string]>} range, en, ru, az */
const BLOCKS = [
  ["A00-A09", "Intestinal infectious diseases", "Кишечные инфекции", "Bağırsaq infeksiyaları"],
  ["A15-A19", "Tuberculosis", "Туберкулез", "Vərəm"],
  ["A20-A28", "Certain zoonotic bacterial diseases", "Некоторые бактериальные зоонозы", "Bəzi bakterial zoonozlar"],
  ["A30-A49", "Other bacterial diseases", "Другие бактериальные болезни", "Digər bakterial xəstəliklər"],
  ["A50-A64", "Infections with a predominantly sexual mode of transmission", "Инфекции, передающиеся преимущественно половым путем", "Əsasən cinsi yolla ötürülən infeksiyalar"],
  ["A65-A69", "Other spirochaetal diseases", "Другие болезни, вызываемые спирохетами", "Spiroxetlərin törətdiyi digər xəstəliklər"],
  ["A70-A74", "Other diseases caused by chlamydiae", "Другие болезни, вызываемые хламидиями", "Xlamidiyaların törətdiyi digər xəstəliklər"],
  ["A75-A79", "Rickettsioses", "Риккетсиозы", "Rikketsiozlar"],
  ["A80-A89", "Viral infections of the central nervous system", "Вирусные инфекции центральной нервной системы", "Mərkəzi sinir sisteminin virus infeksiyaları"],
  ["A90-A99", "Arthropod-borne viral fevers and viral haemorrhagic fevers", "Вирусные лихорадки, передаваемые членистоногими, и вирусные геморрагические лихорадки", "Artropodlarla ötürülən virus qızdırmaları və virus hemorragik qızdırmaları"],
  ["B00-B09", "Viral infections characterized by skin and mucous membrane lesions", "Вирусные инфекции, характеризующиеся поражениями кожи и слизистых оболочек", "Dəri və selikli qişa zədələnmələri ilə xarakterizə olunan virus infeksiyaları"],
  ["B15-B19", "Viral hepatitis", "Вирусный гепатит", "Virus hepatiti"],
  ["B20-B24", "Human immunodeficiency virus [HIV] disease", "Болезнь, вызванная вирусом иммунодефицита человека [ВИЧ]", "İnsan immunçatışmazlığı virusu [HİV] xəstəliyi"],
  ["B25-B34", "Other viral diseases", "Другие вирусные болезни", "Digər virus xəstəlikləri"],
  ["B35-B49", "Mycoses", "Микозы", "Mikozlar"],
  ["B50-B64", "Protozoal diseases", "Протозойные болезни", "Protozoy xəstəlikləri"],
  ["B65-B83", "Helminthiases", "Гельминтозы", "Helmintozlar"],
  ["B85-B89", "Pediculosis, acariasis and other infestations", "Педикулез, акариаз и другие инфестации", "Pedikulyoz, akarioz və digər infestasiyalar"],
  ["B90-B94", "Sequelae of infectious and parasitic diseases", "Последствия инфекционных и паразитарных болезней", "İnfeksion və parazitar xəstəliklərin nəticələri"],
  ["B95-B98", "Bacterial, viral and other infectious agents", "Бактериальные, вирусные и другие инфекционные агенты", "Bakterial, virus və digər infeksiya agentləri"],
  ["B99-B99", "Other infectious diseases", "Другие инфекционные болезни", "Digər infeksion xəstəliklər"],
  ["C00-C14", "Malignant neoplasms of lip, oral cavity and pharynx", "Злокачественные новообразования губы, полости рта и глотки", "Dodaq, ağız boşluğu və udlağın bədxassəli yenitörəmələri"],
  ["C15-C26", "Malignant neoplasms of digestive organs", "Злокачественные новообразования органов пищеварения", "Həzm orqanlarının bədxassəli yenitörəmələri"],
  ["C30-C39", "Malignant neoplasms of respiratory and intrathoracic organs", "Злокачественные новообразования органов дыхания и грудной клетки", "Tənəffüs və döş qəfəsi orqanlarının bədxassəli yenitörəmələri"],
  ["C40-C41", "Malignant neoplasms of bone and articular cartilage", "Злокачественные новообразования костей и суставных хрящей", "Sümük və oynaq qığırdağının bədxassəli yenitörəmələri"],
  ["C43-C44", "Melanoma and other malignant neoplasms of skin", "Меланома и другие злокачественные новообразования кожи", "Melanoma və digər dəri bədxassəli yenitörəmələri"],
  ["C45-C49", "Malignant neoplasms of mesothelial and soft tissue", "Злокачественные новообразования мезотелиальной и мягких тканей", "Mezotelial və yumşaq toxumaların bədxassəli yenitörəmələri"],
  ["C50-C50", "Malignant neoplasm of breast", "Злокачественное новообразование молочной железы", "Süd vəzisinin bədxassəli yenitörəməsi"],
  ["C51-C58", "Malignant neoplasms of female genital organs", "Злокачественные новообразования женских половых органов", "Qadın cinsiyyət orqanlarının bədxassəli yenitörəmələri"],
  ["C60-C63", "Malignant neoplasms of male genital organs", "Злокачественные новообразования мужских половых органов", "Kişi cinsiyyət orqanlarının bədxassəli yenitörəmələri"],
  ["C64-C68", "Malignant neoplasms of urinary tract", "Злокачественные новообразования мочевых путей", "Sidik yollarının bədxassəli yenitörəmələri"],
  ["C69-C72", "Malignant neoplasms of eye, brain and other parts of central nervous system", "Злокачественные новообразования глаза, головного мозга и других отделов ЦНС", "Göz, beyin və digər MSS hissələrinin bədxassəli yenitörəmələri"],
  ["C73-C75", "Malignant neoplasms of thyroid and other endocrine glands", "Злокачественные новообразования щитовидной железы и других эндокринных желез", "Qalxanabənzər və digər endokrin vəzilərin bədxassəli yenitörəmələri"],
  ["C76-C80", "Malignant neoplasms of ill-defined, secondary and unspecified sites", "Злокачественные новообразования неточно обозначенных, вторичных и неуточненных локализаций", "Qeyri-dəqiq, ikincili və dəqiqləşdirilməmiş lokalizasiyalı bədxassəli yenitörəmələr"],
  ["C81-C96", "Malignant neoplasms of lymphoid, haematopoietic and related tissue", "Злокачественные новообразования лимфоидной, кроветворной и родственных им тканей", "Limfoid, qanyaradıcı və əlaqəli toxumaların bədxassəli yenitörəmələri"],
  ["C97-C97", "Malignant neoplasms of independent (primary) multiple sites", "Злокачественные новообразования самостоятельных (первичных) множественных локализаций", "Müstəqil (ilkin) çoxsaylı lokalizasiyalı bədxassəli yenitörəmələr"],
  ["D00-D09", "In situ neoplasms", "Новообразования in situ", "In situ yenitörəmələr"],
  ["D10-D36", "Benign neoplasms", "Доброкачественные новообразования", "Xoşxassəli yenitörəmələr"],
  ["D37-D48", "Neoplasms of uncertain or unknown behaviour", "Новообразования неопределенного или неизвестного характера", "Qeyri-müəyyən və ya naməlum xarakterli yenitörəmələr"],
  ["D50-D53", "Nutritional anaemias", "Анемии, связанные с питанием", "Qidalanma ilə bağlı anemiyalar"],
  ["D55-D59", "Haemolytic anaemias", "Гемолитические анемии", "Hemolitik anemiyalar"],
  ["D60-D64", "Aplastic and other anaemias", "Апластические и другие анемии", "Aplastik və digər anemiyalar"],
  ["D65-D69", "Coagulation defects, purpura and other haemorrhagic conditions", "Нарушения свертываемости крови, пурпура и другие геморрагические состояния", "Qanın laxtalanma pozğunluqları, purpura və digər hemorragik vəziyyətlər"],
  ["D70-D77", "Other diseases of blood and blood-forming organs", "Другие болезни крови и кроветворных органов", "Qan və qanyaradıcı orqanların digər xəstəlikləri"],
  ["D80-D89", "Certain disorders involving the immune mechanism", "Отдельные нарушения, вовлекающие иммунный механизм", "İmmun mexanizmi əhatə edən bəzi pozğunluqlar"],
  ["E00-E07", "Disorders of thyroid gland", "Болезни щитовидной железы", "Qalxanabənzər vəzi xəstəlikləri"],
  ["E10-E14", "Diabetes mellitus", "Сахарный диабет", "Şəkərli diabet"],
  ["E15-E16", "Other disorders of glucose regulation and pancreatic internal secretion", "Другие нарушения регуляции глюкозы и внутренней секреции поджелудочной железы", "Qlükoza tənzimlənməsi və mədəaltı vəzinin daxili sekresiyasının digər pozğunluqları"],
  ["E20-E35", "Disorders of other endocrine glands", "Нарушения других эндокринных желез", "Digər endokrin vəzilərin pozğunluqları"],
  ["E40-E46", "Malnutrition", "Недостаточность питания", "Qidalanma çatışmazlığı"],
  ["E50-E64", "Other nutritional deficiencies", "Другие виды недостаточности питания", "Digər qidalanma çatışmazlıqları"],
  ["E65-E68", "Obesity and other hyperalimentation", "Ожирение и другие виды избыточности питания", "Piylənmə və digər həddindən artıq qidalanma"],
  ["E70-E90", "Metabolic disorders", "Нарушения обмена веществ", "Maddələr mübadiləsi pozğunluqları"],
  ["F00-F09", "Organic, including symptomatic, mental disorders", "Органические, включая симптоматические, психические расстройства", "Üzvi, o cümlədən simptomatik psixi pozğunluqlar"],
  ["F10-F19", "Mental and behavioural disorders due to psychoactive substance use", "Психические расстройства и расстройства поведения, связанные с употреблением психоактивных веществ", "Psixoaktiv maddələrin istifadəsi ilə bağlı psixi və davranış pozğunluqları"],
  ["F20-F29", "Schizophrenia, schizotypal and delusional disorders", "Шизофрения, шизотипические и бредовые расстройства", "Şizofreniya, şizotipik və hezeyanlı pozğunluqlar"],
  ["F30-F39", "Mood [affective] disorders", "Расстройства настроения [аффективные расстройства]", "Əhval [affektiv] pozğunluqları"],
  ["F40-F48", "Neurotic, stress-related and somatoform disorders", "Невротические, связанные со стрессом и соматоформные расстройства", "Nevrotik, stresslə bağlı və somatoform pozğunluqlar"],
  ["F50-F59", "Behavioural syndromes associated with physiological disturbances and physical factors", "Поведенческие синдромы, связанные с физиологическими нарушениями и физическими факторами", "Fizioloji pozğunluqlar və fiziki amillərlə bağlı davranış sindromları"],
  ["F60-F69", "Disorders of adult personality and behaviour", "Расстройства личности и поведения в зрелом возрасте", "Yetkin şəxsiyyət və davranış pozğunluqları"],
  ["F70-F79", "Mental retardation", "Умственная отсталость", "Əqli gerilik"],
  ["F80-F89", "Disorders of psychological development", "Расстройства психологического развития", "Psixoloji inkişaf pozğunluqları"],
  ["F90-F98", "Behavioural and emotional disorders with onset usually occurring in childhood and adolescence", "Эмоциональные расстройства и расстройства поведения, начинающиеся обычно в детском и подростковом возрасте", "Adətən uşaqlıq və yeniyetməlikdə başlayan emosional və davranış pozğunluqları"],
  ["F99-F99", "Unspecified mental disorder", "Психическое расстройство без уточнения", "Dəqiqləşdirilməmiş psixi pozğunluq"],
  ["G00-G09", "Inflammatory diseases of the central nervous system", "Воспалительные болезни центральной нервной системы", "Mərkəzi sinir sisteminin iltihabi xəstəlikləri"],
  ["G10-G13", "Systemic atrophies primarily affecting the central nervous system", "Системные атрофии, преимущественно поражающие ЦНС", "Əsasən MSS-ni zədələyən sistem atrofiyaları"],
  ["G20-G26", "Extrapyramidal and movement disorders", "Экстрапирамидные и другие двигательные нарушения", "Ekstrapiramidal və hərəkət pozğunluqları"],
  ["G30-G32", "Other degenerative diseases of the nervous system", "Другие дегенеративные болезни нервной системы", "Sinir sisteminin digər degenerativ xəstəlikləri"],
  ["G35-G37", "Demyelinating diseases of the central nervous system", "Демиелинизирующие болезни центральной нервной системы", "Mərkəzi sinir sisteminin demiyelinləşdirici xəstəlikləri"],
  ["G40-G47", "Episodic and paroxysmal disorders", "Эпизодические и пароксизмальные расстройства", "Epizodik və paroksizmal pozğunluqlar"],
  ["G50-G59", "Nerve, nerve root and plexus disorders", "Поражения отдельных нервов, нервных корешков и сплетений", "Sinir, sinir kökü və pleksus pozğunluqları"],
  ["G60-G64", "Polyneuropathies and other disorders of the peripheral nervous system", "Полиневропатии и другие поражения периферической нервной системы", "Polinevropatiyalar və periferik sinir sisteminin digər pozğunluqları"],
  ["G70-G73", "Diseases of myoneural junction and muscle", "Болезни нервно-мышечного синапса и мышц", "Mionevral birləşmə və əzələ xəstəlikləri"],
  ["G80-G83", "Cerebral palsy and other paralytic syndromes", "Детский церебральный паралич и другие паралитические синдромы", "Uşaq serebral iflici və digər iflic sindromları"],
  ["G90-G99", "Other disorders of the nervous system", "Другие нарушения нервной системы", "Sinir sisteminin digər pozğunluqları"],
  ["H00-H06", "Disorders of eyelid, lacrimal system and orbit", "Болезни века, слезного аппарата и глазницы", "Göz qapağı, göz yaş aparatı və göz yuvası xəstəlikləri"],
  ["H10-H13", "Disorders of conjunctiva", "Болезни конъюнктивы", "Konyunktiva xəstəlikləri"],
  ["H15-H22", "Disorders of sclera, cornea, iris and ciliary body", "Болезни склеры, роговицы, радужной оболочки и цилиарного тела", "Sklera, buynuz qişa, iris və siliar cisim xəstəlikləri"],
  ["H25-H28", "Disorders of lens", "Болезни хрусталика", "Linza xəstəlikləri"],
  ["H30-H36", "Disorders of choroid and retina", "Болезни сосудистой оболочки и сетчатки", "Xoroid və retina xəstəlikləri"],
  ["H40-H42", "Glaucoma", "Глаукома", "Qlaukoma"],
  ["H43-H45", "Disorders of vitreous body and globe", "Болезни стекловидного тела и глазного яблока", "Şüşəvari cisim və göz almağı xəstəlikləri"],
  ["H46-H48", "Disorders of optic nerve and visual pathways", "Болезни зрительного нерва и зрительных путей", "Görmə siniri və görmə yolları xəstəlikləri"],
  ["H49-H52", "Disorders of ocular muscles, binocular movement, accommodation and refraction", "Болезни глазодвигательных мышц, содружественного движения глаз, аккомодации и рефракции", "Göz əzələləri, binokulyar hərəkət, akomodasiya və refraksiya pozğunluqları"],
  ["H53-H54", "Visual disturbances and blindness", "Зрительные расстройства и слепота", "Görmə pozğunluqları və korluq"],
  ["H55-H59", "Other disorders of eye and adnexa", "Другие болезни глаза и его придаточного аппарата", "Göz və əlavə aparatının digər xəstəlikləri"],
  ["H60-H62", "Diseases of external ear", "Болезни наружного уха", "Xarici qulaq xəstəlikləri"],
  ["H65-H75", "Diseases of middle ear and mastoid", "Болезни среднего уха и сосцевидного отростка", "Orta qulaq və məməyəbənzər çıxıntı xəstəlikləri"],
  ["H80-H83", "Diseases of inner ear", "Болезни внутреннего уха", "Daxili qulaq xəstəlikləri"],
  ["H90-H95", "Other disorders of ear", "Другие болезни уха", "Qulağın digər pozğunluqları"],
  ["I00-I02", "Acute rheumatic fever", "Острая ревматическая лихорадка", "Kəskin revmatik qızdırma"],
  ["I05-I09", "Chronic rheumatic heart diseases", "Хронические ревматические болезни сердца", "Xroniki revmatik ürək xəstəlikləri"],
  ["I10-I15", "Hypertensive diseases", "Болезни, характеризующиеся повышенным кровяным давлением", "Hipertonik xəstəliklər"],
  ["I20-I25", "Ischaemic heart diseases", "Ишемическая болезнь сердца", "İşemik ürək xəstəlikləri"],
  ["I26-I28", "Pulmonary heart disease and diseases of pulmonary circulation", "Легочное сердце и нарушения легочного кровообращения", "Ağciyər ürəyi və ağciyər qan dövranı xəstəlikləri"],
  ["I30-I52", "Other forms of heart disease", "Другие формы болезней сердца", "Ürək xəstəliklərinin digər formaları"],
  ["I60-I69", "Cerebrovascular diseases", "Цереброваскулярные болезни", "Serebrovaskulyar xəstəliklər"],
  ["I70-I79", "Diseases of arteries, arterioles and capillaries", "Болезни артерий, артериол и капилляров", "Arteriya, arteriol və kapillyar xəstəlikləri"],
  ["I80-I89", "Diseases of veins, lymphatic vessels and lymph nodes, not elsewhere classified", "Болезни вен, лимфатических сосудов и лимфатических узлов, не классифицированные в других рубриках", "Digər rubrikalarda təsnif edilməyən vena, limfa damarları və limfa düyünləri xəstəlikləri"],
  ["I95-I99", "Other and unspecified disorders of the circulatory system", "Другие и неуточненные болезни системы кровообращения", "Qan dövranı sisteminin digər və dəqiqləşdirilməmiş pozğunluqları"],
  ["J00-J06", "Acute upper respiratory infections", "Острые респираторные инфекции верхних дыхательных путей", "Yuxarı tənəffüs yollarının kəskin infeksiyaları"],
  ["J09-J18", "Influenza and pneumonia", "Грипп и пневмония", "Qrip və pnevmoniya"],
  ["J20-J22", "Other acute lower respiratory infections", "Другие острые респираторные инфекции нижних дыхательных путей", "Aşağı tənəffüs yollarının digər kəskin infeksiyaları"],
  ["J30-J39", "Other diseases of upper respiratory tract", "Другие болезни верхних дыхательных путей", "Yuxarı tənəffüs yollarının digər xəstəlikləri"],
  ["J40-J47", "Chronic lower respiratory diseases", "Хронические болезни нижних дыхательных путей", "Aşağı tənəffüs yollarının xroniki xəstəlikləri"],
  ["J60-J70", "Lung diseases due to external agents", "Болезни легкого, вызванные внешними агентами", "Xarici agentlərlə bağlı ağciyər xəstəlikləri"],
  ["J80-J84", "Other respiratory diseases principally affecting the interstitium", "Другие респираторные болезни, поражающие главным образом интерстициальную ткань", "Əsasən interstisial toxumanı zədələyən digər tənəffüs xəstəlikləri"],
  ["J85-J86", "Suppurative and necrotic conditions of lower respiratory tract", "Гнойные и некротические состояния нижних дыхательных путей", "Aşağı tənəffüs yollarının irinli və nekrotik vəziyyətləri"],
  ["J90-J94", "Other diseases of pleura", "Другие болезни плевры", "Plevranın digər xəstəlikləri"],
  ["J95-J99", "Other diseases of the respiratory system", "Другие болезни органов дыхания", "Tənəffüs orqanlarının digər xəstəlikləri"],
  ["K00-K14", "Diseases of oral cavity, salivary glands and jaws", "Болезни полости рта, слюнных желез и челюстей", "Ağız boşluğu, tüpürcək vəziləri və çənə xəstəlikləri"],
  ["K20-K31", "Diseases of oesophagus, stomach and duodenum", "Болезни пищевода, желудка и двенадцатиперстной кишки", "Qida borusu, mədə və onikibarmaq bağırsaq xəstəlikləri"],
  ["K35-K38", "Diseases of appendix", "Болезни аппендикса [червеобразного отростка]", "Appendiks xəstəlikləri"],
  ["K40-K46", "Hernia", "Грыжи", "Yırtıqlar"],
  ["K50-K52", "Noninfective enteritis and colitis", "Неинфекционный энтерит и колит", "Qeyri-infeksion enterit və kolit"],
  ["K55-K64", "Other diseases of intestines", "Другие болезни кишечника", "Bağırsağın digər xəstəlikləri"],
  ["K65-K67", "Diseases of peritoneum", "Болезни брюшины", "Periton xəstəlikləri"],
  ["K70-K77", "Diseases of liver", "Болезни печени", "Qaraciyər xəstəlikləri"],
  ["K80-K87", "Disorders of gallbladder, biliary tract and pancreas", "Болезни желчного пузыря, желчевыводящих путей и поджелудочной железы", "Öd kisəsi, öd yolları və mədəaltı vəzi xəstəlikləri"],
  ["K90-K93", "Other diseases of the digestive system", "Другие болезни органов пищеварения", "Həzm orqanlarının digər xəstəlikləri"],
  ["L00-L08", "Infections of the skin and subcutaneous tissue", "Инфекции кожи и подкожной клетчатки", "Dəri və dərialtı toxuma infeksiyaları"],
  ["L10-L14", "Bullous disorders", "Буллезные нарушения", "Bullöz pozğunluqlar"],
  ["L20-L30", "Dermatitis and eczema", "Дерматит и экзема", "Dermatit və ekzema"],
  ["L40-L45", "Papulosquamous disorders", "Папулосквамозные нарушения", "Papuloskvamoz pozğunluqlar"],
  ["L50-L54", "Urticaria and erythema", "Крапивница и эритема", "Ürtiker və eritema"],
  ["L55-L59", "Radiation-related disorders of the skin and subcutaneous tissue", "Болезни кожи и подкожной клетчатки, связанные с излучением", "Şüalanma ilə bağlı dəri və dərialtı toxuma pozğunluqları"],
  ["L60-L75", "Disorders of skin appendages", "Болезни придатков кожи", "Dəri əlavələrinin pozğunluqları"],
  ["L80-L99", "Other disorders of the skin and subcutaneous tissue", "Другие болезни кожи и подкожной клетчатки", "Dəri və dərialtı toxumanın digər pozğunluqları"],
  ["M00-M03", "Infectious arthropathies", "Инфекционные артропатии", "İnfeksion artropatiyalar"],
  ["M05-M14", "Inflammatory polyarthropathies", "Воспалительные полиартропатии", "İltihabi poliartropatiyalar"],
  ["M15-M19", "Arthrosis", "Артрозы", "Artrozlar"],
  ["M20-M25", "Other joint disorders", "Другие поражения суставов", "Oynaqların digər pozğunluqları"],
  ["M30-M36", "Systemic connective tissue disorders", "Системные поражения соединительной ткани", "Sistem birləşdirici toxuma pozğunluqları"],
  ["M40-M43", "Deforming dorsopathies", "Деформирующие дорсопатии", "Deformasiyaedici dorsopatiyalar"],
  ["M45-M49", "Spondylopathies", "Спондилопатии", "Spondilopatiyalar"],
  ["M50-M54", "Other dorsopathies", "Другие дорсопатии", "Digər dorsopatiyalar"],
  ["M60-M63", "Disorders of muscles", "Болезни мышц", "Əzələ pozğunluqları"],
  ["M65-M68", "Disorders of synovium and tendon", "Поражения синовиальных оболочек и сухожилий", "Sinovial qişa və vətər pozğunluqları"],
  ["M70-M79", "Other soft tissue disorders", "Другие болезни мягких тканей", "Yumşaq toxumaların digər pozğunluqları"],
  ["M80-M85", "Disorders of bone density and structure", "Нарушения плотности и структуры кости", "Sümük sıxlığı və strukturu pozğunluqları"],
  ["M86-M90", "Other osteopathies", "Другие остеопатии", "Digər osteopatiyalar"],
  ["M91-M94", "Chondropathies", "Хондропатии", "Xondropatiyalar"],
  ["M95-M99", "Other disorders of the musculoskeletal system and connective tissue", "Другие нарушения костно-мышечной системы и соединительной ткани", "Sümük-əzələ sistemi və birləşdirici toxumanın digər pozğunluqları"],
  ["N00-N08", "Glomerular diseases", "Гломерулярные болезни", "Qlomerulyar xəstəliklər"],
  ["N10-N16", "Renal tubulo-interstitial diseases", "Тубулоинтерстициальные болезни почек", "Böyrəyin tubulo-interstisial xəstəlikləri"],
  ["N17-N19", "Renal failure", "Почечная недостаточность", "Böyrək çatışmazlığı"],
  ["N20-N23", "Urolithiasis", "Мочекаменная болезнь", "Urolitiaz"],
  ["N25-N29", "Other disorders of kidney and ureter", "Другие болезни почки и мочеточника", "Böyrək və sidik axarının digər pozğunluqları"],
  ["N30-N39", "Other diseases of urinary system", "Другие болезни мочевой системы", "Sidik sisteminin digər xəstəlikləri"],
  ["N40-N51", "Diseases of male genital organs", "Болезни мужских половых органов", "Kişi cinsiyyət orqanlarının xəstəlikləri"],
  ["N60-N64", "Disorders of breast", "Болезни молочной железы", "Süd vəzisi pozğunluqları"],
  ["N70-N77", "Inflammatory diseases of female pelvic organs", "Воспалительные болезни женских тазовых органов", "Qadın çanaq orqanlarının iltihabi xəstəlikləri"],
  ["N80-N98", "Noninflammatory disorders of female genital tract", "Невоспалительные болезни женских половых органов", "Qadın cinsiyyət yollarının qeyri-iltihabi pozğunluqları"],
  ["N99-N99", "Other disorders of genitourinary tract", "Другие нарушения мочеполовой системы", "Sidik-cinsiyyət sisteminin digər pozğunluqları"],
  ["O00-O08", "Pregnancy with abortive outcome", "Беременность с абортивным исходом", "Abortiv nəticəli hamiləlik"],
  ["O10-O16", "Oedema, proteinuria and hypertensive disorders in pregnancy, childbirth and the puerperium", "Отеки, протеинурия и гипертензивные расстройства во время беременности, родов и в послеродовом периоде", "Hamiləlik, doğuş və doğuşdan sonrakı dövrdə ödem, proteinuriya və hipertonik pozğunluqlar"],
  ["O20-O29", "Other maternal disorders predominantly related to pregnancy", "Другие болезни матери, связанные преимущественно с беременностью", "Əsasən hamiləliklə bağlı digər ana pozğunluqları"],
  ["O30-O48", "Maternal care related to the fetus and amniotic cavity and possible delivery problems", "Медицинская помощь матери в связи с состоянием плода, амниотической полости и возможными трудностями родоразрешения", "Döl, amniotik boşluq və mümkün doğuş problemləri ilə bağlı ana qayğısı"],
  ["O60-O75", "Complications of labour and delivery", "Осложнения родов и родоразрешения", "Doğuş və doğuşun ağırlaşmaları"],
  ["O80-O84", "Delivery", "Роды", "Doğuş"],
  ["O85-O92", "Complications predominantly related to the puerperium", "Осложнения, связанные преимущественно с послеродовым периодом", "Əsasən doğuşdan sonrakı dövrə aid ağırlaşmalar"],
  ["O94-O99", "Other obstetric conditions, not elsewhere classified", "Другие акушерские состояния, не классифицированные в других рубриках", "Digər rubrikalarda təsnif edilməyən digər mama vəziyyətləri"],
  ["P00-P04", "Fetus and newborn affected by maternal factors and by complications of pregnancy, labour and delivery", "Поражения плода и новорожденного, обусловленные состояниями матери, осложнениями беременности, родов и родоразрешения", "Ana amilləri və hamiləlik/doğuş ağırlaşmaları ilə bağlı döl və yenidoğulmuş zədələnmələri"],
  ["P05-P08", "Disorders related to length of gestation and fetal growth", "Расстройства, связанные с продолжительностью беременности и ростом плода", "Hamiləlik müddəti və döl böyüməsi ilə bağlı pozğunluqlar"],
  ["P10-P15", "Birth trauma", "Родовая травма", "Doğuş travması"],
  ["P20-P29", "Respiratory and cardiovascular disorders specific to the perinatal period", "Дыхательные и сердечно-сосудистые нарушения, характерные для перинатального периода", "Perinatal dövrə xas tənəffüs və ürək-damar pozğunluqları"],
  ["P35-P39", "Infections specific to the perinatal period", "Инфекционные болезни, специфичные для перинатального периода", "Perinatal dövrə xas infeksiyalar"],
  ["P50-P61", "Haemorrhagic and haematological disorders of fetus and newborn", "Геморрагические и гематологические нарушения у плода и новорожденного", "Döl və yenidoğulmuşda hemorragik və hematoloji pozğunluqlar"],
  ["P70-P74", "Transitory endocrine and metabolic disorders specific to fetus and newborn", "Преходящие эндокринные нарушения и нарушения обмена веществ, специфичные для плода и новорожденного", "Döl və yenidoğulmuşa xas keçici endokrin və metabolik pozğunluqlar"],
  ["P75-P78", "Digestive system disorders of fetus and newborn", "Расстройства системы пищеварения у плода и новорожденного", "Döl və yenidoğulmuşda həzm sistemi pozğunluqları"],
  ["P80-P83", "Conditions involving the integument and temperature regulation of fetus and newborn", "Состояния, затрагивающие кожные покровы и терморегуляцию у плода и новорожденного", "Döl və yenidoğulmuşda dəri örtüyü və temperatur tənzimlənməsi vəziyyətləri"],
  ["P90-P96", "Other disorders originating in the perinatal period", "Другие нарушения, возникающие в перинатальном периоде", "Perinatal dövrdə yaranan digər pozğunluqlar"],
  ["Q00-Q07", "Congenital malformations of the nervous system", "Врожденные аномалии [пороки развития] нервной системы", "Sinir sisteminin anadangəlmə anomaliyaları"],
  ["Q10-Q18", "Congenital malformations of eye, ear, face and neck", "Врожденные аномалии глаза, уха, лица и шеи", "Göz, qulaq, üz və boyunun anadangəlmə anomaliyaları"],
  ["Q20-Q28", "Congenital malformations of the circulatory system", "Врожденные аномалии системы кровообращения", "Qan dövranı sisteminin anadangəlmə anomaliyaları"],
  ["Q30-Q34", "Congenital malformations of the respiratory system", "Врожденные аномалии органов дыхания", "Tənəffüs sisteminin anadangəlmə anomaliyaları"],
  ["Q35-Q37", "Cleft lip and cleft palate", "Расщелина губы и неба", "Dodaq və damaq yarığı"],
  ["Q38-Q45", "Other congenital malformations of the digestive system", "Другие врожденные аномалии органов пищеварения", "Həzm sisteminin digər anadangəlmə anomaliyaları"],
  ["Q50-Q56", "Congenital malformations of genital organs", "Врожденные аномалии половых органов", "Cinsiyyət orqanlarının anadangəlmə anomaliyaları"],
  ["Q60-Q64", "Congenital malformations of the urinary system", "Врожденные аномалии мочевой системы", "Sidik sisteminin anadangəlmə anomaliyaları"],
  ["Q65-Q79", "Congenital malformations and deformations of the musculoskeletal system", "Врожденные аномалии и деформации костно-мышечной системы", "Sümük-əzələ sisteminin anadangəlmə anomaliya və deformasiyaları"],
  ["Q80-Q89", "Other congenital malformations", "Другие врожденные аномалии", "Digər anadangəlmə anomaliyalar"],
  ["Q90-Q99", "Chromosomal abnormalities, not elsewhere classified", "Хромосомные аномалии, не классифицированные в других рубриках", "Digər rubrikalarda təsnif edilməyən xromosom anomaliyaları"],
  ["R00-R09", "Symptoms and signs involving the circulatory and respiratory systems", "Симптомы и признаки, относящиеся к системам кровообращения и дыхания", "Qan dövranı və tənəffüs sistemlərinə aid simptom və əlamətlər"],
  ["R10-R19", "Symptoms and signs involving the digestive system and abdomen", "Симптомы и признаки, относящиеся к системе пищеварения и брюшной полости", "Həzm sistemi və qarına aid simptom və əlamətlər"],
  ["R20-R23", "Symptoms and signs involving the skin and subcutaneous tissue", "Симптомы и признаки, относящиеся к коже и подкожной клетчатке", "Dəri və dərialtı toxumaya aid simptom və əlamətlər"],
  ["R25-R29", "Symptoms and signs involving the nervous and musculoskeletal systems", "Симптомы и признаки, относящиеся к нервной и костно-мышечной системам", "Sinir və sümük-əzələ sistemlərinə aid simptom və əlamətlər"],
  ["R30-R39", "Symptoms and signs involving the urinary system", "Симптомы и признаки, относящиеся к мочевой системе", "Sidik sisteminə aid simptom və əlamətlər"],
  ["R40-R46", "Symptoms and signs involving cognition, perception, emotional state and behaviour", "Симптомы и признаки, относящиеся к познавательной способности, восприятию, эмоциональному состоянию и поведению", "İdrak, qavrayış, emosional vəziyyət və davranışa aid simptom və əlamətlər"],
  ["R47-R49", "Symptoms and signs involving speech and voice", "Симптомы и признаки, относящиеся к речи и голосу", "Nitq və səsə aid simptom və əlamətlər"],
  ["R50-R69", "General symptoms and signs", "Общие симптомы и признаки", "Ümumi simptom və əlamətlər"],
  ["R70-R79", "Abnormal findings on examination of blood, without diagnosis", "Отклонения от нормы, выявленные при исследовании крови, при отсутствии диагноза", "Diaqnoz olmadan qan müayinəsində anormal tapıntılar"],
  ["R80-R82", "Abnormal findings on examination of urine, without diagnosis", "Отклонения от нормы, выявленные при исследовании мочи, при отсутствии диагноза", "Diaqnoz olmadan sidik müayinəsində anormal tapıntılar"],
  ["R83-R89", "Abnormal findings on examination of other body fluids, substances and tissues, without diagnosis", "Отклонения от нормы, выявленные при исследовании других жидкостей, веществ и тканей организма, при отсутствии диагноза", "Diaqnoz olmadan digər bədən mayeləri, maddələr və toxumaların müayinəsində anormal tapıntılar"],
  ["R90-R94", "Abnormal findings on diagnostic imaging and in function studies, without diagnosis", "Отклонения от нормы, выявленные при получении диагностических изображений и проведении исследований функций, при отсутствии диагноза", "Diaqnoz olmadan diaqnostik görüntüləmə və funksional müayinələrdə anormal tapıntılar"],
  ["R95-R99", "Ill-defined and unknown causes of mortality", "Плохо определенные и неизвестные причины смерти", "Qeyri-dəqiq və naməlum ölüm səbəbləri"],
  ["S00-S09", "Injuries to the head", "Травмы головы", "Baş travmaları"],
  ["S10-S19", "Injuries to the neck", "Травмы шеи", "Boyun travmaları"],
  ["S20-S29", "Injuries to the thorax", "Травмы грудной клетки", "Döş qəfəsi travmaları"],
  ["S30-S39", "Injuries to the abdomen, lower back, lumbar spine and pelvis", "Травмы живота, нижней части спины, поясничного отдела позвоночника и таза", "Qarın, bel, bel fəqərələri və çanaq travmaları"],
  ["S40-S49", "Injuries to the shoulder and upper arm", "Травмы плеча и верхней части руки", "Çiyin və yuxarı qol travmaları"],
  ["S50-S59", "Injuries to the elbow and forearm", "Травмы локтя и предплечья", "Dirsək və önqol travmaları"],
  ["S60-S69", "Injuries to the wrist and hand", "Травмы запястья и кисти", "Bilək və əl travmaları"],
  ["S70-S79", "Injuries to the hip and thigh", "Травмы области тазобедренного сустава и бедра", "Bud-çanaq və bud travmaları"],
  ["S80-S89", "Injuries to the knee and lower leg", "Травмы колена и голени", "Diz və baldır travmaları"],
  ["S90-S99", "Injuries to the ankle and foot", "Травмы области голеностопного сустава и стопы", "Ayaq biləyi və ayaq travmaları"],
  ["T00-T07", "Injuries involving multiple body regions", "Травмы, захватывающие несколько областей тела", "Bir neçə bədən nahiyəsini əhatə edən travmalar"],
  ["T08-T14", "Injuries to unspecified part of trunk, limb or body region", "Травмы неуточненной части туловища, конечности или области тела", "Gövdə, ətraf və ya bədən nahiyəsinin dəqiqləşdirilməmiş hissəsinin travmaları"],
  ["T15-T19", "Effects of foreign body entering through natural orifice", "Последствия проникновения инородного тела через естественные отверстия", "Xarici cismin təbii dəliklərdən daxil olmasının nəticələri"],
  ["T20-T25", "Burns and corrosions of external body surface, specified by site", "Термические и химические ожоги наружных поверхностей тела, уточненные по их локализации", "Lokalizasiyaya görə dəqiqləşdirilmiş xarici bədən səthinin yanıq və korroziyaları"],
  ["T26-T28", "Burns and corrosions confined to eye and internal organs", "Термические и химические ожоги, ограниченные областью глаза и внутренними органами", "Göz və daxili orqanlarla məhdud yanıq və korroziyalar"],
  ["T29-T32", "Burns and corrosions of multiple and unspecified body regions", "Термические и химические ожоги множественной и неуточненной локализации", "Çoxsaylı və dəqiqləşdirilməmiş nahiyələrin yanıq və korroziyaları"],
  ["T33-T35", "Frostbite", "Отморожение", "Donvurma"],
  ["T36-T50", "Poisoning by drugs, medicaments and biological substances", "Отравление лекарственными средствами, медикаментами и биологическими веществами", "Dərman, medikament və bioloji maddələrlə zəhərlənmə"],
  ["T51-T65", "Toxic effects of substances chiefly nonmedicinal as to source", "Токсическое действие веществ, преимущественно немедицинского назначения", "Əsasən qeyri-dərman mənşəli maddələrin toksik təsiri"],
  ["T66-T78", "Other and unspecified effects of external causes", "Другие и неуточненные эффекты воздействия внешних причин", "Xarici səbəblərin digər və dəqiqləşdirilməmiş təsirləri"],
  ["T79-T79", "Certain early complications of trauma", "Некоторые ранние осложнения травм", "Travmanın bəzi erkən ağırlaşmaları"],
  ["T80-T88", "Complications of surgical and medical care, not elsewhere classified", "Осложнения хирургических и терапевтических вмешательств, не классифицированные в других рубриках", "Digər rubrikalarda təsnif edilməyən cərrahi və tibbi qayğı ağırlaşmaları"],
  ["T90-T98", "Sequelae of injuries, of poisoning and of other consequences of external causes", "Последствия травм, отравлений и других воздействий внешних причин", "Travma, zəhərlənmə və xarici səbəblərin digər nəticələrinin qalıqları"],
  ["V01-V09", "Pedestrian injured in transport accident", "Пешеход, пострадавший в результате транспортного несчастного случая", "Nəqliyyat qəzasında zədələnmiş piyada"],
  ["V10-V19", "Pedal cyclist injured in transport accident", "Велосипедист, пострадавший в результате транспортного несчастного случая", "Nəqliyyat qəzasında zədələnmiş velosipedçi"],
  ["V20-V29", "Motorcycle rider injured in transport accident", "Мотоциклист, пострадавший в результате транспортного несчастного случая", "Nəqliyyat qəzasında zədələnmiş motosikletçi"],
  ["V30-V39", "Occupant of three-wheeled motor vehicle injured in transport accident", "Лицо, находившееся в трехколесном моторном транспортном средстве, пострадавшее при транспортном несчастном случае", "Nəqliyyat qəzasında zədələnmiş üçtəkərli motor nəqliyyatı sərnişini"],
  ["V40-V49", "Car occupant injured in transport accident", "Лицо, находившееся в легковом автомобиле, пострадавшее при транспортном несчастном случае", "Nəqliyyat qəzasında zədələnmiş avtomobil sərnişini"],
  ["V50-V59", "Occupant of pick-up truck or van injured in transport accident", "Лицо, находившееся в пикапе или фургоне, пострадавшее при транспортном несчастном случае", "Nəqliyyat qəzasında zədələnmiş pikap və ya furqon sərnişini"],
  ["V60-V69", "Occupant of heavy transport vehicle injured in transport accident", "Лицо, находившееся в большегрузном автомобиле, пострадавшее при транспортном несчастном случае", "Nəqliyyat qəzasında zədələnmiş ağır nəqliyyat sərnişini"],
  ["V70-V79", "Bus occupant injured in transport accident", "Лицо, находившееся в автобусе, пострадавшее при транспортном несчастном случае", "Nəqliyyat qəzasında zədələnmiş avtobus sərnişini"],
  ["V80-V89", "Other land transport accidents", "Другие наземные транспортные несчастные случаи", "Digər quru nəqliyyat qəzaları"],
  ["V90-V94", "Water transport accidents", "Несчастные случаи на водном транспорте", "Su nəqliyyatı qəzaları"],
  ["V95-V97", "Air and space transport accidents", "Несчастные случаи на воздушном транспорте и космических летательных аппаратах", "Hava və kosmik nəqliyyat qəzaları"],
  ["V98-V99", "Other and unspecified transport accidents", "Другие и неуточненные транспортные несчастные случаи", "Digər və dəqiqləşdirilməmiş nəqliyyat qəzaları"],
  ["W00-W19", "Falls", "Падения", "Yıxılmalar"],
  ["W20-W49", "Exposure to inanimate mechanical forces", "Воздействие неживых механических сил", "Cansız mexaniki qüvvələrə məruzqalma"],
  ["W50-W64", "Exposure to animate mechanical forces", "Воздействие живых механических сил", "Canlı mexaniki qüvvələrə məruzqalma"],
  ["W65-W74", "Accidental drowning and submersion", "Случайное утопление и погружение в воду", "Təsadüfi boğulma və suya batma"],
  ["W75-W84", "Other accidental threats to breathing", "Другие случайные угрозы дыханию", "Tənəffüsə digər təsadüfi təhdidlər"],
  ["W85-W99", "Exposure to electric current, radiation and extreme ambient air temperature and pressure", "Воздействие электрического тока, излучения и крайних значений температуры воздуха и давления", "Elektrik cərəyanı, radiasiya və ekstremal temperatur/təzyiqə məruzqalma"],
  ["X00-X09", "Exposure to smoke, fire and flames", "Воздействие дыма, огня и пламени", "Tüstü, yanğın və alova məruzqalma"],
  ["X10-X19", "Contact with heat and hot substances", "Контакт с горячими и раскаленными веществами", "İstilik və isti maddələrlə təmas"],
  ["X20-X29", "Contact with venomous animals and plants", "Контакт с ядовитыми животными и растениями", "Zəhərli heyvan və bitkilərlə təmas"],
  ["X30-X39", "Exposure to forces of nature", "Воздействие сил природы", "Təbiət qüvvələrinə məruzqalma"],
  ["X40-X49", "Accidental poisoning by and exposure to noxious substances", "Случайное отравление и воздействие ядовитыми веществами", "Zərərli maddələrlə təsadüfi zəhərlənmə və məruzqalma"],
  ["X50-X57", "Overexertion, travel and privation", "Перенапряжение, путешествия и лишения", "Həddindən artıq gərginlik, səyahət və məhrumiyyət"],
  ["X58-X59", "Accidental exposure to other and unspecified factors", "Случайное воздействие других и неуточненных факторов", "Digər və dəqiqləşdirilməmiş amillərə təsadüfi məruzqalma"],
  ["X60-X84", "Intentional self-harm", "Преднамеренное самоповреждение", "Qəsdən özünə zərər yetirmə"],
  ["X85-Y09", "Assault", "Нападение", "Hücum"],
  ["Y10-Y34", "Event of undetermined intent", "Повреждение с неопределенными намерениями", "Qeyri-müəyyən niyyətli hadisə"],
  ["Y35-Y36", "Legal intervention and operations of war", "Действия, предусмотренные законом, и военные операции", "Qanuni müdaxilə və hərbi əməliyyatlar"],
  ["Y40-Y59", "Drugs, medicaments and biological substances causing adverse effects in therapeutic use", "Лекарственные средства, медикаменты и биологические вещества, вызывающие неблагоприятные реакции при терапевтическом применении", "Terapevtik istifadədə arzuolunmaz təsirə səbəb olan dərman və bioloji maddələr"],
  ["Y60-Y69", "Misadventures to patients during surgical and medical care", "Случайное нанесение вреда больному при выполнении терапевтических и хирургических вмешательств", "Cərrahi və tibbi qayğı zamanı xəstəyə təsadüfi zərər"],
  ["Y70-Y82", "Medical devices associated with adverse incidents in diagnostic and therapeutic use", "Медицинские приборы и устройства, связанные с неблагоприятными инцидентами при диагностическом и терапевтическом вмешательстве", "Diaqnostik və terapevtik istifadədə arzuolunmaz hadisələrlə bağlı tibbi cihazlar"],
  ["Y83-Y84", "Surgical and other medical procedures as the cause of abnormal reaction of the patient, or of later complication, without mention of misadventure at the time of the procedure", "Хирургические и другие медицинские процедуры как причина аномальной реакции или позднего осложнения без упоминания о случайном вреде во время процедуры", "Prosedur zamanı təsadüfi zərər qeyd olunmadan anormal reaksiya və ya gecikmiş ağırlaşma səbəbi kimi cərrahi və digər tibbi prosedurlar"],
  ["Y85-Y89", "Sequelae of external causes of morbidity and mortality", "Последствия внешних причин заболеваемости и смертности", "Xəstələnmə və ölümün xarici səbəblərinin qalıqları"],
  ["Y90-Y98", "Supplementary factors related to causes of morbidity and mortality classified elsewhere", "Дополнительные факторы, имеющие отношение к причинам заболеваемости и смертности, классифицированным в других рубриках", "Digər rubrikalarda təsnif edilən xəstələnmə və ölüm səbəblərinə aid əlavə amillər"],
  ["Z00-Z13", "Persons encountering health services for examination and investigation", "Обращения в учреждения здравоохранения для медицинского осмотра и обследования", "Müayinə və yoxlama üçün səhiyyə xidmətlərinə müraciət edən şəxslər"],
  ["Z20-Z29", "Persons with potential health hazards related to communicable diseases", "Потенциальная опасность для здоровья, связанная с инфекционными болезнями", "Yoluxucu xəstəliklərlə bağlı potensial sağlamlıq təhlükəsi olan şəxslər"],
  ["Z30-Z39", "Persons encountering health services in circumstances related to reproduction", "Обращения в учреждения здравоохранения в связи с обстоятельствами, относящимися к репродукции", "Reproduksiya ilə bağlı hallarda səhiyyə xidmətlərinə müraciət edən şəxslər"],
  ["Z40-Z54", "Persons encountering health services for specific procedures and health care", "Обращения в учреждения здравоохранения для проведения специфических процедур и получения медицинской помощи", "Xüsusi prosedurlar və tibbi qayğı üçün səhiyyə xidmətlərinə müraciət edən şəxslər"],
  ["Z55-Z65", "Persons with potential health hazards related to socioeconomic and psychosocial circumstances", "Потенциальная опасность для здоровья, связанная с социально-экономическими и психосоциальными обстоятельствами", "Sosial-iqtisadi və psixososial hallarla bağlı potensial sağlamlıq təhlükəsi olan şəxslər"],
  ["Z70-Z76", "Persons encountering health services in other circumstances", "Обращения в учреждения здравоохранения в других обстоятельствах", "Digər hallarda səhiyyə xidmətlərinə müraciət edən şəxslər"],
  ["Z80-Z99", "Persons with potential health hazards related to family and personal history and certain conditions influencing health status", "Потенциальная опасность для здоровья, связанная с семейным и личным анамнезом и определенными состояниями, влияющими на здоровье", "Ailə və şəxsi anamnez və sağlamlığa təsir edən müəyyən vəziyyətlərlə bağlı potensial təhlükə olan şəxslər"],
  ["U00-U49", "Provisional assignment of new diseases of uncertain etiology or emergency use", "Временные коды для новых болезней неясной этиологии или экстренного использования", "Qeyri-müəyyən etiologiyalı yeni xəstəliklər və ya təcili istifadə üçün müvəqqəti kodlar"],
  ["U82-U85", "Resistance to antimicrobial and antineoplastic drugs", "Устойчивость к антимикробным и противоопухолевым препаратам", "Antimikrob və antineoplastik dərmanlara davamlılıq"],
];

/** Clinical title overrides [en, ru, az] */
const TITLE_OVERRIDES = {
  I10: ["Essential (primary) hypertension", "Эссенциальная [первичная] гипертензия", "Essensial (ilkin) hipertoniya"],
  I11: ["Hypertensive heart disease", "Гипертензивная болезнь сердца", "Hipertonik ürək xəstəliyi"],
  I20: ["Angina pectoris", "Стенокардия [грудная жаба]", "Stenokardiya"],
  I21: ["Acute myocardial infarction", "Острый инфаркт миокарда", "Kəskin miokard infarktı"],
  I25: ["Chronic ischaemic heart disease", "Хроническая ишемическая болезнь сердца", "Xroniki işemik ürək xəstəliyi"],
  I48: ["Atrial fibrillation and flutter", "Фибрилляция и трепетание предсердий", "Qulaqcıq fibrillyasiyası və çırpınması"],
  I50: ["Heart failure", "Сердечная недостаточность", "Ürək çatışmazlığı"],
  I63: ["Cerebral infarction", "Инфаркт мозга", "Beyin infarktı"],
  I64: ["Stroke, not specified as haemorrhage or infarction", "Инсульт, не уточненный как кровоизлияние или инфаркт", "İnsult, qanaxma və ya infarkt kimi dəqiqləşdirilməmiş"],
  I67: ["Other cerebrovascular diseases", "Другие цереброваскулярные болезни", "Digər serebrovaskulyar xəstəliklər"],
  I70: ["Atherosclerosis", "Атеросклероз", "Ateroskleroz"],
  I83: ["Varicose veins of lower extremities", "Варикозное расширение вен нижних конечностей", "Aşağı ətrafların varikoz damarları"],
  E11: ["Type 2 diabetes mellitus", "Инсулиннезависимый сахарный диабет", "2-ci tip şəkərli diabet"],
  E10: ["Type 1 diabetes mellitus", "Инсулинзависимый сахарный диабет", "1-ci tip şəkərli diabet"],
  E14: ["Unspecified diabetes mellitus", "Сахарный диабет неуточненный", "Dəqiqləşdirilməmiş şəkərli diabet"],
  E66: ["Obesity", "Ожирение", "Piylənmə"],
  E78: ["Disorders of lipoprotein metabolism and other lipidaemias", "Нарушения обмена липопротеидов и другие липидемии", "Lipoprotein mübadiləsi pozğunluqları və digər lipidemiyalar"],
  E04: ["Other nontoxic goitre", "Другие формы нетоксического зоба", "Digər toksik olmayan zob"],
  E05: ["Thyrotoxicosis [hyperthyroidism]", "Тиреотоксикоз [гипертиреоз]", "Tireotoksikoz [hipertireoz]"],
  E03: ["Other hypothyroidism", "Другие формы гипотиреоза", "Digər hipotiroidizm"],
  J06: ["Acute upper respiratory infections of multiple and unspecified sites", "Острые инфекции верхних дыхательных путей множественной и неуточненной локализации", "Çoxsaylı və dəqiqləşdirilməmiş lokalizasiyalı yuxarı tənəffüs yollarının kəskin infeksiyaları"],
  "J06.9": ["Acute upper respiratory infection, unspecified", "Острая инфекция верхних дыхательных путей неуточненная", "Dəqiqləşdirilməmiş kəskin yuxarı tənəffüs yolu infeksiyası"],
  J18: ["Pneumonia, organism unspecified", "Пневмония без уточнения возбудителя", "Törədicisi dəqiqləşdirilməmiş pnevmoniya"],
  J44: ["Other chronic obstructive pulmonary disease", "Другая хроническая обструктивная легочная болезнь", "Digər xroniki obstruktiv ağciyər xəstəliyi"],
  J45: ["Asthma", "Астма", "Astma"],
  "J45.9": ["Asthma, unspecified", "Астма неуточненная", "Dəqiqləşdirilməmiş astma"],
  J30: ["Vasomotor and allergic rhinitis", "Вазомоторный и аллергический ринит", "Vazomotor və allergik rinit"],
  K21: ["Gastro-oesophageal reflux disease", "Гастроэзофагеальный рефлюкс", "Qastroezofageal reflüks xəstəliyi"],
  "K21.0": ["Gastro-oesophageal reflux disease with oesophagitis", "Гастроэзофагеальный рефлюкс с эзофагитом", "Ezofagitlə qastroezofageal reflüks xəstəliyi"],
  K25: ["Gastric ulcer", "Язва желудка", "Mədə xorası"],
  K29: ["Gastritis and duodenitis", "Гастрит и дуоденит", "Qastrit və duodenit"],
  K80: ["Cholelithiasis", "Желчнокаменная болезнь", "Öd daşı xəstəliyi"],
  K76: ["Other diseases of liver", "Другие болезни печени", "Qaraciyərin digər xəstəlikləri"],
  M54: ["Dorsalgia", "Дорсалгия", "Dorsalgiya"],
  "M54.5": ["Low back pain", "Боль внизу спины", "Bel ağrısı"],
  "M54.2": ["Cervicalgia", "Цервикалгия", "Servikalgiya"],
  M51: ["Other intervertebral disc disorders", "Другие поражения межпозвоночных дисков", "Onurğaarası disklərin digər pozğunluqları"],
  M17: ["Gonarthrosis [arthrosis of knee]", "Гонартроз [артроз коленного сустава]", "Qonartroz [diz artrozu]"],
  M16: ["Coxarthrosis [arthrosis of hip]", "Коксартроз [артроз тазобедренного сустава]", "Koksartroz [bud-çanaq artrozu]"],
  M47: ["Spondylosis", "Спондилез", "Spondiloz"],
  M79: ["Other soft tissue disorders, not elsewhere classified", "Другие болезни мягких тканей, не классифицированные в других рубриках", "Digər rubrikalarda təsnif edilməyən digər yumşaq toxuma pozğunluqları"],
  M25: ["Other joint disorders, not elsewhere classified", "Другие поражения суставов, не классифицированные в других рубриках", "Digər rubrikalarda təsnif edilməyən digər oynaq pozğunluqları"],
  N18: ["Chronic kidney disease", "Хроническая болезнь почек", "Xroniki böyrək xəstəliyi"],
  N20: ["Calculus of kidney and ureter", "Камни почки и мочеточника", "Böyrək və sidik axarı daşları"],
  N40: ["Hyperplasia of prostate", "Гиперплазия предстательной железы", "Prostata hiperplaziyası"],
  N30: ["Cystitis", "Цистит", "Sistit"],
  F32: ["Depressive episode", "Депрессивный эпизод", "Depressiv epizod"],
  F41: ["Other anxiety disorders", "Другие тревожные расстройства", "Digər narahatlıq pozğunluqları"],
  "F41.1": ["Generalized anxiety disorder", "Генерализованное тревожное расстройство", "Generalizə olunmuş narahatlıq pozğunluğu"],
  F43: ["Reaction to severe stress, and adjustment disorders", "Реакция на тяжелый стресс и нарушения адаптации", "Ağır stressə reaksiya və adaptasiya pozğunluqları"],
  G40: ["Epilepsy", "Эпилепсия", "Epilepsiya"],
  G43: ["Migraine", "Мигрень", "Miqren"],
  G47: ["Sleep disorders", "Расстройства сна", "Yuxu pozğunluqları"],
  G35: ["Multiple sclerosis", "Рассеянный склероз", "Səpələnmiş skleroz"],
  H52: ["Disorders of refraction and accommodation", "Нарушения рефракции и аккомодации", "Refraksiya və akomodasiya pozğunluqları"],
  H40: ["Glaucoma", "Глаукома", "Qlaukoma"],
  H25: ["Senile cataract", "Старческая катаракта", "Senil katarakta"],
  H90: ["Conductive and sensorineural hearing loss", "Кондуктивная и нейросенсорная потеря слуха", "Konduktiv və sensorinevral eşitmə itkisi"],
  L30: ["Other dermatitis", "Другие дерматиты", "Digər dermatitlər"],
  L40: ["Psoriasis", "Псориаз", "Psoriaz"],
  L20: ["Atopic dermatitis", "Атопический дерматит", "Atopik dermatit"],
  A09: ["Other gastroenteritis and colitis of infectious and unspecified origin", "Другой гастроэнтерит и колит инфекционного и неуточненного происхождения", "İnfeksion və dəqiqləşdirilməmiş mənşəli digər qastroenterit və kolit"],
  A15: ["Respiratory tuberculosis, bacteriologically and histologically confirmed", "Туберкулез органов дыхания, подтвержденный бактериологически и гистологически", "Bakterioloji və histoloji təsdiqlənmiş tənəffüs orqanları vərəmi"],
  B18: ["Chronic viral hepatitis", "Хронический вирусный гепатит", "Xroniki virus hepatiti"],
  B20: ["Human immunodeficiency virus [HIV] disease resulting in infectious and parasitic diseases", "Болезнь, вызванная ВИЧ, проявляющаяся в виде инфекционных и паразитарных болезней", "İnfeksion və parazitar xəstəliklərlə nəticələnən HİV xəstəliyi"],
  C16: ["Malignant neoplasm of stomach", "Злокачественное новообразование желудка", "Mədənin bədxassəli yenitörəməsi"],
  C18: ["Malignant neoplasm of colon", "Злокачественное новообразование ободочной кишки", "Yoğun bağırsağın bədxassəli yenitörəməsi"],
  C34: ["Malignant neoplasm of bronchus and lung", "Злокачественное новообразование бронхов и легкого", "Bronx və ağciyərin bədxassəli yenitörəməsi"],
  C50: ["Malignant neoplasm of breast", "Злокачественное новообразование молочной железы", "Süd vəzisinin bədxassəli yenitörəməsi"],
  C61: ["Malignant neoplasm of prostate", "Злокачественное новообразование предстательной железы", "Prostatanın bədxassəli yenitörəməsi"],
  D50: ["Iron deficiency anaemia", "Железодефицитная анемия", "Dəmir çatışmazlığı anemiyası"],
  Z00: ["General examination and investigation of persons without complaint and reported diagnosis", "Общий осмотр и обследование лиц, не имеющих жалоб или установленного диагноза", "Şikayəti və hesab edilən diaqnozu olmayan şəxslərin ümumi müayinəsi"],
  "Z00.0": ["General medical examination", "Общий медицинский осмотр", "Ümumi tibbi müayinə"],
  Z01: ["Other special examinations and investigations of persons without complaint or reported diagnosis", "Другие специальные осмотры и обследования лиц, не имеющих жалоб или установленного диагноза", "Şikayəti və ya hesab edilən diaqnozu olmayan şəxslərin digər xüsusi müayinələri"],
  Z03: ["Medical observation and evaluation for suspected diseases and conditions", "Медицинское наблюдение и оценка при подозрении на заболевание или патологическое состояние", "Şübhəli xəstəlik və vəziyyətlər üçün tibbi müşahidə və qiymətləndirmə"],
  Z23: ["Need for immunization against single bacterial diseases", "Необходимость иммунизации против одной бактериальной болезни", "Tək bakterial xəstəliyə qarşı immunizasiya ehtiyacı"],
  Z33: ["Pregnant state, incidental", "Состояние, связанное с беременностью, случайное", "Təsadüfi hamiləlik vəziyyəti"],
  Z76: ["Persons encountering health services in other circumstances", "Обращения в учреждения здравоохранения в других обстоятельствах", "Digər hallarda səhiyyə xidmətlərinə müraciət edən şəxslər"],
  R10: ["Abdominal and pelvic pain", "Боли в области живота и таза", "Qarın və çanaq ağrısı"],
  R07: ["Pain in throat and chest", "Боль в горле и груди", "Boğaz və döş ağrısı"],
  R50: ["Fever of other and unknown origin", "Лихорадка неясного происхождения", "Qeyri-müəyyən mənşəli qızdırma"],
  R51: ["Headache", "Головная боль", "Baş ağrısı"],
  R53: ["Malaise and fatigue", "Недомогание и утомляемость", "Narahatlıq və yorğunluq"],
  R05: ["Cough", "Кашель", "Öskürək"],
  R06: ["Abnormalities of breathing", "Нарушения дыхания", "Tənəffüs pozğunluqları"],
  S06: ["Intracranial injury", "Внутричерепная травма", "Kəllədaxili travma"],
  S72: ["Fracture of femur", "Перелом бедренной кости", "Bud sümüyü sınığı"],
  T14: ["Injury of unspecified body region", "Травма неуточненной области тела", "Dəqiqləşdirilməmiş bədən nahiyəsinin travması"],
};

/** Leaf digit suffixes [en, ru, az] — .0–.8 specified forms, .9 unspecified */
const LEAF_SUFFIX = {
  0: ["specified", "уточнённая", "dəqiqləşdirilmiş"],
  1: ["specified form 1", "уточнённая форма 1", "dəqiqləşdirilmiş forma 1"],
  2: ["specified form 2", "уточнённая форма 2", "dəqiqləşdirilmiş forma 2"],
  3: ["specified form 3", "уточнённая форма 3", "dəqiqləşdirilmiş forma 3"],
  4: ["specified form 4", "уточнённая форма 4", "dəqiqləşdirilmiş forma 4"],
  5: ["specified form 5", "уточнённая форма 5", "dəqiqləşdirilmiş forma 5"],
  6: ["specified form 6", "уточнённая форма 6", "dəqiqləşdirilmiş forma 6"],
  7: ["specified form 7", "уточнённая форма 7", "dəqiqləşdirilmiş forma 7"],
  8: ["specified form 8", "уточнённая форма 8", "dəqiqləşdirilmiş forma 8"],
  9: ["unspecified", "неуточнённая", "dəqiqləşdirilməmiş"],
};

function icd3ToNum(code) {
  const c = String(code).toUpperCase();
  const letter = c.charCodeAt(0) - 65;
  const nn = parseInt(c.slice(1, 3), 10);
  return letter * 100 + nn;
}

function numToIcd3(n) {
  const letter = String.fromCharCode(65 + Math.floor(n / 100));
  const nn = String(n % 100).padStart(2, "0");
  return letter + nn;
}

function codesInRange(from, to) {
  const a = icd3ToNum(from);
  const b = icd3ToNum(to);
  const out = [];
  for (let i = a; i <= b; i++) out.push(numToIcd3(i));
  return out;
}

function chapterForRange(rangeStart) {
  const n = icd3ToNum(rangeStart);
  for (const [range, roman] of CHAPTERS) {
    const [from, to] = range.split("-");
    if (n >= icd3ToNum(from) && n <= icd3ToNum(to)) return roman;
  }
  return null;
}

function titlesFor(code, fallbackEn, fallbackRu, fallbackAz) {
  const o = TITLE_OVERRIDES[code];
  if (o) return o;
  return [fallbackEn, fallbackRu, fallbackAz];
}

function row({
  code,
  kind,
  chapterCode,
  blockCode,
  parentCode,
  titleEn,
  titleRu,
  titleAz,
  selectable,
}) {
  const searchText = [code, titleEn, titleRu, titleAz || ""]
    .join(" ")
    .toLowerCase();
  return {
    code,
    kind,
    chapterCode,
    blockCode,
    parentCode: parentCode ?? null,
    titleEn,
    titleRu,
    titleAz: titleAz ?? null,
    searchText,
    selectable: Boolean(selectable),
    active: true,
  };
}

function generateIcd10Catalog() {
  /** @type {Array<ReturnType<typeof row>>} */
  const rows = [];

  for (const [range, roman, en, ru, az] of CHAPTERS) {
    rows.push(
      row({
        code: roman,
        kind: "CHAPTER",
        chapterCode: roman,
        blockCode: range,
        parentCode: null,
        titleEn: en,
        titleRu: ru,
        titleAz: az,
        selectable: false,
      }),
    );
  }

  for (const [range, en, ru, az] of BLOCKS) {
    const [from, to] = range.split("-");
    const chapterCode = chapterForRange(from);
    if (!chapterCode) {
      throw new Error(`No chapter for block ${range}`);
    }
    rows.push(
      row({
        code: range,
        kind: "BLOCK",
        chapterCode,
        blockCode: range,
        parentCode: chapterCode,
        titleEn: en,
        titleRu: ru,
        titleAz: az,
        selectable: false,
      }),
    );

    for (const cat of codesInRange(from, to)) {
      const [catEn, catRu, catAz] = titlesFor(cat, en, ru, az);
      rows.push(
        row({
          code: cat,
          kind: "CATEGORY",
          chapterCode,
          blockCode: range,
          parentCode: range,
          titleEn: catEn,
          titleRu: catRu,
          titleAz: catAz,
          selectable: true,
        }),
      );

      for (let d = 0; d <= 9; d++) {
        const leaf = `${cat}.${d}`;
        const [sEn, sRu, sAz] = LEAF_SUFFIX[d];
        const [leafEn, leafRu, leafAz] = titlesFor(
          leaf,
          `${catEn}, ${sEn}`,
          `${catRu}, ${sRu}`,
          `${catAz}, ${sAz}`,
        );
        rows.push(
          row({
            code: leaf,
            kind: "LEAF",
            chapterCode,
            blockCode: range,
            parentCode: cat,
            titleEn: leafEn,
            titleRu: leafRu,
            titleAz: leafAz,
            selectable: true,
          }),
        );
      }
    }
  }

  return { rows, version: ICD10_VERSION };
}

function catalogStats(rows) {
  const byKind = {};
  let selectable = 0;
  const codes = new Set();
  for (const r of rows) {
    byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    if (r.selectable) selectable += 1;
    codes.add(r.code);
  }
  return {
    total: rows.length,
    selectable,
    byKind,
    hasI10: codes.has("I10"),
    hasM545: codes.has("M54.5"),
    hasJ069: codes.has("J06.9"),
    hasZ000: codes.has("Z00.0"),
    chapterCount: byKind.CHAPTER || 0,
  };
}

module.exports = { ICD10_VERSION, generateIcd10Catalog, catalogStats };
