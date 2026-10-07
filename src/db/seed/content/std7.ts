import { mcq, order, tf, type SeedTopic } from "./types";

// ─── Darasa la 7 · Hisabati ─────────────────────────────────────────────────────────────────

export const asilimia: SeedTopic = {
  code: "std7-his-asilimia",
  subject: "HIS-P",
  grade: "std7",
  nameSw: "Asilimia",
  nameEn: "Percentages",
  syllabusRef: "Hisabati Darasa la VII — Asilimia",
  language: "sw",
  lessons: [
    {
      title: "Asilimia ni nini?",
      body: "Asilimia (%) maana yake ni \"kwa kila mia\". 25% ni sehemu 25 kati ya 100, yaani 25/100 = 1/4.",
      example: "Darasa lina wanafunzi 100 na 40 ni wasichana. Wasichana ni 40%.",
    },
    {
      title: "Kutafuta asilimia ya kiasi",
      body: "Gawanya asilimia kwa 100 kisha zidisha kwa kiasi chote.",
      example: "20% ya 3,000 = 20/100 × 3,000 = 600.",
    },
    {
      title: "Punguzo na faida",
      body: "Punguzo hutolewa kwenye bei ya mwanzo. Faida = bei ya kuuza − bei ya kununua. Asilimia ya faida = faida ÷ bei ya kununua × 100.",
      example: "Shati la TZS 10,000 likipunguzwa 10%, punguzo ni 1,000 na bei mpya ni 9,000.",
    },
  ],
  questions: [
    tf("misingi", 1, "50% ni sawa na nusu (1/2).", true, "50/100 = 1/2."),
    mcq("misingi", 1, "Asilimia 25 ni sawa na sehemu ipi?", ["1/4", "1/5", "2/5", "1/2"], 0, "25/100 = 1/4."),
    mcq("kulinganisha", 2, "Kipi ni kikubwa zaidi?", ["70%", "0.65", "3/5", "1/2"], 0, "70% = 0.70; 0.65; 3/5 = 0.60; 1/2 = 0.50."),
    order("kulinganisha", 2, "Panga kuanzia kidogo hadi kikubwa.", ["0.3", "45%", "1/5", "2/5"], ["1/5", "0.3", "2/5", "45%"], "1/5 = 0.2, 0.3, 2/5 = 0.4, 45% = 0.45."),
    mcq("punguzo", 3, "Bei iliongezwa kwa 10% kisha ikapunguzwa kwa 10%. Bei mpya ikilinganishwa na ya mwanzo ni:", ["Ndogo kwa 1%", "Sawa kabisa", "Kubwa kwa 1%", "Ndogo kwa 10%"], 0, "Mfano 100 → 110 → 110 − 11 = 99, yaani pungufu kwa 1%."),
    tf("punguzo", 3, "Kuongeza 20% kisha kuongeza 20% tena ni sawa na kuongeza 40%.", false, "100 → 120 → 144: ongezeko ni 44%, si 40%."),
  ],
  templates: [
    {
      sub: "asilimia ya kiasi",
      d: 1,
      spec: {
        type: "number",
        prompt: "Tafuta {pct}% ya shilingi {amount}.",
        params: { pct: { choices: [10, 20, 25, 50, 75] }, amount: { min: 200, max: 8000, step: 100 } },
        constraints: ["amount * pct % 100 == 0"],
        answer: "amount * pct / 100",
        explanation: "{pct}% ya {amount} = {pct}/100 × {amount} = {answer}.",
        unit: "TZS",
      },
    },
    {
      sub: "desimali",
      d: 1,
      spec: {
        type: "number",
        prompt: "Andika {pct}% kama desimali.",
        params: { pct: { min: 5, max: 95, step: 5 } },
        answer: "pct / 100",
        decimals: 2,
        tolerance: 0.001,
        explanation: "{pct}% = {pct}/100 = {answer}.",
      },
    },
    {
      sub: "sehemu kuwa asilimia",
      d: 2,
      spec: {
        type: "number",
        prompt: "Badilisha sehemu {a}/{b} kuwa asilimia.",
        params: { a: { min: 1, max: 49 }, b: { choices: [2, 4, 5, 10, 20, 25, 50] } },
        constraints: ["a < b", "gcd(a, b) == 1"],
        answer: "a / b * 100",
        explanation: "{a}/{b} × 100 = {answer}%.",
        unit: "%",
      },
    },
    {
      sub: "punguzo",
      d: 2,
      spec: {
        type: "mcq",
        prompt: "Bei ya shati ni TZS {price}. Imepunguzwa kwa {pct}%. Bei mpya ni ipi?",
        params: { price: { min: 5000, max: 40000, step: 1000 }, pct: { choices: [10, 20, 25, 50] } },
        derived: { cut: "price * pct / 100" },
        constraints: ["cut % 100 == 0"],
        answer: "price - cut",
        distractors: ["cut", "price + cut", "price - pct"],
        explanation: "Punguzo = {pct}% ya {price} = {cut}. Bei mpya = {price} − {cut} = {answer}.",
        unit: "TZS",
      },
    },
    {
      sub: "faida",
      d: 3,
      spec: {
        type: "number",
        prompt: "Mfanyabiashara alinunua mbuzi kwa TZS {cost} akamuuza kwa TZS {sell}. Asilimia ya faida ni ngapi?",
        params: { cost: { min: 20000, max: 90000, step: 5000 }, pct: { choices: [10, 20, 25, 40, 50] } },
        derived: { sell: "cost * (100 + pct) / 100", profit: "cost * pct / 100" },
        constraints: ["sell % 500 == 0"],
        answer: "pct",
        explanation: "Faida = {sell} − {cost} = {profit}. Asilimia = {profit} ÷ {cost} × 100 = {answer}%.",
        unit: "%",
      },
    },
    {
      sub: "ongezeko",
      d: 3,
      spec: {
        type: "mcq",
        prompt: "Shule ilikuwa na wanafunzi {before}. Mwaka huu wameongezeka kwa {pct}%. Sasa shule ina wanafunzi wangapi?",
        params: { before: { min: 200, max: 1200, step: 20 }, pct: { choices: [5, 10, 15, 20, 25] } },
        derived: { added: "before * pct / 100" },
        constraints: ["added == floor(added)"],
        answer: "before + added",
        distractors: ["added", "before + pct", "before - added"],
        explanation: "Ongezeko = {pct}% ya {before} = {added}. Jumla = {before} + {added} = {answer}.",
      },
    },
  ],
};

