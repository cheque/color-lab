# Color harmony and contrast: a literature review

*For the third instrument of "The math of it", "Harmony". Written 2026-11-13. Status: first pass, to be
discussed with the owner.*

## 1. The question

Classic color theory says that certain *shapes* of colors go together: two colors opposite each other
(complements), three at the corners of an equilateral triangle (a triad), a narrow fan of neighbors
(analogous), one hue in several strengths (monochromatic), and so on. It also names *contrasts*: of hue,
of light and dark, of warm and cool, of area. On the home page we wrote "a harmony is a shape"; this
review asks what the shapes are, in which space they were drawn, and how much of them survives a
measurement.

Three facts organize everything below.

1. **Every rule is stated on a particular wheel or solid**, and the wheels disagree. "The complement of
   red" is green on the painter's red–yellow–blue wheel, cyan on the RGB/HSL wheel, a blue-green on
   Munsell's, and something else again as an afterimage. A triad on one wheel is not a triad on another.
2. **The classical rules are geometric** (equal steps, opposite points, simple figures in a solid). The
   twentieth century turned them into metrics (Moon & Spencer, Judd), and the last thirty years tested
   them against people (Ou & Luo, Szabó et al., Schloss & Palmer, O'Donovan et al.).
3. **The tests support a small part of the geometry.** Hue similarity and lightness relations predict
   harmony well. Exact angular templates (180°, 120°, 90°) do not, and "opposite in CIELAB" does not even
   predict which pairs look complementary.

The instrument can show all three at once: draw the shape, carry it into every space, and put the
measurements next to it.

## 2. The wheels: where "opposite" comes from

| wheel | primaries, construction | complement of red | notes |
|---|---|---|---|
| **Newton** (*Opticks*, 1704) | the spectrum bent into a circle, closed with purple; seven sectors sized like a musical scale | — | First color circle; mixture as a center of gravity in the circle, which is the germ of every later "balance" rule. |
| **Painter's RYB** (Harris c. 1766; Goethe 1810; Itten 1961) | red, yellow, blue primaries; orange, green, violet secondaries; 12 hues | green | The wheel of art schools, of Itten's chords and of Adobe Color. Not a colorimetric object: its hues are pigment names, and RYB "complements" do not cancel to gray as lights. |
| **Additive RGB / HSL** (Maxwell; Smith 1978 for HSV/HSL) | red, green, blue lights; cyan, magenta, yellow between | cyan | The computer's wheel. Complements mix to white as lights (in sRGB, a hue rotation by 180° in HSL keeps a color's max+min, hence its HSL lightness). Hues are not evenly spaced to the eye: the greens fill a wide arc. |
| **Opponent / afterimage** (Hering 1878; Chevreul 1839) | red–green and yellow–blue opponent pairs | the afterimage of red is a blue-green | Chevreul's simultaneous contrast pushes a color's neighbor towards its afterimage complement. |
| **Munsell** (1905, 1915 *Atlas*) | five principal hues R, Y, G, B, P, equally spaced *to the eye*; value and chroma as the other axes | blue-green (BG) | A perceptual wheel: complements are defined by mixing to neutral gray on a spinning disc (Maxwell disc), so "opposite" is physical and perceptual at once. |
| **Ostwald** (1916–1918) | 24 hues on a circle of complementary pairs; each hue a triangle from white to black to full color | as on his circle | The solid is a double cone; harmony is *order* in it (§4). |
| **CIELAB / CIELCh** (CIE 1976) | opponent axes a* (green–red) and b* (blue–yellow); hue angle h° | the hue at h° + 180° | Approximately uniform, so it is the default for computing. But Mahyar et al. (2007, 2013) found that opposites in CIELAB do **not** match the complements people choose; of five spaces tested, OSA-UCS came closest. |

**Consequence for the instrument:** the wheel must be a choice the user makes, and switching it should
move the shape's colors visibly. The difference between wheels *is* the lesson.

## 3. The classic schemes as shapes

The canonical list, as Itten (1961) gives it with dyads, triads, tetrads and hexads, and as tools like
Adobe Color (formerly Kuler) and Paletton present it today. Angles are on the chosen wheel, θ is the base
hue.

