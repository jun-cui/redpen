// Self-hosted fonts (Fontsource). Family names match the --font-* tokens in tokens.css.
// Each package splits its faces by unicode-range, so browsers only download the subsets a page uses.

// Fraunces with the weight and optical-size axes (no SOFT/WONK): headings and card questions.
import '@fontsource-variable/fraunces/opsz.css'
// Inter (weight axis): all UI text.
import '@fontsource-variable/inter/index.css'
// Caveat (weight axis): the examiner's handwriting.
import '@fontsource-variable/caveat/index.css'
// Literata: serif fallback for Greek (λ, Ω, μ, θ), which Fraunces does not cover.
import '@fontsource-variable/literata/index.css'