export const eneo: SeedTopic = {
  code: "std7-his-eneo",
  subject: "HIS-P",
  grade: "std7",
  nameSw: "Mzingo na Eneo",
  nameEn: "Perimeter and Area",
  syllabusRef: "Hisabati Darasa la VII — Vipimo: Mzingo na Eneo",
  language: "sw",
  lessons: [
    {
      title: "Mzingo",
      body: "Mzingo ni urefu wa kuzunguka umbo lote. Kwa mstatili: Mzingo = 2 × (urefu + upana).",
      example: "Mstatili wa m 8 kwa m 5: mzingo = 2 × (8 + 5) = m 26.",
    },
    {
      title: "Eneo",
      body: "Eneo ni ukubwa wa uso wa umbo, hupimwa kwa vipimo vya mraba (m², sm²). Mstatili: urefu × upana. Pembetatu: ½ × kitako × kimo.",
      example: "Pembetatu yenye kitako sm 10 na kimo sm 6: eneo = ½ × 10 × 6 = sm² 30.",
    },
    {
      title: "Duara",
      body: "Mzingo wa duara = 2 × π × nusu-kipenyo. Eneo = π × nusu-kipenyo × nusu-kipenyo. Tumia π = 22/7.",
      example: "Nusu-kipenyo sm 7: mzingo = 2 × 22/7 × 7 = sm 44.",
    },
  ],
  questions: [
    tf("mraba", 1, "Mzingo wa mraba wenye upande wa sm 5 ni sm 20.", true, "4 × 5 = 20."),
    mcq("vipimo", 1, "Kipi ni kipimo cha eneo?", ["m²", "m", "kg", "lita"], 0, "Eneo hupimwa kwa vipimo vya mraba kama m²."),
    mcq("duara", 1, "Kipenyo cha duara ni sm 14. Nusu-kipenyo ni sentimita ngapi?", ["7", "14", "28", "44"], 0, "Nusu-kipenyo ni nusu ya kipenyo: 14 ÷ 2 = 7."),
    order("vipimo", 2, "Panga vipimo kuanzia kifupi hadi kirefu.", ["1 m", "50 cm", "2000 mm", "0.8 m"], ["50 cm", "0.8 m", "1 m", "2000 mm"], "50 cm = 0.5 m, 0.8 m, 1 m, 2000 mm = 2 m."),
    tf("mstatili", 3, "Ukiongeza urefu na upana wa mstatili mara mbili, eneo lake linaongezeka mara nne.", true, "(2u) × (2p) = 4 × u × p."),
  ],
  templates: [
    {
      sub: "mstatili",
      d: 1,
      spec: {
        type: "number",
        prompt: "Shamba la mstatili lina urefu wa mita {l} na upana wa mita {w}. Eneo lake ni mita za mraba ngapi?",
        params: { l: { min: 5, max: 40 }, w: { min: 3, max: 25 } },
        constraints: ["l > w"],
        answer: "l * w",
        explanation: "Eneo = urefu × upana = {l} × {w} = {answer} m².",
        unit: "m²",
      },
    },
    {
      sub: "mstatili",
      d: 1,
      spec: {
        type: "number",
        prompt: "Uwanja wa mstatili una urefu wa mita {l} na upana wa mita {w}. Mzingo wake ni mita ngapi?",
        params: { l: { min: 10, max: 120 }, w: { min: 5, max: 80 } },
        constraints: ["l > w"],
        answer: "2 * (l + w)",
        explanation: "Mzingo = 2 × ({l} + {w}) = {answer} m.",
        unit: "m",
      },
    },
    {
      sub: "mraba",
      d: 2,
      spec: {
        type: "number",
        prompt: "Mzingo wa mraba ni sentimita {p}. Eneo lake ni sentimita za mraba ngapi?",
        params: { s: { min: 3, max: 25 } },
        derived: { p: "4 * s" },
        answer: "s * s",
        explanation: "Upande = {p} ÷ 4 = {s}. Eneo = {s} × {s} = {answer} sm².",
        unit: "sm²",
      },
    },
    {
      sub: "pembetatu",
      d: 2,
      spec: {
        type: "number",
        prompt: "Pembetatu ina kitako cha sm {b} na kimo cha sm {h}. Eneo lake ni sentimita za mraba ngapi?",
        params: { b: { min: 4, max: 30, step: 2 }, h: { min: 3, max: 20 } },
        answer: "b * h / 2",
        explanation: "Eneo = ½ × {b} × {h} = {answer} sm².",
        unit: "sm²",
      },
    },
    {
      sub: "mstatili",
      d: 2,
      spec: {
        type: "number",
        prompt: "Eneo la chumba cha mstatili ni mita za mraba {area} na upana wake ni mita {w}. Urefu wake ni mita ngapi?",
        params: { l: { min: 4, max: 15 }, w: { min: 3, max: 10 } },
        derived: { area: "l * w" },
        constraints: ["l > w"],
        answer: "l",
        explanation: "Urefu = eneo ÷ upana = {area} ÷ {w} = {answer} m.",
        unit: "m",
      },
    },
    {
      sub: "duara",
      d: 3,
      spec: {
        type: "mcq",
        prompt: "Duara lina nusu-kipenyo cha sm {r}. Tumia π = 22/7. Mzingo wake ni upi?",
        params: { r: { choices: [7, 14, 21, 28, 35] } },
        answer: "2 * 22 / 7 * r",
        distractors: ["22 / 7 * r * r", "22 / 7 * r", "4 * 22 / 7 * r"],
        explanation: "Mzingo = 2 × 22/7 × {r} = {answer} sm.",
        unit: "sm",
      },
    },
    {
      sub: "duara",
      d: 3,
      spec: {
        type: "number",
        prompt: "Tafuta eneo la duara lenye nusu-kipenyo cha mita {r}. Tumia π = 22/7.",
        params: { r: { choices: [7, 14, 21, 28] } },
        answer: "22 / 7 * r * r",
        explanation: "Eneo = 22/7 × {r} × {r} = {answer} m².",
        unit: "m²",
      },
    },
  ],
};