| scheme | hues | shape on the wheel | source |
|---|---|---|---|
| monochromatic | θ only, several lightnesses/chromas | a point; a line or curve along L and C | Munsell's harmony within a hue; Ostwald's shadow series |
| analogous | θ − δ, θ, θ + δ (δ ≈ 30°) | a short arc | Chevreul's harmony of analogy |
| complementary (dyad) | θ, θ + 180° | a diameter | Chevreul, Itten, Munsell |
| split complementary | θ, θ + 180° ± δ | an isosceles triangle | Itten |
| triad | θ, θ + 120°, θ + 240° | equilateral triangle | Itten; Ostwald's triads on his circle |
| tetrad (rectangle) | θ, θ + δ, θ + 180°, θ + 180° + δ | rectangle (two complementary pairs) | Itten |
| square | θ + k·90° | square | Itten |
| hexad | θ + k·60° | hexagon | Itten |
| polychromatic "chords" | any inscribed polygon | Itten: *any* regular figure inscribed in the circle gives a harmonious chord |

Itten's general statement is the cleanest geometric idea in the canon: a set of colors is harmonious when
it mixes to neutral gray, and an inscribed regular polygon in a wheel of complements does exactly that.
That is Newton's center-of-gravity rule and Munsell's balance rule (§4) in another guise, and it is the
part we can compute exactly: **the hues' unit vectors sum to zero** for every regular polygon.

**Matsuda's templates** (Matsuda 1995, from the Japan Color Research Institute's system and Itten) are the
version that became a computer-graphics standard through **Cohen-Or et al. 2006, "Color Harmonization"**.
Eight hue templates on the wheel; a palette or image is harmonious if its hues fall in the gray sectors,
for some rotation of the template. As used by Cohen-Or et al.:

| type | sectors |
|---|---|
| i | one narrow sector (≈ 18°) |
| V | one wide sector (≈ 94°) |
| L | a narrow and a wide sector at 90° |
| I | two narrow sectors, opposite |
| T | a half wheel (180°) |
| Y | a wide sector and a narrow one opposite |
| X | two wide sectors, opposite |
| N | gray scale (no hue) |

Cohen-Or et al. fit the best template and rotation to an image's hue histogram, then shift each pixel's
hue into the nearest sector, with a graph cut to keep regions coherent. Matsuda's full model also has
*tone* templates (distributions in lightness and chroma), which the graphics literature mostly dropped.
*Sector widths: from Cohen-Or et al. 2006; to be checked against the paper before implementing.*

## 4. Harmony as order in a solid

- **Chevreul (1839).** Two kinds of harmony: of **analogy** (similar colors: one hue in several tones,
  neighboring hues in one tone, or everything seen through a colored glass) and of **contrast** (opposite
  tones of one hue, distant hues, complements). His law of simultaneous contrast is the physiological
  base: two colors side by side each shift away from the other, in lightness and towards the other's
  complement.
- **Munsell (*A Grammar of Color*, 1921).** **Balance**: a design is balanced if all its colors, weighted by
  area and strength, would mix to a perfect gray. Strong colors take small areas, weak colors large ones.
  T. M. Cleland's practical rule in the same book: the product *value × chroma* of each color, times its
  area, should balance between the colors (e.g. blue 4/5 → 20 against yellow-red 6/7 → 42, so the blue takes
  about twice the area). Also paths through the solid: a sequence of colors on a straight line, or on an
  ellipse around the neutral axis, is harmonious.
- **Ostwald (*Die Farbenfibel* 1916, *Die Harmonie der Farben* 1918; Jacobson's *Color Harmony Manual*
  1942).** "Harmony = order." In the triangle of one hue (full color, white, black), harmonious series
  are the lines of constant white content (*isotints*), constant black content (*isotones*) and constant
  purity (*shadow series*, parallel to the gray axis). Across hues, the rings of constant white and black
  (*isovalent* circles) and their triads and complementary pairs.
