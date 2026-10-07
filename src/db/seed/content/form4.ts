import { mcq, order, tf, type SeedTopic } from "./types";

// ─── Form 4 · Basic Mathematics ─────────────────────────────────────────────────────────────

export const sequences: SeedTopic = {
  code: "f4-bm-sequences",
  subject: "BMATH-S",
  grade: "form4",
  nameSw: "Mfuatano na Mfululizo",
  nameEn: "Sequences and Series",
  syllabusRef: "Basic Mathematics Form IV — Sequences and Series",
  language: "en",
  lessons: [
    {
      title: "Arithmetic progressions (AP)",
      body: "Each term is found by adding a fixed common difference d. The nth term is Tₙ = a + (n − 1)d and the sum of n terms is Sₙ = n/2 × (2a + (n − 1)d).",
      example: "3, 7, 11, 15 … has a = 3, d = 4, so T₁₀ = 3 + 9 × 4 = 39.",
    },
    {
      title: "Geometric progressions (GP)",
      body: "Each term is found by multiplying by a fixed common ratio r. Tₙ = a × rⁿ⁻¹ and Sₙ = a(rⁿ − 1)/(r − 1) for r ≠ 1.",
      example: "2, 6, 18 … has r = 3, so T₅ = 2 × 3⁴ = 162.",
    },
    {
      title: "Sum to infinity",
      body: "When −1 < r < 1 the terms of a GP shrink towards zero and the series has a sum to infinity S∞ = a / (1 − r).",
      example: "8 + 4 + 2 + … : a = 8, r = ½, so S∞ = 8 / ½ = 16.",
    },
  ],
  questions: [
    tf("gp", 1, "The sequence 2, 6, 18, 54 is a geometric progression.", true, "Each term is multiplied by 3."),
    mcq("gp", 2, "The common ratio of 81, 27, 9, 3 is:", ["1/3", "3", "−3", "1/9"], 0, "27 ÷ 81 = 1/3."),
    mcq("gp", 3, "The sum to infinity of 8 + 4 + 2 + 1 + … is:", ["16", "15", "Infinity", "12"], 0, "S∞ = a/(1 − r) = 8/(1 − ½) = 16."),
    order("ap", 2, "Arrange these terms of the AP 5, 9, 13 … from first to last.", ["T₄", "T₁", "T₁₀", "T₂"], ["T₁", "T₂", "T₄", "T₁₀"], "Terms of an increasing AP grow with n."),
  ],
  templates: [
    {
      sub: "ap",
      d: 1,
      spec: {
        type: "number",
        prompt: "The first term of an arithmetic progression is {a} and the common difference is {d}. Find term number {n}.",
        params: { a: { min: 1, max: 20 }, d: { min: 2, max: 9 }, n: { min: 5, max: 20 } },
        answer: "a + (n - 1) * d",
        explanation: "Tₙ = a + (n − 1)d = {a} + ({n} − 1) × {d} = {answer}.",
      },
    },
    {
      sub: "ap",
      d: 1,
      spec: {
        type: "number",
        prompt: "Find the common difference of the sequence {t1}, {t2}, {t3}, …",
        params: { a: { min: -10, max: 30 }, d: { min: -6, max: 9 } },
        derived: { t1: "a", t2: "a + d", t3: "a + 2 * d" },
        constraints: ["d != 0"],
        answer: "d",
        explanation: "d = {t2} − {t1} = {answer}.",
      },
    },
    {
      sub: "ap",
      d: 2,
      spec: {
        type: "number",
        prompt: "Find the sum of the first {n} terms of the AP whose first term is {a} and common difference is {d}.",
        params: { a: { min: 1, max: 15 }, d: { min: 1, max: 8 }, n: { min: 6, max: 20 } },
        answer: "n / 2 * (2 * a + (n - 1) * d)",
        explanation: "Sₙ = n/2 × (2a + (n − 1)d) = {n}/2 × (2 × {a} + ({n} − 1) × {d}) = {answer}.",
      },
    },
    {
      sub: "ap",
      d: 2,
      spec: {
        type: "number",
        prompt: "Juma saves TZS {a} in the first week and increases his savings by TZS {d} every week. How much does he save in week {n}?",
        params: { a: { min: 1000, max: 5000, step: 500 }, d: { min: 200, max: 1000, step: 100 }, n: { min: 5, max: 20 } },
        answer: "a + (n - 1) * d",
        explanation: "This is an AP: Tₙ = {a} + ({n} − 1) × {d} = {answer}.",
        unit: "TZS",
      },
    },
    {
      sub: "gp",
      d: 2,
      spec: {
        type: "mcq",
        prompt: "A geometric progression has first term {a} and common ratio {r}. What is term number {n}?",
        params: { a: { choices: [1, 2, 3, 5] }, r: { choices: [2, 3] }, n: { min: 3, max: 7 } },
        answer: "a * r ^ (n - 1)",
        distractors: ["a * r ^ n", "a * r * (n - 1)", "a * r ^ (n - 2)"],
        explanation: "Tₙ = a × rⁿ⁻¹ = {a} × {r}^({n} − 1) = {answer}.",
      },
    },
    {
      sub: "gp",
      d: 3,
      spec: {
        type: "number",
        prompt: "Find the sum of the first {n} terms of the GP with first term {a} and common ratio {r}.",
        params: { a: { choices: [1, 2, 3] }, r: { choices: [2, 3] }, n: { min: 3, max: 7 } },
        answer: "a * (r ^ n - 1) / (r - 1)",
        explanation: "Sₙ = a(rⁿ − 1)/(r − 1) = {a}({r}^{n:raw} − 1)/({r} − 1) = {answer}.",
      },
    },
    {
      sub: "ap",
      d: 3,
      spec: {
        type: "number",
        prompt: "How many terms are there in the arithmetic progression {a}, {t2}, …, {last}?",
        params: { a: { min: 2, max: 20 }, d: { min: 2, max: 7 }, n: { min: 8, max: 30 } },
        derived: { t2: "a + d", last: "a + (n - 1) * d" },
        answer: "n",
        explanation: "{last} = {a} + (n − 1) × {d:raw}, so n − 1 = ({last} − {a}) ÷ {d:raw} and n = {answer}.",
      },
    },
  ],
};

