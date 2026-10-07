/**
 * Plain-language privacy policy and terms (Kiswahili + English), written so a parent AND a
 * child can understand them. DRAFT — must be reviewed by a Tanzanian advocate before launch.
 * The version string is POLICY_VERSION and is recorded on every consent.
 */
export interface LegalDoc {
  title: string;
  intro: string;
  sections: Array<{ heading: string; body: string[] }>;
}

export const privacy: Record<"sw" | "en", (v: { version: string; dpo: string; residency: string }) => LegalDoc> = {
  sw: ({ version, dpo, residency }) => ({
    title: "Sera ya Faragha",
    intro: `Toleo ${version}. Sera hii inaeleza kwa lugha rahisi taarifa gani tunakusanya, kwa nini, na haki zako chini ya Sheria ya Ulinzi wa Taarifa Binafsi, 2022.`,
    sections: [
      {
        heading: "Tunakusanya nini?",
        body: [
          "Jina la utani (si jina halisi), picha ya mnyama uliyochagua, shule na darasa, na alama za michezo.",
          "Namba ya simu ya mzazi inatumika kutuma SMS ya ruhusa tu. Hatuhifadhi namba yenyewe — tunahifadhi alama ya siri (hash) isiyoweza kurudishwa kuwa namba.",
          "PIN ya mtoto inahifadhiwa kwa njia ya siri (hash).",
        ],
      },
      {
        heading: "Hatukusanyi",
        body: ["Jina halisi, tarehe ya kuzaliwa, picha, mahali alipo mtoto, anwani ya barua pepe wala orodha ya marafiki kwenye simu."],
      },
      {
        heading: "Ruhusa ya mzazi",
        body: [
          "Mtoto hawezi kushindana mtandaoni hadi mzazi au mlezi akubali kwa namba ya SMS. Kabla ya hapo, wasifu unakaa kwenye simu tu na hakuna kinachotumwa kwetu.",
          "Tunahifadhi kumbukumbu ya ruhusa: tarehe, toleo la sera, na alama ya siri ya namba ya mzazi.",
        ],
      },
      {
        heading: "Tunatumia taarifa kwa ajili gani?",
        body: ["Kuendesha michezo ya kujifunza, viwango vya wanafunzi na shule, na usalama (kuzuia udanganyifu na unyanyasaji). Hatuuzi taarifa, hatuonyeshi matangazo, na hatutumii taarifa kwa biashara."],
      },
      {
        heading: "Usalama wa watoto",
        body: ["Hakuna mazungumzo huru — ujumbe maalum tu. Majina ya utani yanachujwa. Kila mwanafunzi na kikundi kina vitufe vya Ripoti na Zuia."],
      },
      {
        heading: "Taarifa zinahifadhiwa wapi na kwa muda gani?",
        body: [
          `Seva zetu ziko: ${residency}. Taarifa zikihifadhiwa nje ya Tanzania, ni kwa nchi zenye ulinzi wa kutosha kama sheria inavyotaka.`,
          "Wasifu usiotumika kwa mwaka mmoja hufutwa moja kwa moja. Namba za SMS hufutwa ndani ya saa 24.",
        ],
      },
      {
        heading: "Haki zako",
        body: ["Kwenye Ukurasa wa Mzazi unaweza kuona, kupakua na kufuta taarifa zote za mtoto wako, na kuondoa ruhusa wakati wowote."],
      },
      {
        heading: "Uvujaji wa taarifa",
        body: ["Ikitokea taarifa kuvuja, tutaijulisha Tume ya Ulinzi wa Taarifa Binafsi na wazazi walioathirika haraka iwezekanavyo."],
      },
      { heading: "Mawasiliano", body: [`Afisa wa Ulinzi wa Taarifa: ${dpo}`] },
    ],
  }),
  en: ({ version, dpo, residency }) => ({
    title: "Privacy Policy",
    intro: `Version ${version}. This policy explains, in plain language, what we collect, why, and your rights under Tanzania's Personal Data Protection Act, 2022.`,
    sections: [
      {
        heading: "What we collect",
        body: [
          "A nickname (not a real name), the animal avatar you picked, school and class, and game scores.",
          "A parent's phone number is used only to send the consent SMS. We don't store the number itself — only a secret one-way hash that cannot be turned back into the number.",
          "The child's PIN is stored as a secure hash.",
        ],
      },
      { heading: "What we never collect", body: ["Real names, birthdates, photos, a child's location, email addresses or phone contacts."] },
      {
        heading: "Parent consent",
        body: [
          "A child cannot compete online until a parent or guardian agrees using an SMS code. Until then, the profile stays on the phone and nothing is sent to us.",
          "We keep a record of consent: the date, the policy version, and a hash of the parent's number.",
        ],
      },
      {
        heading: "How we use data",
        body: ["To run learning games, student and school rankings, and safety (preventing cheating and bullying). We never sell data, show ads, or use data for marketing."],
      },
      { heading: "Child safety", body: ["No open chat — preset messages only. Nicknames are filtered. Every student and group has Report and Block buttons."] },
      {
        heading: "Where and how long we keep data",
        body: [
          `Our servers are located in: ${residency}. If data is stored outside Tanzania, it is only in countries with adequate protection as the law requires.`,
          "Profiles inactive for one year are deleted automatically. SMS codes are deleted within 24 hours.",
        ],
      },
      { heading: "Your rights", body: ["On the Parent Page you can view, download and delete all of your child's data, and withdraw consent at any time."] },
      { heading: "Data breaches", body: ["If a breach happens, we will notify the Personal Data Protection Commission and affected parents as quickly as possible."] },
      { heading: "Contact", body: [`Data Protection Officer: ${dpo}`] },
    ],
  }),
};

