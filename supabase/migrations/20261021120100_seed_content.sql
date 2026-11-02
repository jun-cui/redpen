-- Redpen: default topic lists and example cards
--
-- GENERATED FILE. Do not edit by hand: the content lives in src/data/exampleContent.ts.
-- Change it there, then run `node scripts/generate-seed-sql.ts` to rebuild this migration.
--
--   public.seed_default_topics(uuid)  copies the default topic lists to a user. Called by
--                                     public.handle_new_user() when an account is created.
--   public.add_example_cards()        adds the example cards for the signed-in user, once.

-- ---------------------------------------------------------------------------
-- Default topics (34 maths, 29 further_maths, 23 physics, 23 computer_science)
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_topics(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'A user id is required' using errcode = '22004';
  end if;

  -- Idempotent: a topic the user already has (same subject and name) is left as it is.
  insert into public.topics (user_id, subject, name, unit, position)
  select p_user_id, d.subject::public.subject_code, d.name, d.unit, d.position
  from (
    values
      ('maths', 'Algebra and functions', null, 0),
      ('maths', 'Coordinate geometry', null, 1),
      ('maths', 'Trigonometry', null, 2),
      ('maths', 'Differentiation', null, 3),
      ('maths', 'Integration', null, 4),
      ('maths', 'Proof', null, 5),
      ('maths', 'Sequences and series', 'P2', 6),
      ('maths', 'Binomial expansion', null, 7),
      ('maths', 'Exponentials and logarithms', null, 8),
      ('maths', 'Numerical methods', 'P3', 9),
      ('maths', 'Parametric equations', 'P4', 10),
      ('maths', 'Vectors', 'P4', 11),
      ('maths', 'Modelling in mechanics', 'M1', 12),
      ('maths', 'Kinematics', null, 13),
      ('maths', 'Forces and Newton''s laws', 'M1', 14),
      ('maths', 'Statics of a particle', 'M1', 15),
      ('maths', 'Moments', null, 16),
      ('maths', 'Momentum and impulse', null, 17),
      ('maths', 'Projectiles', 'M2', 18),
      ('maths', 'Work, energy and power', 'M2', 19),
      ('maths', 'Centres of mass', 'M2', 20),
      ('maths', 'Data presentation', 'S1', 21),
      ('maths', 'Probability', 'S1', 22),
      ('maths', 'Correlation and regression', 'S1', 23),
      ('maths', 'Discrete random variables', 'S1', 24),
      ('maths', 'The normal distribution', 'S1', 25),
      ('maths', 'The binomial and Poisson distributions', 'S2', 26),
      ('maths', 'Continuous random variables', 'S2', 27),
      ('maths', 'Hypothesis testing', 'S2', 28),
      ('maths', 'Algorithms', 'D1', 29),
      ('maths', 'Graphs and networks', 'D1', 30),
      ('maths', 'Route inspection', 'D1', 31),
      ('maths', 'Critical path analysis', 'D1', 32),
      ('maths', 'Linear programming', 'D1', 33),
      ('further_maths', 'Complex numbers', 'FP1', 0),
      ('further_maths', 'Roots of polynomials', 'FP1', 1),
      ('further_maths', 'Numerical methods', 'FP1', 2),
      ('further_maths', 'Coordinate systems', 'FP1', 3),
      ('further_maths', 'Matrices', 'FP1', 4),
      ('further_maths', 'Transformations using matrices', 'FP1', 5),
      ('further_maths', 'Series', null, 6),
      ('further_maths', 'Proof by induction', 'FP1', 7),
      ('further_maths', 'Inequalities', 'FP2', 8),
      ('further_maths', 'Further complex numbers', 'FP2', 9),
      ('further_maths', 'Differential equations', 'FP2', 10),
      ('further_maths', 'Maclaurin and Taylor series', 'FP2', 11),
      ('further_maths', 'Polar coordinates', 'FP2', 12),
      ('further_maths', 'Hyperbolic functions', 'FP3', 13),
      ('further_maths', 'Further coordinate systems', 'FP3', 14),
      ('further_maths', 'Further integration', 'FP3', 15),
      ('further_maths', 'Further vectors', 'FP3', 16),
      ('further_maths', 'Further matrices', 'FP3', 17),
      ('further_maths', 'Further kinematics', 'M3', 18),
      ('further_maths', 'Elastic strings and springs', 'M3', 19),
      ('further_maths', 'Further dynamics', 'M3', 20),
      ('further_maths', 'Simple harmonic motion', 'M3', 21),
      ('further_maths', 'Circular motion', 'M3', 22),
      ('further_maths', 'Statics of rigid bodies', 'M3', 23),
      ('further_maths', 'Combinations of random variables', 'S3', 24),
      ('further_maths', 'Sampling methods', 'S3', 25),
      ('further_maths', 'Estimation and confidence intervals', 'S3', 26),
      ('further_maths', 'Chi-squared tests', 'S3', 27),
      ('further_maths', 'Spearman''s rank correlation', 'S3', 28),
      ('physics', 'Motion and forces', 'WPH11', 0),
      ('physics', 'Momentum', null, 1),
      ('physics', 'Work, energy and power', 'WPH11', 2),
      ('physics', 'Fluids and viscosity', 'WPH11', 3),
      ('physics', 'Properties of materials', 'WPH11', 4),
      ('physics', 'Waves and superposition', 'WPH12', 5),
      ('physics', 'Refraction and polarisation', 'WPH12', 6),
      ('physics', 'Particle nature of light', 'WPH12', 7),
      ('physics', 'Electric circuits', 'WPH12', 8),
      ('physics', 'Resistivity and conduction', 'WPH12', 9),
      ('physics', 'Circular motion', 'WPH14', 10),
      ('physics', 'Electric fields', 'WPH14', 11),
      ('physics', 'Capacitors', 'WPH14', 12),
      ('physics', 'Magnetic fields and induction', 'WPH14', 13),
      ('physics', 'Particle physics', 'WPH14', 14),
      ('physics', 'Thermal physics', 'WPH15', 15),
      ('physics', 'Ideal gases', 'WPH15', 16),
      ('physics', 'Nuclear decay', 'WPH15', 17),
      ('physics', 'Binding energy, fission and fusion', 'WPH15', 18),
      ('physics', 'Gravitational fields', 'WPH15', 19),
      ('physics', 'Oscillations', 'WPH15', 20),
      ('physics', 'Astrophysics and cosmology', 'WPH15', 21),
      ('physics', 'Practical skills', null, 22),
      ('computer_science', 'Computational thinking', null, 0),
      ('computer_science', 'Searching and sorting algorithms', null, 1),
      ('computer_science', 'Algorithm efficiency', null, 2),
      ('computer_science', 'Number systems', null, 3),
      ('computer_science', 'Binary arithmetic', null, 4),
      ('computer_science', 'Representing characters', null, 5),
      ('computer_science', 'Representing images', null, 6),
      ('computer_science', 'Representing sound', null, 7),
      ('computer_science', 'Data compression', null, 8),
      ('computer_science', 'Encryption', null, 9),
      ('computer_science', 'Databases', null, 10),
      ('computer_science', 'Logic and Boolean algebra', null, 11),
      ('computer_science', 'Computer architecture', null, 12),
      ('computer_science', 'Memory and storage', null, 13),
      ('computer_science', 'Operating systems', null, 14),
      ('computer_science', 'Languages and translators', null, 15),
      ('computer_science', 'Networks and protocols', null, 16),
      ('computer_science', 'The internet and the web', null, 17),
      ('computer_science', 'Cyber security', null, 18),
      ('computer_science', 'Ethical, legal and environmental impacts', null, 19),
      ('computer_science', 'Programming fundamentals', null, 20),
      ('computer_science', 'Data structures', null, 21),
      ('computer_science', 'Software development and testing', null, 22)
  ) as d (subject, name, unit, position)
  on conflict do nothing;
end;
$$;

comment on function public.seed_default_topics(uuid) is
  'Copies the default topic lists to a user. Generated from src/data/exampleContent.ts.';

-- Only handle_new_user() and this migration seed topics; users can never seed them for anyone.
revoke execute on function public.seed_default_topics(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: accounts that already exist get a profile and the default topics.
-- ---------------------------------------------------------------------------

insert into public.profiles (id)
select u.id from auth.users as u
on conflict (id) do nothing;

select public.seed_default_topics(u.id) from auth.users as u;

-- ---------------------------------------------------------------------------
-- Example cards (12): added on request, at most once per user.
-- Returns how many cards were added: 12, or 0 if the user already has example cards.
-- Runs as the calling user (security invoker), so RLS applies as usual.
-- ---------------------------------------------------------------------------

create or replace function public.add_example_cards()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_inserted integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to add the example cards' using errcode = '42501';
  end if;

  -- Serialise concurrent calls for the same user (a double tap), so the check below holds.
  perform pg_advisory_xact_lock(hashtext('redpen.add_example_cards'), hashtext(v_user_id::text));

  if exists (
    select 1 from public.cards as c
    where c.user_id = v_user_id and c.origin = 'example'
  ) then
    return 0;
  end if;

  insert into public.cards (user_id, subject, topic_id, question, key_points, origin, due, created_at)
  select
    v_user_id,
    e.subject::public.subject_code,
    t.id,
    e.question,
    e.key_points,
    'example',
    -- Distinct timestamps keep the cards in their written order.
    v_now - (12 - e.ord) * interval '1 millisecond',
    v_now - (12 - e.ord) * interval '1 millisecond'
  from (
    values
      (
        1,
        'maths',
        'Modelling in mechanics',
        'A block on a horizontal table is joined to a hanging ball by a string that passes over a pulley at the table''s edge. The block is modelled as a particle, the string as light and inextensible, and the table as smooth. Explain what each of these four assumptions means.',
        '[
          {"id":"kp_ex_ma1_a","point":"Modelling the block as a particle means its dimensions are negligible, so all of its mass acts at a single point.","accept":["the block''s size can be ignored","the mass of the block is concentrated at one point","the block has mass but no dimensions"],"reject":["the block is small","the block has no mass","the weight of the block can be ignored"]},
          {"id":"kp_ex_ma1_b","point":"Modelling the string as light means its mass is negligible, so the tension is the same throughout the string.","accept":["the string has no mass","the weight of the string can be ignored","the tension is the same all the way along the string"],"reject":["the string does not stretch","the string is thin"]},
          {"id":"kp_ex_ma1_c","point":"Modelling the string as inextensible means it does not stretch, so the block and the ball always have the same magnitude of acceleration.","accept":["the string''s length stays the same","the string cannot stretch, so both objects accelerate at the same rate","the block and the ball move with the same speed and acceleration"],"reject":["the string has no mass","the string will not break","the string is taut"]},
          {"id":"kp_ex_ma1_d","point":"Modelling the table as smooth means there is no friction between the block and the table.","accept":["the table is frictionless","friction can be ignored","the coefficient of friction is zero"],"reject":["the table is flat","the table is level","there is no air resistance"]}
        ]'::jsonb
      ),
      (
        2,
        'maths',
        'The binomial and Poisson distributions',
        'The number of seeds that germinate in a tray of 20 is modelled by X ~ B(20, p). State the four conditions needed for a binomial distribution to be a suitable model.',
        '[
          {"id":"kp_ex_ma2_a","point":"There is a fixed number of trials: the 20 seeds in the tray.","accept":["n is fixed at 20","a fixed number of seeds is planted"],"reject":["there is a large number of trials","the trials are repeated until a seed germinates"]},
          {"id":"kp_ex_ma2_b","point":"Each trial has exactly two possible outcomes: a seed either germinates or it does not.","accept":["each seed germinates or fails to germinate","every trial ends in success or failure"],"reject":["the two outcomes are equally likely","each seed has a 50% chance of germinating"]},
          {"id":"kp_ex_ma2_c","point":"The trials are independent: whether one seed germinates does not affect whether any other seed germinates.","accept":["the seeds germinate independently of each other","the outcome of one trial does not affect another"],"reject":["the seeds are chosen at random","the trials are random","the trials are fair"]},
          {"id":"kp_ex_ma2_d","point":"The probability of success, p, is the same for every trial: each seed has the same probability of germinating.","accept":["p is constant","every seed has an equal chance of germinating"],"reject":["p = 0.5","the probability is known","each outcome is equally likely"]}
        ]'::jsonb
      ),
      (
        3,
        'maths',
        'Hypothesis testing',
        'In a hypothesis test, define the critical region, the critical value and the actual significance level.',
        '[
          {"id":"kp_ex_ma3_a","point":"The critical region is the set of values of the test statistic for which the null hypothesis, H₀, is rejected.","accept":["the range of values of X that would lead to H₀ being rejected","the values of the test statistic that give a significant result"],"reject":["the range of values of the parameter p","the values for which H₀ is accepted","the values that prove H₁ is true"]},
          {"id":"kp_ex_ma3_b","point":"The critical value is the boundary of the critical region: the first value of the test statistic that lies inside it.","accept":["the value on the edge of the critical region, included in it","the least extreme value that still leads to H₀ being rejected"],"reject":["the last value outside the critical region","the critical value is the significance level","the value of p stated in H₀"]},
          {"id":"kp_ex_ma3_c","point":"The actual significance level is the probability that the test statistic lies in the critical region when H₀ is true.","accept":["P(test statistic in the critical region | H₀ true)","the probability of incorrectly rejecting H₀","the probability of a Type I error"],"reject":["the significance level stated in the question","the probability that H₀ is true","the probability that the result is wrong"]}
        ]'::jsonb
      ),
      (
        4,
        'further_maths',
        'Matrices',
        'Explain what is meant by a singular matrix, and describe the effect of the transformation that it represents.',
        '[
          {"id":"kp_ex_fm1_a","point":"A singular matrix is a square matrix whose determinant is zero.","accept":["det M = 0","a matrix M with |M| = 0"],"reject":["a matrix with a determinant of 1","a 1 × 1 matrix","a matrix containing a zero"]},
          {"id":"kp_ex_fm1_b","point":"A singular matrix has no inverse.","accept":["M⁻¹ does not exist","it cannot be inverted"],"reject":["its inverse is the zero matrix","it is its own inverse"]},
          {"id":"kp_ex_fm1_c","point":"The transformation has an area scale factor of zero: it collapses the whole plane onto a line or a single point.","accept":["every shape is mapped to an image with zero area","the plane is squashed onto a line through the origin, or onto the origin itself","in 3D, the volume scale factor is zero and space collapses onto a plane, a line or a point"],"reject":["the shape is reflected","the area of the shape is unchanged","the shape is mapped onto itself"]},
          {"id":"kp_ex_fm1_d","point":"Different points are mapped to the same image, so the transformation cannot be reversed.","accept":["the transformation is many-to-one","there is no transformation that undoes it"],"reject":["the transformation is its own inverse","the image cannot be drawn"]}
        ]'::jsonb
      ),
      (
        5,
        'further_maths',
        'Proof by induction',
        'Describe the four stages of a proof by mathematical induction that a statement is true for all positive integers n.',
        '[
          {"id":"kp_ex_fm2_a","point":"Basis: show that the statement is true for the first value, n = 1.","accept":["base case: check that P(1) is true","prove that the result holds when n = 1"],"reject":["check that it works for n = 1, 2 and 3, so it is always true","assume it is true for n = 1"]},
          {"id":"kp_ex_fm2_b","point":"Assumption: assume that the statement is true for n = k, for some positive integer k.","accept":["inductive hypothesis: suppose that P(k) is true","assume the result holds when n = k"],"reject":["assume it is true for all n","let n = k"]},
          {"id":"kp_ex_fm2_c","point":"Inductive step: use the assumption to show that the statement is then true for n = k + 1.","accept":["show that P(k) being true implies that P(k + 1) is true","prove that if it holds for n = k then it holds for n = k + 1"],"reject":["substitute n = k + 1 into the result to be proved","check the statement for one more value of n"]},
          {"id":"kp_ex_fm2_d","point":"Conclusion: it is true for n = 1, and if it is true for n = k then it is true for n = k + 1, so it is true for all positive integers n.","accept":["a concluding statement that refers to both the basis and the inductive step","so, by mathematical induction, it is true for all positive integers n"],"reject":["therefore it is true","QED","so it is true for n = k + 1"]}
        ]'::jsonb
      ),
      (
        6,
        'further_maths',
        'Complex numbers',
        'A polynomial equation f(z) = 0 has real coefficients. Explain why any non-real roots must occur in complex conjugate pairs.',
        '[
          {"id":"kp_ex_fm3_a","point":"If α is a root then f(α) = 0, and taking the complex conjugate of both sides gives (f(α))* = 0, because the conjugate of 0 is 0.","accept":["conjugate both sides of f(α) = 0","(f(α))* = 0* = 0"],"reject":["take the modulus of both sides","replace α with −α"]},
          {"id":"kp_ex_fm3_b","point":"Conjugation works term by term: the conjugate of a sum is the sum of the conjugates and the conjugate of a product is the product of the conjugates, so (aαⁿ)* = a*(α*)ⁿ.","accept":["(z + w)* = z* + w* and (zw)* = z*w*","(αⁿ)* = (α*)ⁿ"],"reject":["(αⁿ)* = −αⁿ","the conjugate of αⁿ is αⁿ"]},
          {"id":"kp_ex_fm3_c","point":"The coefficients are real, so each one equals its own conjugate (a* = a), which gives (f(α))* = f(α*).","accept":["real numbers are unchanged by conjugation","because a* = a for real a, the conjugate of f(α) is f(α*)"],"reject":["the coefficients are conjugates of each other","the coefficients are all positive"]},
          {"id":"kp_ex_fm3_d","point":"So f(α*) = 0: α* is also a root, and it is different from α because α is not real.","accept":["α* also satisfies the equation","the roots come as a pair, α and α*"],"reject":["−α is also a root","1/α is also a root","the roots are always ±α"]}
        ]'::jsonb
      ),
      (
        7,
        'physics',
        'Fluids and viscosity',
        'A small steel ball is released from rest at the top of a tall tube of oil. Explain why it reaches a terminal velocity.',
        '[
          {"id":"kp_ex_ph1_a","point":"At first the ball''s weight is greater than the upthrust plus the viscous drag, so there is a resultant downward force and the ball accelerates.","accept":["initially W > U + F, so it accelerates downwards","at the start the resultant force is downwards"],"reject":["gravity is stronger than the oil","it accelerates because it is heavy"]},
          {"id":"kp_ex_ph1_b","point":"As the ball''s speed increases, the viscous drag on it increases.","accept":["drag increases with velocity","the faster it falls, the larger the viscous force"],"reject":["air resistance increases","the drag increases as the ball falls further","the drag gets bigger, with no link to speed"]},
          {"id":"kp_ex_ph1_c","point":"So the resultant force on the ball decreases, and therefore its acceleration decreases.","accept":["the net force gets smaller, so the acceleration falls","the ball''s acceleration decreases"],"reject":["the ball slows down","the velocity decreases"]},
          {"id":"kp_ex_ph1_d","point":"Terminal velocity is reached when weight = upthrust + viscous drag: the resultant force is zero, so the acceleration is zero and the velocity is constant.","accept":["W = U + F, so there is no resultant force and the speed is constant","the forces balance, so the ball moves at a constant velocity"],"reject":["drag equals weight, with upthrust ignored","the forces balance, so the ball stops","gravity stops acting on the ball"]}
        ]'::jsonb
      ),
      (
        8,
        'physics',
        'Particle nature of light',
        'Light below a certain frequency releases no electrons from a metal surface, however intense the light is. Using the photon model of light, explain why.',
        '[
          {"id":"kp_ex_ph2_a","point":"Light consists of photons, each with energy E = hf, which depends only on the frequency of the light.","accept":["the energy of a photon is proportional to its frequency","each photon carries energy hf"],"reject":["the energy of light depends on its intensity","energy from the wave builds up over time"]},
          {"id":"kp_ex_ph2_b","point":"Each electron absorbs the energy of a single photon: it is a one-to-one interaction.","accept":["one photon is absorbed by one electron","an electron cannot combine the energy of several photons"],"reject":["electrons absorb energy gradually until they have enough","an electron absorbs many photons at once"]},
          {"id":"kp_ex_ph2_c","point":"To escape, an electron needs at least the work function, φ: the minimum energy required to remove an electron from the surface of the metal.","accept":["the work function is the minimum energy needed to release an electron from the surface","the electron must gain at least φ to leave the metal"],"reject":["the work function is the energy the electron already has","the electron needs the ionisation energy","the threshold frequency is the energy needed"]},
          {"id":"kp_ex_ph2_d","point":"Below the threshold frequency, hf < φ, so no single photon gives an electron enough energy to escape; more intense light only delivers more photons per second, each with too little energy.","accept":["the photon energy is less than the work function","increasing the intensity increases the number of photons, not the energy of each photon"],"reject":["the light is not bright enough","the electrons do not have enough time to absorb energy","brighter light gives each photon more energy"]}
        ]'::jsonb
      ),
      (
        9,
        'physics',
        'Magnetic fields and induction',
        'State Faraday''s law and Lenz''s law of electromagnetic induction.',
        '[
          {"id":"kp_ex_ph3_a","point":"Faraday''s law: the magnitude of the induced e.m.f. is directly proportional to the rate of change of magnetic flux linkage.","accept":["induced e.m.f. ∝ rate of change of flux linkage","ε = −d(NΦ)/dt, with each symbol defined","the e.m.f. is proportional to the rate at which magnetic flux is cut"],"reject":["the e.m.f. is proportional to the change in flux","the e.m.f. is proportional to the magnetic flux","the induced current is proportional to the rate of change of flux"]},
          {"id":"kp_ex_ph3_b","point":"Lenz''s law: the direction of the induced e.m.f. (or current) is such that it opposes the change that produces it.","accept":["the induced current sets up a magnetic field that opposes the change in flux linkage","the induced e.m.f. acts to oppose the change causing it"],"reject":["the induced current opposes the magnetic field","the induced e.m.f. opposes the flux","the induced current flows the opposite way to the field"]}
        ]'::jsonb
      ),
      (
        10,
        'computer_science',
        'Data compression',
        'Compare lossy and lossless compression, and state when lossless compression must be used.',
        '[
          {"id":"kp_ex_cs1_a","point":"Lossy compression permanently removes some data, so the original file cannot be reconstructed exactly.","accept":["data is discarded and cannot be recovered","some detail is lost for good when the file is compressed"],"reject":["lossy compression only removes repeated data","a lossy file can be decompressed back to the original","lossy compression loses the whole file"]},
          {"id":"kp_ex_cs1_b","point":"Lossless compression reduces the file size without losing any data, so the original can be reconstructed exactly.","accept":["no data is lost, so decompressing gives an identical copy","it encodes patterns or repetition, for example with run-length encoding, so the original is fully restored"],"reject":["lossless compression does not reduce the file size","lossless compression keeps the quality high","lossless compression removes data the user will not notice"]},
          {"id":"kp_ex_cs1_c","point":"Lossy compression usually gives a much smaller file, so it suits images, audio and video, where a small loss of quality is acceptable.","accept":["lossy achieves a greater reduction in file size","lossy is used for streaming music or video because the loss is hard to notice"],"reject":["lossy is always better","lossy is used for text documents"]},
          {"id":"kp_ex_cs1_d","point":"Lossless compression must be used when the decompressed data has to be identical to the original, such as text, program code or executable files.","accept":["for source code, spreadsheets or documents, where every bit must be kept","when losing any data would change the meaning or stop the file working"],"reject":["for large files","for photos, to save space"]}
        ]'::jsonb
      ),
      (
        11,
        'computer_science',
        'Computer architecture',
        'Describe what happens during each stage of the fetch–decode–execute cycle.',
        '[
          {"id":"kp_ex_cs2_a","point":"The address held in the program counter (PC) is copied into the memory address register (MAR).","accept":["the PC holds the address of the next instruction, which is sent to the MAR","the address of the next instruction is put on the address bus"],"reject":["the PC holds the next instruction itself","the address is copied into the MDR"]},
          {"id":"kp_ex_cs2_b","point":"The instruction stored at that address in main memory is copied into the memory data register (MDR) and then into the current instruction register (CIR).","accept":["the instruction is fetched from RAM along the data bus into the MDR, then the CIR","the instruction is loaded into the CIR"],"reject":["the instruction is fetched from the hard disk","the instruction is stored in the MAR"]},
          {"id":"kp_ex_cs2_c","point":"The program counter is incremented so that it holds the address of the next instruction.","accept":["the PC increases by one","the PC is updated to point to the next instruction"],"reject":["the MAR is incremented","the PC is reset to zero"]},
          {"id":"kp_ex_cs2_d","point":"The control unit decodes the instruction in the CIR to identify the operation (opcode) and the data or address it uses (operand).","accept":["the control unit works out what the instruction means","the instruction is split into its opcode and operand"],"reject":["the ALU decodes the instruction","the compiler decodes the instruction"]},
          {"id":"kp_ex_cs2_e","point":"The instruction is executed: the control unit sends signals so that, for example, the ALU performs a calculation or data is moved between memory and registers. Then the cycle repeats.","accept":["the instruction is carried out, with any result stored in the accumulator or memory","the operation is performed and the next cycle begins"],"reject":["the whole program is run","the instruction is sent back to memory"]}
        ]'::jsonb
      ),
      (
        12,
        'computer_science',
        'Data structures',
        'Describe the characteristics of a stack, including how items are added to it and removed from it.',
        '[
          {"id":"kp_ex_cs3_a","point":"A stack is a last in, first out (LIFO) structure: the most recently added item is the first to be removed.","accept":["LIFO","the last item pushed is the first item popped"],"reject":["FIFO","first in, first out","items are removed in the order they were added"]},
          {"id":"kp_ex_cs3_b","point":"Items are added (pushed) and removed (popped) at one end only, called the top.","accept":["push adds an item to the top and pop removes the item at the top","only the top of the stack can be accessed"],"reject":["items are added at the back and removed from the front","any item can be accessed directly"]},
          {"id":"kp_ex_cs3_c","point":"A stack pointer keeps track of the top of the stack, changing with every push and pop.","accept":["a top pointer stores the index of the top item","the pointer is incremented on a push and decremented on a pop"],"reject":["front and rear pointers are used","the pointer always points to the first item added"]},
          {"id":"kp_ex_cs3_d","point":"Popping from an empty stack causes underflow and pushing onto a full stack causes overflow, so both conditions must be checked.","accept":["check that the stack is not empty before popping and not full before pushing","underflow when empty, overflow when full"],"reject":["overflow happens when the stack is empty","underflow happens when the stack is full"]}
        ]'::jsonb
      )
  ) as e (ord, subject, topic, question, key_points)
  -- The topic is matched by name; it stays null if the user has renamed or deleted it.
  left join public.topics as t
    on t.user_id = v_user_id
    and t.subject = e.subject
    and lower(btrim(t.name)) = lower(btrim(e.topic))
  order by e.ord;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.add_example_cards() is
  'Adds the example cards for the signed-in user, once. Generated from src/data/exampleContent.ts.';

revoke execute on function public.add_example_cards() from public, anon;
grant execute on function public.add_example_cards() to authenticated;