export const solids: SeedTopic = {
  code: "f4-bm-solids",
  subject: "BMATH-S",
  grade: "form4",
  nameSw: "Maumbo ya Pande Tatu",
  nameEn: "Three-Dimensional Figures",
  syllabusRef: "Basic Mathematics Form IV — Three Dimensional Figures (surface area & volume)",
  language: "en",
  lessons: [
    {
      title: "Prisms and cuboids",
      body: "Volume of a prism = area of cross-section × length. For a cuboid: V = l × w × h. Total surface area of a cuboid = 2(lw + lh + wh).",
      example: "A 5 × 4 × 3 cm box: V = 60 cm³, surface area = 2(20 + 15 + 12) = 94 cm².",
    },
    {
      title: "Cylinders, cones and pyramids",
      body: "Cylinder V = πr²h. A cone or pyramid has one third the volume of the prism/cylinder with the same base and height: V = ⅓ × base area × h.",
      example: "Cone with r = 7 cm, h = 9 cm: V = ⅓ × 22/7 × 49 × 9 = 462 cm³.",
    },
    {
      title: "Spheres",
      body: "Volume of a sphere = 4/3 πr³ and surface area = 4πr². Doubling the radius multiplies the volume by 8.",
    },
  ],
  questions: [
    tf("solids", 1, "A cube has 8 vertices.", true, "A cube has 8 vertices, 12 edges and 6 faces."),
    mcq("solids", 1, "How many faces does a cuboid have?", ["6", "8", "12", "4"], 0, "Top, bottom and four sides."),
    mcq("cylinder", 2, "How many curved surfaces does a closed cylinder have?", ["1", "2", "3", "0"], 0, "One curved surface and two flat circular faces."),
    tf("sphere", 3, "If the radius of a sphere doubles, its volume becomes 8 times larger.", true, "Volume ∝ r³ and 2³ = 8."),
  ],
  templates: [
    {
      sub: "cuboid",
      d: 1,
      spec: {
        type: "number",
        prompt: "Find the volume of a cuboid measuring {l} cm by {w} cm by {h} cm.",
        params: { l: { min: 3, max: 20 }, w: { min: 2, max: 15 }, h: { min: 2, max: 12 } },
        answer: "l * w * h",
        explanation: "V = l × w × h = {l} × {w} × {h} = {answer} cm³.",
        unit: "cm³",
      },
    },
    {
      sub: "cube",
      d: 1,
      spec: {
        type: "number",
        prompt: "Find the total surface area of a cube with edges of {s} cm.",
        params: { s: { min: 2, max: 15 } },
        answer: "6 * s * s",
        explanation: "A cube has 6 equal square faces: 6 × {s}² = {answer} cm².",
        unit: "cm²",
      },
    },
    {
      sub: "cuboid",
      d: 2,
      spec: {
        type: "number",
        prompt: "A closed box is {l} cm long, {w} cm wide and {h} cm high. Find its total surface area.",
        params: { l: { min: 4, max: 20 }, w: { min: 3, max: 15 }, h: { min: 2, max: 12 } },
        answer: "2 * (l * w + l * h + w * h)",
        explanation: "TSA = 2(lw + lh + wh) = 2({l}×{w} + {l}×{h} + {w}×{h}) = {answer} cm².",
        unit: "cm²",
      },
    },
    {
      sub: "cylinder",
      d: 2,
      spec: {
        type: "number",
        prompt: "A water tank is a cylinder with radius {r} dm and height {h} dm. Find its volume in dm³. (Use π = 22/7)",
        params: { r: { choices: [7, 14, 21] }, h: { min: 5, max: 20 } },
        answer: "22 / 7 * r * r * h",
        explanation: "V = πr²h = 22/7 × {r}² × {h} = {answer} dm³ (litres).",
        unit: "dm³",
      },
    },
    {
      sub: "cone",
      d: 3,
      spec: {
        type: "number",
        prompt: "Find the volume of a cone with base radius {r} cm and height {h} cm. (Use π = 22/7)",
        params: { r: { choices: [7, 14, 21] }, h: { min: 3, max: 30, step: 3 } },
        answer: "22 / 7 * r * r * h / 3",
        explanation: "V = ⅓πr²h = ⅓ × 22/7 × {r}² × {h} = {answer} cm³.",
        unit: "cm³",
      },
    },
    {
      sub: "sphere",
      d: 3,
      spec: {
        type: "mcq",
        prompt: "Find the volume of a sphere of radius {r} cm. (Use π = 22/7)",
        params: { r: { choices: [7, 14, 21] } },
        answer: "4 / 3 * 22 / 7 * r ^ 3",
        decimals: 2,
        distractors: ["4 * 22 / 7 * r ^ 2", "22 / 7 * r ^ 3", "4 / 3 * 22 / 7 * r ^ 2"],
        explanation: "V = 4/3 πr³ = 4/3 × 22/7 × {r}³ = {answer} cm³.",
        unit: "cm³",
      },
    },
    {
      sub: "pyramid",
      d: 3,
      spec: {
        type: "number",
        prompt: "A pyramid has a square base of side {s} m and a vertical height of {h} m. Find its volume.",
        params: { s: { min: 3, max: 12 }, h: { min: 3, max: 24, step: 3 } },
        answer: "s * s * h / 3",
        explanation: "V = ⅓ × base area × h = ⅓ × {s}² × {h} = {answer} m³.",
        unit: "m³",
      },
    },
  ],
};