// ─── Darasa la 7 · Sayansi na Teknolojia ────────────────────────────────────────────────────

export const umengenyaji: SeedTopic = {
  code: "std7-say-umengenyaji",
  subject: "SAY-P",
  grade: "std7",
  nameSw: "Mfumo wa Umeng'enyaji wa Chakula",
  nameEn: "The Digestive System",
  syllabusRef: "Sayansi na Teknolojia Darasa la VII — Mifumo ya mwili: Umeng'enyaji",
  language: "sw",
  lessons: [
    {
      title: "Safari ya chakula",
      body: "Chakula hupita mdomoni → umio → tumbo → utumbo mwembamba → utumbo mpana. Meno husaga chakula na mate huanza kumeng'enya wanga.",
    },
    {
      title: "Viungo vinavyosaidia",
      body: "Ini hutengeneza nyongo inayosaidia kumeng'enya mafuta. Kongosho hutoa vimeng'enya. Chakula kilichomeng'enywa hufyonzwa kwenye utumbo mwembamba.",
      example: "Kibofu cha nyongo huhifadhi nyongo kabla haijaenda kwenye utumbo mwembamba.",
    },
    {
      title: "Kutunza mfumo wa umeng'enyaji",
      body: "Kula vyakula vyenye nyuzinyuzi, kunywa maji safi ya kutosha, kutafuna vizuri na kunawa mikono kabla ya kula.",
    },
  ],
  questions: [
    mcq("njia ya chakula", 1, "Umeng'enyaji wa chakula huanzia wapi?", ["Mdomoni", "Tumboni", "Utumbo mwembamba", "Umio"], 0, "Meno husaga chakula na mate huanza kumeng'enya wanga mdomoni."),
    mcq("njia ya chakula", 1, "Mrija unaopeleka chakula kutoka kinywani hadi tumboni unaitwa:", ["Umio", "Utumbo mpana", "Kongosho", "Ini"], 0, "Umio huunganisha kinywa na tumbo."),
    tf("meno", 1, "Meno husaidia kusaga chakula kuwa vipande vidogo.", true, "Vipande vidogo humeng'enywa kwa urahisi zaidi."),
    mcq("tezi", 1, "Mate hutengenezwa na:", ["Tezi za mate", "Ini", "Tumbo", "Figo"], 0, "Tezi za mate zilizo mdomoni hutoa mate."),
    mcq("afya", 1, "Ipi ni tabia nzuri ya kutunza mfumo wa umeng'enyaji?", ["Kunywa maji safi ya kutosha", "Kula haraka bila kutafuna", "Kula pipi nyingi kila siku", "Kula bila kunawa mikono"], 0, "Maji safi husaidia umeng'enyaji na kuzuia kuvimbiwa."),
    tf("utumbo", 2, "Utumbo mpana hufyonza maji kutoka kwenye mabaki ya chakula.", true, "Maji hufyonzwa na mabaki hubaki kuwa kinyesi."),
    mcq("utumbo", 2, "Chakula kilichomeng'enywa hufyonzwa kuingia kwenye damu hasa katika:", ["Utumbo mwembamba", "Tumbo", "Umio", "Utumbo mpana"], 0, "Utumbo mwembamba una eneo kubwa la kufyonza chakula."),
    order("njia ya chakula", 2, "Panga njia ya chakula kuanzia mwanzo hadi mwisho.", ["Tumbo", "Mdomo", "Utumbo mwembamba", "Umio", "Utumbo mpana"], ["Mdomo", "Umio", "Tumbo", "Utumbo mwembamba", "Utumbo mpana"], "Mdomo → umio → tumbo → utumbo mwembamba → utumbo mpana."),
    mcq("vimeng'enya", 2, "Kimeng'enya kilichopo kwenye mate humeng'enya chakula cha aina gani?", ["Wanga", "Protini", "Mafuta", "Vitamini"], 0, "Mate yana kimeng'enya kinachoanza kuvunja wanga."),
    tf("tumbo", 2, "Tumbo hutoa asidi inayosaidia kuua vijidudu vilivyomo kwenye chakula.", true, "Asidi ya tumbo pia husaidia kumeng'enya protini."),
    mcq("ini", 2, "Nyongo hutengenezwa na kiungo gani?", ["Ini", "Kongosho", "Tumbo", "Moyo"], 0, "Ini hutengeneza nyongo; kibofu cha nyongo huihifadhi."),
    mcq("utumbo", 3, "Kazi ya vinyweleo vidogo (villi) kwenye utumbo mwembamba ni:", ["Kuongeza eneo la kufyonza chakula", "Kusaga chakula", "Kutengeneza mate", "Kuhifadhi nyongo"], 0, "Villi huongeza eneo ili chakula kingi kifyonzwe."),
    mcq("ini", 3, "Nyongo husaidia kumeng'enya chakula cha aina gani?", ["Mafuta", "Wanga", "Protini", "Madini"], 0, "Nyongo hugawanya mafuta kuwa matone madogo."),
    tf("vimeng'enya", 3, "Protini huanza kumeng'enywa mdomoni.", false, "Protini huanza kumeng'enywa tumboni."),
    mcq("afya", 3, "Kukosa nyuzinyuzi za kutosha katika chakula husababisha hali gani?", ["Kuvimbiwa", "Malaria", "Kifua kikuu", "Surua"], 0, "Nyuzinyuzi husaidia mabaki ya chakula kupita kwa urahisi."),
  ],
  templates: [],
};

