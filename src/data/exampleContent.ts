// Default topic lists and example cards.
// This file is the source of truth: supabase/migrations/*_seed_content.sql is generated from it
// (run `node scripts/generate-seed-sql.ts` after any edit), and demo mode reads it directly.
//
// Topics follow the Pearson Edexcel International A Level units, in the order a student
// usually meets them. Names are unique per subject (ignoring case) and at most 80 characters.
// `unit` is the unit a topic belongs to, or null when it runs through several units.
//
// Example cards are recall questions (define, state, describe, explain) in original wording.
// Each card's topic must match one of that subject's default topic names exactly.

import type { KeyPoint, SubjectCode } from '../lib/types'

export interface DefaultTopic {
  name: string
  /** Optional exam unit, e.g. "P1", "WPH11". */
  unit: string | null
}

export interface ExampleCard {
  subject: SubjectCode
  /** Must match a DEFAULT_TOPICS name for the same subject. */
  topic: string
  question: string
  key_points: KeyPoint[]
}

export const DEFAULT_TOPICS: Record<SubjectCode, DefaultTopic[]> = {
  // Mathematics: Pure P1–P4, Mechanics M1–M2, Statistics S1–S2, Decision D1.
  // (M3 and S3 can't count towards IAL Mathematics, so they live under Further Maths.)
  maths: [
    { name: 'Algebra and functions', unit: null },
    { name: 'Coordinate geometry', unit: null },
    { name: 'Trigonometry', unit: null },
    { name: 'Differentiation', unit: null },
    { name: 'Integration', unit: null },
    { name: 'Proof', unit: null },
    { name: 'Sequences and series', unit: 'P2' },
    { name: 'Binomial expansion', unit: null },
    { name: 'Exponentials and logarithms', unit: null },
    { name: 'Numerical methods', unit: 'P3' },
    { name: 'Parametric equations', unit: 'P4' },
    { name: 'Vectors', unit: 'P4' },
    { name: 'Modelling in mechanics', unit: 'M1' },
    { name: 'Kinematics', unit: null },
    { name: "Forces and Newton's laws", unit: 'M1' },
    { name: 'Statics of a particle', unit: 'M1' },
    // M1 moments, and the rods and ladders of M2's statics of rigid bodies.
    { name: 'Moments', unit: null },
    { name: 'Momentum and impulse', unit: null },
    { name: 'Projectiles', unit: 'M2' },
    { name: 'Work, energy and power', unit: 'M2' },
    { name: 'Centres of mass', unit: 'M2' },
    { name: 'Data presentation', unit: 'S1' },
    { name: 'Probability', unit: 'S1' },
    { name: 'Correlation and regression', unit: 'S1' },
    { name: 'Discrete random variables', unit: 'S1' },
    { name: 'The normal distribution', unit: 'S1' },
    { name: 'The binomial and Poisson distributions', unit: 'S2' },
    { name: 'Continuous random variables', unit: 'S2' },
    { name: 'Hypothesis testing', unit: 'S2' },
    { name: 'Algorithms', unit: 'D1' },
    { name: 'Graphs and networks', unit: 'D1' },
    { name: 'Route inspection', unit: 'D1' },
    { name: 'Critical path analysis', unit: 'D1' },
    { name: 'Linear programming', unit: 'D1' },
  ],

  // Further Mathematics: FP1–FP3, plus the Further Mechanics (M3) and Further Statistics (S3)
  // options. M2, S2 and D1 can count towards either qualification; their topics are under Maths.
  further_maths: [
    { name: 'Complex numbers', unit: 'FP1' },
    { name: 'Roots of polynomials', unit: 'FP1' },
    { name: 'Numerical methods', unit: 'FP1' },
    { name: 'Coordinate systems', unit: 'FP1' },
    { name: 'Matrices', unit: 'FP1' },
    { name: 'Transformations using matrices', unit: 'FP1' },
    { name: 'Series', unit: null },
    { name: 'Proof by induction', unit: 'FP1' },
    { name: 'Inequalities', unit: 'FP2' },
    { name: 'Further complex numbers', unit: 'FP2' },
    { name: 'Differential equations', unit: 'FP2' },
    { name: 'Maclaurin and Taylor series', unit: 'FP2' },
    { name: 'Polar coordinates', unit: 'FP2' },
    { name: 'Hyperbolic functions', unit: 'FP3' },
    { name: 'Further coordinate systems', unit: 'FP3' },
    { name: 'Further integration', unit: 'FP3' },
    { name: 'Further vectors', unit: 'FP3' },
    { name: 'Further matrices', unit: 'FP3' },
    { name: 'Further kinematics', unit: 'M3' },
    { name: 'Elastic strings and springs', unit: 'M3' },
    { name: 'Further dynamics', unit: 'M3' },
    { name: 'Simple harmonic motion', unit: 'M3' },
    { name: 'Circular motion', unit: 'M3' },
    { name: 'Statics of rigid bodies', unit: 'M3' },
    { name: 'Combinations of random variables', unit: 'S3' },
    { name: 'Sampling methods', unit: 'S3' },
    { name: 'Estimation and confidence intervals', unit: 'S3' },
    { name: 'Chi-squared tests', unit: 'S3' },
    { name: "Spearman's rank correlation", unit: 'S3' },
  ],

  // Physics: WPH11 Mechanics and Materials, WPH12 Waves and Electricity, WPH14 Further
  // Mechanics, Fields and Particles, WPH15 Thermodynamics, Radiation, Oscillations and Cosmology.
  // The practical units (WPH13, WPH16) share one topic.
  physics: [
    { name: 'Motion and forces', unit: 'WPH11' },
    { name: 'Momentum', unit: null },
    { name: 'Work, energy and power', unit: 'WPH11' },
    { name: 'Fluids and viscosity', unit: 'WPH11' },
    { name: 'Properties of materials', unit: 'WPH11' },
    { name: 'Waves and superposition', unit: 'WPH12' },
    { name: 'Refraction and polarisation', unit: 'WPH12' },
    { name: 'Particle nature of light', unit: 'WPH12' },
    { name: 'Electric circuits', unit: 'WPH12' },
    { name: 'Resistivity and conduction', unit: 'WPH12' },
    { name: 'Circular motion', unit: 'WPH14' },
    { name: 'Electric fields', unit: 'WPH14' },
    { name: 'Capacitors', unit: 'WPH14' },
    { name: 'Magnetic fields and induction', unit: 'WPH14' },
    { name: 'Particle physics', unit: 'WPH14' },
    { name: 'Thermal physics', unit: 'WPH15' },
    { name: 'Ideal gases', unit: 'WPH15' },
    { name: 'Nuclear decay', unit: 'WPH15' },
    { name: 'Binding energy, fission and fusion', unit: 'WPH15' },
    { name: 'Gravitational fields', unit: 'WPH15' },
    { name: 'Oscillations', unit: 'WPH15' },
    { name: 'Astrophysics and cosmology', unit: 'WPH15' },
    { name: 'Practical skills', unit: null },
  ],

  // Computer Science: theory first (computational thinking, data, computers, networks,
  // impacts), then problem solving and programming.
  computer_science: [
    { name: 'Computational thinking', unit: null },
    { name: 'Searching and sorting algorithms', unit: null },
    { name: 'Algorithm efficiency', unit: null },
    { name: 'Number systems', unit: null },
    { name: 'Binary arithmetic', unit: null },
    { name: 'Representing characters', unit: null },
    { name: 'Representing images', unit: null },
    { name: 'Representing sound', unit: null },
    { name: 'Data compression', unit: null },
    { name: 'Encryption', unit: null },
    { name: 'Databases', unit: null },
    { name: 'Logic and Boolean algebra', unit: null },
    { name: 'Computer architecture', unit: null },
    { name: 'Memory and storage', unit: null },
    { name: 'Operating systems', unit: null },
    { name: 'Languages and translators', unit: null },
    { name: 'Networks and protocols', unit: null },
    { name: 'The internet and the web', unit: null },
    { name: 'Cyber security', unit: null },
    { name: 'Ethical, legal and environmental impacts', unit: null },
    { name: 'Programming fundamentals', unit: null },
    { name: 'Data structures', unit: null },
    { name: 'Software development and testing', unit: null },
  ],
}