// ─── Form 4 · Biology ───────────────────────────────────────────────────────────────────────

export const genetics: SeedTopic = {
  code: "f4-bio-genetics",
  subject: "BIO-S",
  grade: "form4",
  nameSw: "Jenetiki",
  nameEn: "Genetics",
  syllabusRef: "Biology Form IV — Genetics",
  language: "en",
  lessons: [
    {
      title: "Genes and chromosomes",
      body: "Genes are units of heredity carried on chromosomes in the nucleus. Human body cells normally have 46 chromosomes (23 pairs). Different forms of a gene are called alleles.",
    },
    {
      title: "Dominant and recessive",
      body: "A dominant allele (T) shows its effect even with one copy. A recessive allele (t) shows only when two copies are present (tt). TT and tt are homozygous; Tt is heterozygous.",
      example: "Tt × Tt gives TT : Tt : tt = 1 : 2 : 1, so 3/4 of offspring show the dominant trait.",
    },
    {
      title: "Sex determination and sex-linkage",
      body: "Females are XX and males XY, so the father's sperm decides the sex of the child. Genes on the X chromosome (e.g. haemophilia) show sex-linked inheritance.",
    },
  ],
  questions: [
    mcq("basics", 1, "The basic unit of heredity is the:", ["Gene", "Cell wall", "Ribosome", "Chloroplast"], 0, "Genes carry hereditary information."),
    mcq("basics", 1, "Who is known as the father of genetics?", ["Gregor Mendel", "Charles Darwin", "Louis Pasteur", "Robert Hooke"], 0, "Mendel's pea-plant experiments founded genetics."),
    tf("chromosomes", 1, "Human body cells normally contain 46 chromosomes.", true, "23 pairs: 22 pairs of autosomes and one pair of sex chromosomes."),
    mcq("terms", 1, "An organism with two identical alleles for a trait is:", ["Homozygous", "Heterozygous", "Hybrid", "Mutant"], 0, "Homo = same."),
    tf("sex", 1, "Sex in humans is determined by the X and Y chromosomes.", true, "XX is female, XY is male."),
    mcq("crosses", 2, "If T (tall) is dominant over t (short), what fraction of offspring from Tt × Tt is expected to be tall?", ["3/4", "1/2", "1/4", "All"], 0, "TT, Tt, Tt are tall; only tt is short."),
    mcq("terms", 2, "The observable characteristics of an organism make up its:", ["Phenotype", "Genotype", "Allele", "Karyotype"], 0, "Phenotype = what you can observe."),
    mcq("sex", 2, "Which parent determines the sex of a human child?", ["The father", "The mother", "Both equally", "Neither"], 0, "Sperm carries either X or Y; eggs always carry X."),
    tf("terms", 2, "A recessive trait is expressed only when two recessive alleles are present.", true, "With one dominant allele, the dominant trait shows."),
    mcq("disorders", 2, "Down's syndrome is caused by:", ["An extra chromosome 21", "A missing X chromosome", "Eating too much sugar", "A bacterial infection"], 0, "Trisomy 21: three copies of chromosome 21."),
    mcq("crosses", 3, "Crossing a heterozygous plant (Rr) with a homozygous recessive plant (rr) gives a phenotypic ratio of:", ["1 : 1", "3 : 1", "1 : 2 : 1", "All dominant"], 0, "Rr × rr → Rr : rr = 1 : 1 (a test cross)."),
    mcq("sex", 3, "Haemophilia is more common in males because the gene is:", ["Carried on the X chromosome", "Carried on the Y chromosome", "Caused by diet", "Always dominant"], 0, "Males have one X, so one recessive allele is enough."),
    mcq("disorders", 3, "Two parents are both carriers of the sickle-cell allele (AS). What is the probability that their child has sickle-cell anaemia (SS)?", ["1/4", "1/2", "3/4", "0"], 0, "AS × AS → AA : AS : SS = 1 : 2 : 1."),
    order("chromosomes", 3, "Arrange from largest to smallest.", ["Gene", "Chromosome", "Nucleus", "Cell"], ["Cell", "Nucleus", "Chromosome", "Gene"], "A cell contains a nucleus, which contains chromosomes made of many genes."),
    tf("mutation", 3, "Mutations are always harmful to an organism.", false, "Many are neutral and some are beneficial; they are the source of new variation."),
    mcq("terms", 3, "Blood group AB is an example of:", ["Co-dominance", "Complete dominance", "Sex linkage", "Mutation"], 0, "Both A and B alleles are fully expressed."),
  ],
  templates: [],
};