- **Moon & Spencer (1944, three papers in JOSA).** Classical harmony made geometric: in a modified Munsell
  space (ω-space), the interval between two colors is harmonious if it is an **identity**, a **similarity**
  or a **contrast**, and disharmonious in the two **ambiguity** bands between them (the first between
  identity and similarity, the second between similarity and contrast). Separate tables for hue, value
  and chroma. A second paper adds **area** (balance at a "psychological equilibrium point", again a center of
  gravity), and a third an **aesthetic measure** M = O/C after Birkhoff (1933): order over complexity.
  Later tests (Chuang & Ou 2001 among them) found these intervals poor predictors of judged harmony.
- **Judd (1955; Judd & Wyszecki 1975).** Harmony as colors in neighboring areas that please, and four
  principles that summarize the tradition: **order** (colors chosen by a regular plan in a solid),
  **familiarity** (sequences seen in nature, such as light-to-shadow), **similarity** (a common quality)
  and **unambiguity** (differences large enough to read as intended). *Verified only through secondary
  citations.*
- **NCS** (Hård & Sivik 2001). A descriptive model of colors in combination built on the Natural Color
  System: it separates the *distinctness of the border* between two colors from the interval in each
  attribute, and describes combinations rather than ruling them good or bad.

## 5. Contrast: Itten's seven, and the measurable ones

Itten (1961) lists seven contrasts. Each has a measurable counterpart, which is what the instrument
should show beside the swatches.

| contrast (Itten) | what it is | a measure |
|---|---|---|
| of hue | pure hues side by side (strongest with the three primaries) | hue spread: the circular range or variance of h° |
| light–dark | value contrast | ΔL*; also the WCAG contrast ratio (L₁ + 0.05)/(L₂ + 0.05) on relative luminance, and APCA's lightness contrast |
| cold–warm | blue-green against red-orange | a warm–cool index (Ou et al. 2004 give one in CIELAB) |
| complementary | opposite hues: they mix to gray | the norm of the sum of the colors' a*b* vectors (zero when balanced) |
| simultaneous | the eye supplies a color's complement on a neutral neighbor | a demonstration, not a score: a gray patch on each palette color |
| of saturation | pure against dull of the same hue | ΔC* |
| of extension (proportion) | how much area each color takes | Goethe's "light values" give areas inversely proportional to brightness (in Itten's figures: yellow : orange : red : violet : blue : green = 3 : 4 : 6 : 9 : 8 : 6 in area); Munsell's value × chroma rule is the same idea |

*Goethe's numbers as Itten states them: to be checked in the 1961 text before they go on screen.*

Albers (*Interaction of Color*, 1963) is the reminder that all of this is relative: one color can look
like two, two can look like one, depending on what surrounds them. That argues for showing every palette
**in context** (each color on each other color) and not only as a row of chips.

## 6. Testing the rules: what people actually judge harmonious

- **Ou & Luo (2006).** 1431 color pairs rated on a 10-step harmonious–disharmonious scale. The model is
  three additive terms in CIELAB: a **chromatic-difference** term (pairs with similar hue and chroma are
  more harmonious), a **lightness** term (higher total lightness and a moderate-to-large lightness
  difference help) and a **hue** term (some hues, around yellow, add harmony at high lightness). Ou et al.
  (2011) extended it to three-color combinations by adding pairwise terms; a 12-region study (Ou et al.
  2012) found harmony more culture-dependent than color emotion. *The formula is in the paper; we
  implement it only after checking every coefficient against it.*
- **Szabó, Bodrogi & Schanda (2010).** Harmony formulae for two- and three-color combinations on the
  CIECAM02 correlates (lightness, chroma, hue), from ratings on a −5 … +5 scale; compared with the
  classical theories, which they fit poorly.
- **Schloss & Palmer (2011).** Separates **preference** for a pair, **harmony** of a pair and preference for
  the figure color. Harmony rises with **hue similarity** and is fairly constant across observers;
  preference depends more on liking the colors and on lightness contrast. Complementary pairs are *not*
  judged especially harmonious.
- **O'Donovan, Agarwala & Hertzmann (2011).** Learned the compatibility of five-color themes from tens of
  thousands of user ratings on Adobe Kuler and COLOURlovers. Hue templates explain little; people prefer
  themes with similar or adjacent hues, and lightness relations matter more than hue geometry.