export const umeme: SeedTopic = {
  code: "std7-say-umeme",
  subject: "SAY-P",
  grade: "std7",
  nameSw: "Umeme",
  nameEn: "Electricity",
  syllabusRef: "Sayansi na Teknolojia Darasa la VII — Nishati: Umeme",
  language: "sw",
  lessons: [
    {
      title: "Saketi ya umeme",
      body: "Saketi ni njia kamili ambayo umeme hupita. Saketi rahisi ina chanzo (betri), waya, swichi na kifaa kama balbu.",
      example: "Swichi ikizimwa, saketi inakuwa wazi na balbu haiwaki.",
    },
    {
      title: "Vipitisha na vihami",
      body: "Vipitisha umeme (kama shaba na chuma) huruhusu umeme kupita. Vihami (kama plastiki, mpira na mbao kavu) huzuia umeme.",
    },
    {
      title: "Usalama",
      body: "Usiguse nyaya zilizochunika au zilizoanguka. Usiguse soketi kwa mikono iliyolowa. Fyuzi hulinda nyumba umeme unapozidi.",
    },
  ],
  questions: [
    mcq("vipitisha", 1, "Kipi kati ya hivi ni kipitisha umeme?", ["Waya wa shaba", "Mpira", "Plastiki", "Mbao kavu"], 0, "Shaba ni metali inayopitisha umeme vizuri."),
    mcq("saketi", 1, "Kifaa kinachotumika kuwasha na kuzima umeme kwenye saketi ni:", ["Swichi", "Betri", "Balbu", "Waya"], 0, "Swichi hufunga au kufungua saketi."),
    tf("usalama", 1, "Ni salama kugusa waya wa umeme ulioanguka barabarani.", false, "Kamwe! Ripoti kwa mtu mzima na kaa mbali."),
    mcq("vyanzo", 1, "Chanzo cha umeme kwenye tochi ni:", ["Betri", "Balbu", "Swichi", "Kioo"], 0, "Betri hubadilisha nishati ya kemikali kuwa umeme."),
    tf("vipitisha", 1, "Plastiki huzuia umeme kupita, ndiyo maana hufunika nyaya.", true, "Plastiki ni kihami."),
    mcq("usalama", 1, "Ipi ni njia salama ya kutumia umeme nyumbani?", ["Kuzima swichi kabla ya kuchomoa plagi", "Kugusa soketi kwa mikono iliyolowa", "Kuchomeka plagi nyingi kwenye soketi moja", "Kutumia nyaya zilizochunika"], 0, "Kuzima swichi kwanza hupunguza hatari ya shoti."),
    mcq("saketi", 2, "Saketi ya umeme ikiwa wazi, balbu:", ["Haiwaki", "Inawaka zaidi", "Inawaka kidogo", "Inalipuka"], 0, "Umeme hauwezi kupita kwenye saketi iliyo wazi."),
    mcq("nishati", 2, "Kwenye balbu, nishati ya umeme hubadilishwa kuwa:", ["Mwanga na joto", "Sauti tu", "Mwendo", "Kemikali"], 0, "Balbu hutoa mwanga na pia hupata joto."),
    tf("vipitisha", 2, "Maji yenye chumvi yanaweza kupitisha umeme.", true, "Ndiyo sababu ni hatari kutumia vifaa vya umeme ukiwa umelowa."),
    mcq("vyanzo", 2, "Kipi ni chanzo cha umeme kisichoisha (kinachojirudia)?", ["Jua", "Makaa ya mawe", "Mafuta ya petroli", "Gesi asilia"], 0, "Nishati ya jua haiishi."),
    order("nishati", 3, "Panga mtiririko wa nishati kwenye bwawa la kufua umeme.", ["Jenereta inazalisha umeme", "Maji yanatiririka kwa kasi", "Umeme unafika nyumbani", "Turbine inazunguka"], ["Maji yanatiririka kwa kasi", "Turbine inazunguka", "Jenereta inazalisha umeme", "Umeme unafika nyumbani"], "Maji huzungusha turbine, turbine huendesha jenereta, umeme husafirishwa."),
    mcq("saketi", 3, "Balbu mbili zimeunganishwa kwa mfululizo. Balbu moja ikiungua:", ["Nyingine pia inazima", "Nyingine inawaka zaidi", "Nyingine haiathiriki", "Betri inajichaji"], 0, "Kwenye mfululizo kuna njia moja tu; ikikatika saketi yote inakuwa wazi."),
    mcq("usalama", 3, "Kifaa kinacholinda nyumba umeme unapozidi ni:", ["Fyuzi", "Swichi", "Soketi", "Balbu"], 0, "Fyuzi huyeyuka na kukata umeme unapozidi."),
    tf("saketi", 3, "Kwenye saketi sambamba, balbu moja ikiungua nyingine huendelea kuwaka.", true, "Kila balbu ina njia yake."),
    mcq("vipimo", 3, "Kipimo cha mkondo wa umeme ni:", ["Ampea", "Volti", "Wati", "Mita"], 0, "Mkondo hupimwa kwa ampea (A)."),
  ],
  templates: [],
};

export const std7Topics = [asilimia, eneo, umengenyaji, umeme];