export const terms: Record<"sw" | "en", LegalDoc> = {
  sw: {
    title: "Masharti ya Matumizi",
    intro: "Kwa kutumia School Pawa, unakubali masharti haya rahisi.",
    sections: [
      { heading: "Cheza kwa haki", body: ["Usidanganye, usitumie programu za kujibu, na usifungue wasifu mwingi. Pointi za kutiliwa shaka hukaguliwa kwanza kabla ya kuhesabiwa."] },
      { heading: "Kuwa mwema", body: ["Chagua majina mazuri. Usiweke namba ya simu, jina halisi au mitandao ya kijamii kwenye jina lako. Ripoti mtu yeyote anayekusumbua."] },
      {
        heading: "Pointi si pesa",
        body: ["Pointi, viwango na medali hazina thamani ya fedha. Hakuna ada ya kushiriki, hakuna zawadi za pesa au vocha za muda wa maongezi, na hakuna kununua bahati."],
      },
      { heading: "Maudhui", body: ["Maswali yameandaliwa na timu yetu na walimu, au yametumika kwa ruhusa. Ukiona kosa, bonyeza \"Swali lina kosa?\"."] },
      { heading: "Mabadiliko", body: ["Tukibadilisha masharti, tutawaomba wazazi ruhusa upya pale inapohitajika."] },
    ],
  },
  en: {
    title: "Terms of Use",
    intro: "By using School Pawa you agree to these simple terms.",
    sections: [
      { heading: "Play fair", body: ["Don't cheat, use answer bots or create multiple profiles. Suspicious points are reviewed before they count."] },
      { heading: "Be kind", body: ["Choose kind names. Don't put phone numbers, real names or social media in your name. Report anyone who bothers you."] },
      { heading: "Points are not money", body: ["Points, levels and badges have no monetary value. There are no entry fees, no cash or airtime prizes, and nothing to buy."] },
      { heading: "Content", body: ["Questions are written by our team and teachers, or used with permission. If you spot a mistake, tap \"Problem with this question?\"."] },
      { heading: "Changes", body: ["If we change these terms, we will ask parents for consent again where required."] },
    ],
  },
};