- **Mahyar et al. (2007, 2013).** Complementary pairs chosen by people do not sit 180° apart in CIELAB;
  OSA-UCS fits best, within a few degrees for most hues.
- **Reviews:** Burchett (2002) groups the literature's principles into eight; O'Connor (2010) argues that
  harmony depends on context and individual, and cannot be a fixed law; Westland et al. (2007) survey the
  classical and empirical theories together.

The overall picture: **similarity and order** (Chevreul's analogy, Ostwald's series, Judd's similarity)
have support; **balance to gray** is exact physics but its aesthetic claim is weakly tested; **exact
angles** (triads, squares) are teaching devices more than laws.

## 7. Design decisions this sets up for the instrument

1. **The wheel is a parameter.** RYB (painter's), HSL (additive), CIELCh (perceptual), and the
   afterimage complement. One shape, drawn on each wheel, gives visibly different colors. RYB needs a
   hue remapping from HSL (piecewise linear, Itten's 12 hues at equal steps; or Gossett & Chen's (2004)
   trilinear RYB cube).
2. **A scheme is a shape plus a rule for the other coordinates.** The hues come from the polygon; lightness
   and chroma from the base color (constant), or from an Ostwald series, or from Munsell's balance.
3. **Show the shape in 3-D.** The polygon on the wheel is flat; carried into the other solids (as the
   color-models instrument does with its cuts) it bends. A triad of constant HSL lightness is a tilted
   triangle in CIELAB.
4. **Measurements beside the shape:** the seven contrasts (§5), the balance vector, ΔE00 between the
   colors, WCAG ratio for each pair, and an empirical harmony score (Ou & Luo) for each pair.
5. **Areas.** A proportion bar sized by Goethe/Itten or by Munsell's balance, so "contrast of extension"
   is visible.
6. **Context.** Each color on each other color (Albers), and a gray patch on each color (Chevreul).
7. **Fit a template to a palette.** Matsuda/Cohen-Or in reverse: given colors (from the color-models
   palette or the photograph pyramid), find the template and rotation that fit best, and show how far
   each color would move to comply.

## 8. Questions for the owner

1. Which wheels should be in the first version: RYB, HSL and CIELCh, or also Munsell (approximated
   from CIELAB) and OSA-UCS?
2. Should the instrument judge (show an empirical harmony score), or only describe (shapes and
   contrasts), leaving judgment to the user?
3. Is the Matsuda/Cohen-Or template fit, applied to a palette or a photo, part of this instrument or of
   the palette-analysis one?
4. Lightness and chroma of the generated colors: kept from the base color, or chosen by an Ostwald-style
   series, or free per color?
5. Should area (Itten's contrast of extension, Munsell's balance) be a first-class output, with a
   proportion bar and exports that carry the weights?

## References

Verification: entries marked ✓ were checked against an online record on 2026-11-13. The others are
standard references cited from memory or through secondary sources; check before quoting page numbers.

- Albers, J. (1963). *Interaction of Color*. Yale University Press.
- Birkhoff, G. D. (1933). *Aesthetic Measure*. Harvard University Press.
- Burchett, K. E. (2002). Color harmony. *Color Research & Application* 27(1):28–31. doi:10.1002/col.10004 ✓
- Chevreul, M. E. (1839). *De la loi du contraste simultané des couleurs et de l'assortiment des objets
  colorés*. Paris. English: *The Principles of Harmony and Contrast of Colours* (Martel, 1854); *The Laws of
  Contrast of Colour* (Spanton, 1861; Project Gutenberg #76939). ✓
- Chuang, M.-C., Ou, L.-C. (2001). Influence of a holistic color interval on color harmony. *Color Research
  & Application* 26(1):29–39.
- Cohen-Or, D., Sorkine, O., Gal, R., Leyvand, T., Xu, Y.-Q. (2006). Color harmonization. *ACM TOG (SIGGRAPH)*
  25(3):624–630. doi:10.1145/1141911.1141933 ✓
- Goethe, J. W. von (1810). *Zur Farbenlehre*. English: *Theory of Colours* (Eastlake, 1840).
- Gossett, N., Chen, B. (2004). Paint inspired color mixing and compositing for visualization. *IEEE
  InfoVis*.
- Hård, A., Sivik, L. (2001). A theory of colors in combination: a descriptive model related to the NCS
  color-order system. *Color Research & Application* 26(1):4–28. ✓
- Harris, M. (c. 1766). *The Natural System of Colours*. London.
- Hering, E. (1878). *Zur Lehre vom Lichtsinne*. Vienna.
- Itten, J. (1961). *Kunst der Farbe*. Ravensburg: Otto Maier. English: *The Art of Color* (1961); abridged as
  *The Elements of Color* (Birren, ed., 1970).
- Jacobson, E. (1942). *Color Harmony Manual*. Container Corporation of America (after Ostwald). ✓
- Judd, D. B., Wyszecki, G. (1975). *Color in Business, Science and Industry*, 3rd ed. Wiley.
- Mahyar, F., Cheung, V., Westland, S., Henry, P. (2007). Investigation of complementary colour harmony in
  CIELAB colour space. *AIC Midterm Meeting*, Hangzhou, 82–85. ✓ (and a 2013 follow-up comparing five
  spaces) ✓ <https://eprints.whiterose.ac.uk/82917>
- Matsuda, Y. (1995). *Color Design*. Tokyo: Asakura Shoten (in Japanese). (Through Cohen-Or et al. 2006.)
- Moon, P., Spencer, D. E. (1944). Geometric formulation of classical color harmony. *JOSA* 34(1):46–59;
  Area in color harmony, *JOSA* 34(2):93–103; Aesthetic measure applied to color harmony, *JOSA*
  34(4):234–242. (Page numbers from secondary citations.)
- Munsell, A. H. (1905). *A Color Notation*. Boston. (1921). *A Grammar of Color*. Strathmore Paper Co. ✓
  <https://munsell.com/color-blog/grammar-of-color-munsell-intro-balance-color/>
- Newton, I. (1704). *Opticks*. London.
- O'Connor, Z. (2010). Colour harmony revisited. *Color Research & Application* 35(4):267–273.
- O'Donovan, P., Agarwala, A., Hertzmann, A. (2011). Color compatibility from large datasets. *ACM TOG
  (SIGGRAPH)* 30(4):63. ✓ (in the palette-sampling review)
- Ostwald, W. (1916). *Die Farbenfibel*. (1918). *Die Harmonie der Farben*. Leipzig: Unesma.
- Ou, L.-C., Luo, M. R. (2006). A colour harmony model for two-colour combinations. *Color Research &
  Application* 31(3):191–204. doi:10.1002/col.20208 ✓
- Ou, L.-C., Luo, M. R., Woodcock, A., Wright, A. (2004). A study of colour emotion and colour preference,
  parts I–III. *Color Research & Application* 29(3, 4, 5). ✓
- Ou, L.-C., Chong, P., Luo, M. R., Minchew, C. (2011). Additivity of colour harmony. *Color Research &
  Application* 36(5):355–372.
- Ou, L.-C., Luo, M. R., Sun, P.-L., et al. (2012). A cross-cultural comparison of colour emotion for
  two-colour combinations. *Color Research & Application* 37. doi:10.1002/col.20648 ✓
- Schloss, K. B., Palmer, S. E. (2011). Aesthetic response to color combinations: preference, harmony, and
  similarity. *Attention, Perception, & Psychophysics* 73:551–571. ✓ Open access, PMC3037488.
- Szabó, F., Bodrogi, P., Schanda, J. (2010). Experimental modeling of colour harmony. *Color Research &
  Application* 35(1):34–49. doi:10.1002/col.20558 ✓
- Westland, S., Laycock, K., Cheung, V., Henry, P., Mahyar, F. (2007). Colour harmony. *Colour: Design &
  Creativity* 1(1):1–15. ✓ <https://eprints.whiterose.ac.uk/83854>
- W3C (2008). *Web Content Accessibility Guidelines 2.0*: contrast ratio. And the APCA draft for WCAG 3.