export const evolution: SeedTopic = {
  code: "f4-bio-evolution",
  subject: "BIO-S",
  grade: "form4",
  nameSw: "Mageuzi",
  nameEn: "Evolution",
  syllabusRef: "Biology Form IV — Evolution",
  language: "en",
  lessons: [
    {
      title: "What is evolution?",
      body: "Evolution is the gradual change in the inherited characteristics of populations over many generations. Evidence includes fossils, comparative anatomy, embryology and molecular biology.",
      example: "Olduvai Gorge in Tanzania holds fossils of early humans.",
    },
    {
      title: "Natural selection",
      body: "Darwin's theory: individuals vary; more are born than can survive; those best adapted survive and reproduce; their favourable traits become more common over generations.",
    },
    {
      title: "Homologous vs analogous",
      body: "Homologous structures share a basic plan but have different functions (human arm, bat wing) — evidence of common ancestry. Analogous structures do the same job but evolved separately (bird and insect wings).",
    },
  ],
  questions: [
    mcq("theories", 1, "The theory of evolution by natural selection was proposed by:", ["Charles Darwin", "Gregor Mendel", "Isaac Newton", "Robert Brown"], 0, "Darwin published On the Origin of Species in 1859."),
    mcq("evidence", 1, "Preserved remains or traces of ancient organisms in rocks are called:", ["Fossils", "Cells", "Spores", "Minerals"], 0, "Fossils are key evidence for evolution."),
    tf("theories", 1, "Evolution is the gradual change in living organisms over many generations.", true, "Change happens to populations, over long periods."),
    mcq("evidence", 1, "Olduvai Gorge, a famous site for fossils of early humans, is found in:", ["Tanzania", "Egypt", "South Africa", "Ethiopia"], 0, "It lies in northern Tanzania near Ngorongoro."),
    mcq("terms", 1, "Organisms that can interbreed and produce fertile offspring belong to the same:", ["Species", "Genus", "Family", "Kingdom"], 0, "That is the biological definition of a species."),
    mcq("theories", 2, "Lamarck's theory is based on the:", ["Inheritance of acquired characteristics", "Survival of the fittest", "Random mutation", "Fossil record"], 0, "Lamarck thought traits gained in life were passed on."),
    mcq("evidence", 2, "Structures with the same basic plan but different functions, like a human arm and a bat's wing, are called:", ["Homologous structures", "Analogous structures", "Vestigial structures", "Fossils"], 0, "They point to a common ancestor."),
    tf("evidence", 2, "The wings of a bird and the wings of an insect are homologous structures.", false, "They are analogous: same function, different origin."),
    mcq("evidence", 2, "Which is an example of a vestigial structure in humans?", ["Appendix", "Heart", "Lungs", "Femur"], 0, "The appendix has little or no function in humans."),
    mcq("selection", 2, "Bacteria becoming resistant to antibiotics is an example of:", ["Natural selection", "Inheritance of acquired characteristics", "Spontaneous generation", "Photosynthesis"], 0, "Resistant bacteria survive and multiply."),
    mcq("evidence", 2, "Which evidence of evolution compares the early development of different vertebrates?", ["Comparative embryology", "Palaeontology", "Biogeography", "Ecology"], 0, "Vertebrate embryos look strikingly similar early on."),
    mcq("selection", 3, "According to Darwin, which individuals are most likely to survive and reproduce?", ["Those best adapted to their environment", "The largest", "The oldest", "Those that eat the most"], 0, "\"Fittest\" means best adapted, not strongest."),
    mcq("selection", 3, "The original source of new variation in a population is:", ["Mutation", "Natural selection", "Fossilisation", "Competition"], 0, "Selection acts on variation that mutation creates."),
    order("selection", 3, "Arrange the steps of natural selection in order.", ["Better adapted individuals survive and reproduce", "Variation exists in a population", "Favourable traits become common over generations", "Competition for limited resources"], ["Variation exists in a population", "Competition for limited resources", "Better adapted individuals survive and reproduce", "Favourable traits become common over generations"], "Variation → competition → survival of the fittest → change over generations."),
    tf("evidence", 3, "Analogous structures are evidence that two organisms share a recent common ancestor.", false, "Homologous structures suggest common ancestry; analogous ones show convergent evolution."),
  ],
  templates: [],
};

export const form4Topics = [sequences, solids, genetics, evolution];