export const EXAMPLE_CARDS: ExampleCard[] = [
  // ---------------------------------------------------------------------------------------
  // Maths
  // ---------------------------------------------------------------------------------------
  {
    subject: 'maths',
    topic: 'Modelling in mechanics',
    question:
      "A block on a horizontal table is joined to a hanging ball by a string that passes over a pulley at the table's edge. The block is modelled as a particle, the string as light and inextensible, and the table as smooth. Explain what each of these four assumptions means.",
    key_points: [
      {
        id: 'kp_ex_ma1_a',
        point:
          'Modelling the block as a particle means its dimensions are negligible, so all of its mass acts at a single point.',
        accept: [
          "the block's size can be ignored",
          'the mass of the block is concentrated at one point',
          'the block has mass but no dimensions',
        ],
        reject: ['the block is small', 'the block has no mass', 'the weight of the block can be ignored'],
      },
      {
        id: 'kp_ex_ma1_b',
        point:
          'Modelling the string as light means its mass is negligible, so the tension is the same throughout the string.',
        accept: [
          'the string has no mass',
          'the weight of the string can be ignored',
          'the tension is the same all the way along the string',
        ],
        reject: ['the string does not stretch', 'the string is thin'],
      },
      {
        id: 'kp_ex_ma1_c',
        point:
          'Modelling the string as inextensible means it does not stretch, so the block and the ball always have the same magnitude of acceleration.',
        accept: [
          "the string's length stays the same",
          'the string cannot stretch, so both objects accelerate at the same rate',
          'the block and the ball move with the same speed and acceleration',
        ],
        reject: ['the string has no mass', 'the string will not break', 'the string is taut'],
      },
      {
        id: 'kp_ex_ma1_d',
        point: 'Modelling the table as smooth means there is no friction between the block and the table.',
        accept: ['the table is frictionless', 'friction can be ignored', 'the coefficient of friction is zero'],
        reject: ['the table is flat', 'the table is level', 'there is no air resistance'],
      },
    ],
  },
  {
    subject: 'maths',
    topic: 'The binomial and Poisson distributions',
    question:
      'The number of seeds that germinate in a tray of 20 is modelled by X ~ B(20, p). State the four conditions needed for a binomial distribution to be a suitable model.',
    key_points: [
      {
        id: 'kp_ex_ma2_a',
        point: 'There is a fixed number of trials: the 20 seeds in the tray.',
        accept: ['n is fixed at 20', 'a fixed number of seeds is planted'],
        reject: ['there is a large number of trials', 'the trials are repeated until a seed germinates'],
      },
      {
        id: 'kp_ex_ma2_b',
        point: 'Each trial has exactly two possible outcomes: a seed either germinates or it does not.',
        accept: ['each seed germinates or fails to germinate', 'every trial ends in success or failure'],
        reject: ['the two outcomes are equally likely', 'each seed has a 50% chance of germinating'],
      },
      {
        id: 'kp_ex_ma2_c',
        point:
          'The trials are independent: whether one seed germinates does not affect whether any other seed germinates.',
        accept: ['the seeds germinate independently of each other', 'the outcome of one trial does not affect another'],
        reject: ['the seeds are chosen at random', 'the trials are random', 'the trials are fair'],
      },
      {
        id: 'kp_ex_ma2_d',
        point:
          'The probability of success, p, is the same for every trial: each seed has the same probability of germinating.',
        accept: ['p is constant', 'every seed has an equal chance of germinating'],
        reject: ['p = 0.5', 'the probability is known', 'each outcome is equally likely'],
      },
    ],
  },
  {
    subject: 'maths',
    topic: 'Hypothesis testing',
    question: 'In a hypothesis test, define the critical region, the critical value and the actual significance level.',
    key_points: [
      {
        id: 'kp_ex_ma3_a',
        point:
          'The critical region is the set of values of the test statistic for which the null hypothesis, H₀, is rejected.',
        accept: [
          'the range of values of X that would lead to H₀ being rejected',
          'the values of the test statistic that give a significant result',
        ],
        reject: [
          'the range of values of the parameter p',
          'the values for which H₀ is accepted',
          'the values that prove H₁ is true',
        ],
      },
      {
        id: 'kp_ex_ma3_b',
        point:
          'The critical value is the boundary of the critical region: the first value of the test statistic that lies inside it.',
        accept: [
          'the value on the edge of the critical region, included in it',
          'the least extreme value that still leads to H₀ being rejected',
        ],
        reject: [
          'the last value outside the critical region',
          'the critical value is the significance level',
          'the value of p stated in H₀',
        ],
      },
      {
        id: 'kp_ex_ma3_c',
        point:
          'The actual significance level is the probability that the test statistic lies in the critical region when H₀ is true.',
        accept: [
          'P(test statistic in the critical region | H₀ true)',
          'the probability of incorrectly rejecting H₀',
          'the probability of a Type I error',
        ],
        reject: [
          'the significance level stated in the question',
          'the probability that H₀ is true',
          'the probability that the result is wrong',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------------------
  // Further Maths
  // ---------------------------------------------------------------------------------------
  {
    subject: 'further_maths',
    topic: 'Matrices',
    question:
      'Explain what is meant by a singular matrix, and describe the effect of the transformation that it represents.',
    key_points: [
      {
        id: 'kp_ex_fm1_a',
        point: 'A singular matrix is a square matrix whose determinant is zero.',
        accept: ['det M = 0', 'a matrix M with |M| = 0'],
        reject: ['a matrix with a determinant of 1', 'a 1 × 1 matrix', 'a matrix containing a zero'],
      },
      {
        id: 'kp_ex_fm1_b',
        point: 'A singular matrix has no inverse.',
        accept: ['M⁻¹ does not exist', 'it cannot be inverted'],
        reject: ['its inverse is the zero matrix', 'it is its own inverse'],
      },
      {
        id: 'kp_ex_fm1_c',
        point:
          'The transformation has an area scale factor of zero: it collapses the whole plane onto a line or a single point.',
        accept: [
          'every shape is mapped to an image with zero area',
          'the plane is squashed onto a line through the origin, or onto the origin itself',
          'in 3D, the volume scale factor is zero and space collapses onto a plane, a line or a point',
        ],
        reject: ['the shape is reflected', 'the area of the shape is unchanged', 'the shape is mapped onto itself'],
      },
      {
        id: 'kp_ex_fm1_d',
        point: 'Different points are mapped to the same image, so the transformation cannot be reversed.',
        accept: ['the transformation is many-to-one', 'there is no transformation that undoes it'],
        reject: ['the transformation is its own inverse', 'the image cannot be drawn'],
      },
    ],
  },
  {
    subject: 'further_maths',
    topic: 'Proof by induction',
    question:
      'Describe the four stages of a proof by mathematical induction that a statement is true for all positive integers n.',
    key_points: [
      {
        id: 'kp_ex_fm2_a',
        point: 'Basis: show that the statement is true for the first value, n = 1.',
        accept: ['base case: check that P(1) is true', 'prove that the result holds when n = 1'],
        reject: ['check that it works for n = 1, 2 and 3, so it is always true', 'assume it is true for n = 1'],
      },
      {
        id: 'kp_ex_fm2_b',
        point: 'Assumption: assume that the statement is true for n = k, for some positive integer k.',
        accept: ['inductive hypothesis: suppose that P(k) is true', 'assume the result holds when n = k'],
        reject: ['assume it is true for all n', 'let n = k'],
      },
      {
        id: 'kp_ex_fm2_c',
        point: 'Inductive step: use the assumption to show that the statement is then true for n = k + 1.',
        accept: [
          'show that P(k) being true implies that P(k + 1) is true',
          'prove that if it holds for n = k then it holds for n = k + 1',
        ],
        reject: ['substitute n = k + 1 into the result to be proved', 'check the statement for one more value of n'],
      },
      {
        id: 'kp_ex_fm2_d',
        point:
          'Conclusion: it is true for n = 1, and if it is true for n = k then it is true for n = k + 1, so it is true for all positive integers n.',
        accept: [
          'a concluding statement that refers to both the basis and the inductive step',
          'so, by mathematical induction, it is true for all positive integers n',
        ],
        reject: ['therefore it is true', 'QED', 'so it is true for n = k + 1'],
      },
    ],
  },
  {
    subject: 'further_maths',
    topic: 'Complex numbers',
    question:
      'A polynomial equation f(z) = 0 has real coefficients. Explain why any non-real roots must occur in complex conjugate pairs.',
    key_points: [
      {
        id: 'kp_ex_fm3_a',
        point:
          'If α is a root then f(α) = 0, and taking the complex conjugate of both sides gives (f(α))* = 0, because the conjugate of 0 is 0.',
        accept: ['conjugate both sides of f(α) = 0', '(f(α))* = 0* = 0'],
        reject: ['take the modulus of both sides', 'replace α with −α'],
      },
      {
        id: 'kp_ex_fm3_b',
        point:
          'Conjugation works term by term: the conjugate of a sum is the sum of the conjugates and the conjugate of a product is the product of the conjugates, so (aαⁿ)* = a*(α*)ⁿ.',
        accept: ['(z + w)* = z* + w* and (zw)* = z*w*', '(αⁿ)* = (α*)ⁿ'],
        reject: ['(αⁿ)* = −αⁿ', 'the conjugate of αⁿ is αⁿ'],
      },
      {
        id: 'kp_ex_fm3_c',
        point: 'The coefficients are real, so each one equals its own conjugate (a* = a), which gives (f(α))* = f(α*).',
        accept: ['real numbers are unchanged by conjugation', 'because a* = a for real a, the conjugate of f(α) is f(α*)'],
        reject: ['the coefficients are conjugates of each other', 'the coefficients are all positive'],
      },
      {
        id: 'kp_ex_fm3_d',
        point: 'So f(α*) = 0: α* is also a root, and it is different from α because α is not real.',
        accept: ['α* also satisfies the equation', 'the roots come as a pair, α and α*'],
        reject: ['−α is also a root', '1/α is also a root', 'the roots are always ±α'],
      },
    ],
  },

  // ---------------------------------------------------------------------------------------
  // Physics
  // ---------------------------------------------------------------------------------------
  {
    subject: 'physics',
    topic: 'Fluids and viscosity',
    question:
      'A small steel ball is released from rest at the top of a tall tube of oil. Explain why it reaches a terminal velocity.',
    key_points: [
      {
        id: 'kp_ex_ph1_a',
        point:
          "At first the ball's weight is greater than the upthrust plus the viscous drag, so there is a resultant downward force and the ball accelerates.",
        accept: ['initially W > U + F, so it accelerates downwards', 'at the start the resultant force is downwards'],
        reject: ['gravity is stronger than the oil', 'it accelerates because it is heavy'],
      },
      {
        id: 'kp_ex_ph1_b',
        point: "As the ball's speed increases, the viscous drag on it increases.",
        accept: ['drag increases with velocity', 'the faster it falls, the larger the viscous force'],
        reject: [
          'air resistance increases',
          'the drag increases as the ball falls further',
          'the drag gets bigger, with no link to speed',
        ],
      },
      {
        id: 'kp_ex_ph1_c',
        point: 'So the resultant force on the ball decreases, and therefore its acceleration decreases.',
        accept: ['the net force gets smaller, so the acceleration falls', "the ball's acceleration decreases"],
        reject: ['the ball slows down', 'the velocity decreases'],
      },
      {
        id: 'kp_ex_ph1_d',
        point:
          'Terminal velocity is reached when weight = upthrust + viscous drag: the resultant force is zero, so the acceleration is zero and the velocity is constant.',
        accept: [
          'W = U + F, so there is no resultant force and the speed is constant',
          'the forces balance, so the ball moves at a constant velocity',
        ],
        reject: [
          'drag equals weight, with upthrust ignored',
          'the forces balance, so the ball stops',
          'gravity stops acting on the ball',
        ],
      },
    ],
  },
  {
    subject: 'physics',
    topic: 'Particle nature of light',
    question:
      'Light below a certain frequency releases no electrons from a metal surface, however intense the light is. Using the photon model of light, explain why.',
    key_points: [
      {
        id: 'kp_ex_ph2_a',
        point: 'Light consists of photons, each with energy E = hf, which depends only on the frequency of the light.',
        accept: ['the energy of a photon is proportional to its frequency', 'each photon carries energy hf'],
        reject: ['the energy of light depends on its intensity', 'energy from the wave builds up over time'],
      },
      {
        id: 'kp_ex_ph2_b',
        point: 'Each electron absorbs the energy of a single photon: it is a one-to-one interaction.',
        accept: ['one photon is absorbed by one electron', 'an electron cannot combine the energy of several photons'],
        reject: [
          'electrons absorb energy gradually until they have enough',
          'an electron absorbs many photons at once',
        ],
      },
      {
        id: 'kp_ex_ph2_c',
        point:
          'To escape, an electron needs at least the work function, φ: the minimum energy required to remove an electron from the surface of the metal.',
        accept: [
          'the work function is the minimum energy needed to release an electron from the surface',
          'the electron must gain at least φ to leave the metal',
        ],
        reject: [
          'the work function is the energy the electron already has',
          'the electron needs the ionisation energy',
          'the threshold frequency is the energy needed',
        ],
      },
      {
        id: 'kp_ex_ph2_d',
        point:
          'Below the threshold frequency, hf < φ, so no single photon gives an electron enough energy to escape; more intense light only delivers more photons per second, each with too little energy.',
        accept: [
          'the photon energy is less than the work function',
          'increasing the intensity increases the number of photons, not the energy of each photon',
        ],
        reject: [
          'the light is not bright enough',
          'the electrons do not have enough time to absorb energy',
          'brighter light gives each photon more energy',
        ],
      },
    ],
  },
  {
    subject: 'physics',
    topic: 'Magnetic fields and induction',
    question: "State Faraday's law and Lenz's law of electromagnetic induction.",
    key_points: [
      {
        id: 'kp_ex_ph3_a',
        point:
          "Faraday's law: the magnitude of the induced e.m.f. is directly proportional to the rate of change of magnetic flux linkage.",
        accept: [
          'induced e.m.f. ∝ rate of change of flux linkage',
          'ε = −d(NΦ)/dt, with each symbol defined',
          'the e.m.f. is proportional to the rate at which magnetic flux is cut',
        ],
        reject: [
          'the e.m.f. is proportional to the change in flux',
          'the e.m.f. is proportional to the magnetic flux',
          'the induced current is proportional to the rate of change of flux',
        ],
      },
      {
        id: 'kp_ex_ph3_b',
        point:
          "Lenz's law: the direction of the induced e.m.f. (or current) is such that it opposes the change that produces it.",
        accept: [
          'the induced current sets up a magnetic field that opposes the change in flux linkage',
          'the induced e.m.f. acts to oppose the change causing it',
        ],
        reject: [
          'the induced current opposes the magnetic field',
          'the induced e.m.f. opposes the flux',
          'the induced current flows the opposite way to the field',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------------------
  // Computer Science
  // ---------------------------------------------------------------------------------------
  {
    subject: 'computer_science',
    topic: 'Data compression',
    question: 'Compare lossy and lossless compression, and state when lossless compression must be used.',
    key_points: [
      {
        id: 'kp_ex_cs1_a',
        point: 'Lossy compression permanently removes some data, so the original file cannot be reconstructed exactly.',
        accept: ['data is discarded and cannot be recovered', 'some detail is lost for good when the file is compressed'],
        reject: [
          'lossy compression only removes repeated data',
          'a lossy file can be decompressed back to the original',
          'lossy compression loses the whole file',
        ],
      },
      {
        id: 'kp_ex_cs1_b',
        point:
          'Lossless compression reduces the file size without losing any data, so the original can be reconstructed exactly.',
        accept: [
          'no data is lost, so decompressing gives an identical copy',
          'it encodes patterns or repetition, for example with run-length encoding, so the original is fully restored',
        ],
        reject: [
          'lossless compression does not reduce the file size',
          'lossless compression keeps the quality high',
          'lossless compression removes data the user will not notice',
        ],
      },
      {
        id: 'kp_ex_cs1_c',
        point:
          'Lossy compression usually gives a much smaller file, so it suits images, audio and video, where a small loss of quality is acceptable.',
        accept: [
          'lossy achieves a greater reduction in file size',
          'lossy is used for streaming music or video because the loss is hard to notice',
        ],
        reject: ['lossy is always better', 'lossy is used for text documents'],
      },
      {
        id: 'kp_ex_cs1_d',
        point:
          'Lossless compression must be used when the decompressed data has to be identical to the original, such as text, program code or executable files.',
        accept: [
          'for source code, spreadsheets or documents, where every bit must be kept',
          'when losing any data would change the meaning or stop the file working',
        ],
        reject: ['for large files', 'for photos, to save space'],
      },
    ],
  },
  {
    subject: 'computer_science',
    topic: 'Computer architecture',
    question: 'Describe what happens during each stage of the fetch–decode–execute cycle.',
    key_points: [
      {
        id: 'kp_ex_cs2_a',
        point: 'The address held in the program counter (PC) is copied into the memory address register (MAR).',
        accept: [
          'the PC holds the address of the next instruction, which is sent to the MAR',
          'the address of the next instruction is put on the address bus',
        ],
        reject: ['the PC holds the next instruction itself', 'the address is copied into the MDR'],
      },
      {
        id: 'kp_ex_cs2_b',
        point:
          'The instruction stored at that address in main memory is copied into the memory data register (MDR) and then into the current instruction register (CIR).',
        accept: [
          'the instruction is fetched from RAM along the data bus into the MDR, then the CIR',
          'the instruction is loaded into the CIR',
        ],
        reject: ['the instruction is fetched from the hard disk', 'the instruction is stored in the MAR'],
      },
      {
        id: 'kp_ex_cs2_c',
        point: 'The program counter is incremented so that it holds the address of the next instruction.',
        accept: ['the PC increases by one', 'the PC is updated to point to the next instruction'],
        reject: ['the MAR is incremented', 'the PC is reset to zero'],
      },
      {
        id: 'kp_ex_cs2_d',
        point:
          'The control unit decodes the instruction in the CIR to identify the operation (opcode) and the data or address it uses (operand).',
        accept: ['the control unit works out what the instruction means', 'the instruction is split into its opcode and operand'],
        reject: ['the ALU decodes the instruction', 'the compiler decodes the instruction'],
      },
      {
        id: 'kp_ex_cs2_e',
        point:
          'The instruction is executed: the control unit sends signals so that, for example, the ALU performs a calculation or data is moved between memory and registers. Then the cycle repeats.',
        accept: [
          'the instruction is carried out, with any result stored in the accumulator or memory',
          'the operation is performed and the next cycle begins',
        ],
        reject: ['the whole program is run', 'the instruction is sent back to memory'],
      },
    ],
  },
  {
    subject: 'computer_science',
    topic: 'Data structures',
    question: 'Describe the characteristics of a stack, including how items are added to it and removed from it.',
    key_points: [
      {
        id: 'kp_ex_cs3_a',
        point: 'A stack is a last in, first out (LIFO) structure: the most recently added item is the first to be removed.',
        accept: ['LIFO', 'the last item pushed is the first item popped'],
        reject: ['FIFO', 'first in, first out', 'items are removed in the order they were added'],
      },
      {
        id: 'kp_ex_cs3_b',
        point: 'Items are added (pushed) and removed (popped) at one end only, called the top.',
        accept: [
          'push adds an item to the top and pop removes the item at the top',
          'only the top of the stack can be accessed',
        ],
        reject: ['items are added at the back and removed from the front', 'any item can be accessed directly'],
      },
      {
        id: 'kp_ex_cs3_c',
        point: 'A stack pointer keeps track of the top of the stack, changing with every push and pop.',
        accept: [
          'a top pointer stores the index of the top item',
          'the pointer is incremented on a push and decremented on a pop',
        ],
        reject: ['front and rear pointers are used', 'the pointer always points to the first item added'],
      },
      {
        id: 'kp_ex_cs3_d',
        point:
          'Popping from an empty stack causes underflow and pushing onto a full stack causes overflow, so both conditions must be checked.',
        accept: [
          'check that the stack is not empty before popping and not full before pushing',
          'underflow when empty, overflow when full',
        ],
        reject: ['overflow happens when the stack is empty', 'underflow happens when the stack is full'],
      },
    ],
  },
]
