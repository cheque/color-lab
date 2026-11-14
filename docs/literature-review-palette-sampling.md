# Palettes from a photograph: a literature review

*For app 2, "Color palette sampling". Written 2026-11-13. Status: first pass, to be discussed with the owner.*

## 1. The question

Given a photograph, return a **pyramid of palettes**: a palette of 1 colour, of 2, of 3 … up to *N*.
"Pyramid" asks for more than *N* independent palettes. The palette with *k*+1 colours should be the one with
*k* colours, **refined**: one colour splits into two, and the others stay put. That makes the sequence
*nested* (a tree), so you can read the image's colour structure from coarse to fine, the way color-curves
lets you resample one curve at 7 or 12 colours.

The literature addresses this from four directions. Nesting is guaranteed by some methods and lost by
others, so it is the main axis of this review.

## 2. Colour quantization (1980s–1990s): reducing an image to *k* colours

Built for frame buffers with small colour tables. The goal is the least reconstruction error, not
aesthetics, but several of these methods are **divisive** and therefore nested by construction.

| method | idea | nested? |
|---|---|---|
| **Median cut** (Heckbert 1982) | Start with the RGB box holding every pixel; repeatedly cut the box with the largest range along its longest axis, at the median. | Yes, if boxes are cut one at a time (the home-page card does exactly this). |
| **Octree** (Gervautz & Purgathofer 1988) | Insert pixels into an RGB octree and merge leaves bottom-up until *k* remain. | Yes (agglomerative on a fixed grid), but tied to the cube's axes. |
| **Wu's quantizer** (Wu 1991) | Cumulative moment tables over a 32³ histogram; each cut minimises the variance of the two halves. Fast and close to optimal. | Yes, if cuts are made greedily one at a time. |
| **Binary splitting** (Orchard & Bouman 1991) | Tree-structured palette: split the leaf with the largest principal eigenvalue of its colour covariance, across its principal eigenvector, through its centroid. Supports a subjective weighting of the error. | **Yes: the tree *is* a pyramid.** |
| **NeuQuant** (Dekker 1994) | Kohonen self-organising map over the pixels. | No. |
| **k-means**, improved for colour (Celebi 2011) | Lloyd iterations, deduplicated pixels, triangle-inequality pruning; initialisation matters most. | No: the solutions for *k* and *k*+1 are unrelated. |

Current practice: Google's **Material Color Utilities** (behind Android's "Material You" wallpaper colours)
runs Wu's quantizer and feeds its centres to a weighted k-means ("WSMeans", after Celebi 2011). It is the
best-engineered open implementation and a good baseline to compare against.

## 3. Clustering with an explicit hierarchy

- **Agglomerative (Ward 1963).** Merge the two clusters whose union increases the total within-cluster
  variance least. The dendrogram, cut at every level, gives a nested palette for *every* k from 1 to n.
  Cost: O(n²) memory, so it runs on a histogram or on a few thousand representative colours, not on pixels.
- **Automatic Color Palette, ACoPa** (Delon, Desolneux, Lisani & Petro 2005, 2007). Segments the hue
  histogram, then saturation and value inside each hue mode, with a parameter-free *a contrario* test.
  The number of colours comes out of the image instead of being chosen, and the 2005 paper describes the
  result as a **hierarchical** palette. ACoPa then seeds k-means. An implementation with an improvement for
  low-saturation colours is in IPOL (Lisani & Petro 2021). *The owner has the 2005 paper:*
  `ColorsPalette/delon2005.pdf`.
- **Hierarchical colour model** (Jeong, Yang & Shin 2019, *Computer Graphics Forum*). Builds a bottom-up
  hierarchy of "pure" colours sampled from the image, giving palettes and colour models of no predefined
  size, used for recolouring and soft segmentation. Karim et al. (2022, *IJHCS*) built a node-link
  interface on it for exploring the hierarchy, which is close to the interaction we want.
- **Hierarchical palette extraction by partitioning** (Kang & Hwang 2018, ICIP). Iteratively splits the
  palette, choosing splits by cluster validation and by *local distinctiveness*. The motivation: methods
  driven only by the global distribution miss small but salient colours.
- **Mean shift** (Comaniciu & Meer 2002). Finds the modes of the colour density. Varying the bandwidth
  gives a coarse-to-fine family, but it is not strictly nested.

## 4. Geometric methods: the palette as a convex hull

**Tan, Lien & Gingold 2016** (*ACM TOG*). Because "over" compositing is linear, an image's pixels lie in
the convex hull of the colours that made it. The exact hull has too many vertices, so it is
**simplified** progressively (plane fitting on faces, then clustering of vertices) until it has the
requested number of vertices. Vertices that fall outside the RGB cube are pulled back inside.
Simplification reveals "hidden" colours that clustering, being an average, never finds, such as a pure
pigment that only appears mixed. Follow-ups: RGBXY-space decomposition in milliseconds
(Tan, Echevarria & Gingold 2018, *SIGGRAPH Asia*; *the owner has the arXiv version*) and an improved
geometric approach (Wang et al. 2019, *CGF*).

For a pyramid, the sequence of hulls with *n*, *n*−1, … vertices is a natural coarse-to-fine family. It is
not strictly nested (one simplification step can move several vertices), but it changes smoothly.
These palettes describe the image's *extremes*, while clustering describes its *averages*. That makes the
two views complementary.

## 5. Palettes people would choose

- **Lin & Hanrahan 2013** (CHI). 1 600 hand-extracted themes from Mechanical Turk workers and from artists.
  Turk workers and artists largely agree. People pick **diverse** colours and favour **salient regions**,
  not the most frequent pixels. A regression model on image features matches human themes better than
  k-means or fuzzy c-means. Implication: weight pixels by saliency and reward diversity, rather than
  minimising reconstruction error alone.
- **Chang et al. 2015** (*SIGGRAPH*, palette-based photo recolouring). A modified k-means over a binned Lab
  histogram that discounts black and spreads the clusters. Its main contribution is the recolouring the
  palette then drives.
- **O'Donovan, Agarwala & Hertzmann 2011** (*TOG*). Learns colour compatibility from large sets of rated
  themes (Adobe Kuler, COLOURlovers). Useful later for scoring the palettes in the pyramid, and for app 3.
- **Phan, Fu & Chan 2018**, *Color Orchestra* (*TVCG*). Orders palettes so they can be interpolated and
  predicted. Relevant to how each row of the pyramid is laid out, and to app 3.
- Harmony and palette design in the owner's library: Chamaret 2016 (colour harmony, experimental and
  computational), Lara-Alvarez 2018 (a geometric approach to harmonic palette design), Wijffelaars et al.
  2008 (generating colour palettes with intuitive parameters), Meier et al. 2004.

**Survey to read first:** Gao et al. 2025, "Color Palette Generation From Digital Images: A Review",
*Color Research & Application* (doi:10.1002/col.22975). It notes that hierarchical histogram methods can
produce **redundant** colours, so a pyramid needs a de-duplication rule.

## 6. Design decisions this sets up for app 2

1. **Colour space.** Cluster in CIELAB, already in `lib/color.js` with ΔE76/94/2000. Euclidean Lab is what
   variance-based splitting assumes. OKLab is the modern alternative and is cheap to add. HSL is the space
   we *show* the result in, not the one to cluster in.
2. **Nesting.** Use a divisive tree (Orchard–Bouman binary splitting in Lab, split order by largest SSE) as
   the backbone, so every row refines the row above. Optionally run k-means on each row with the tree's
   centres as seeds (better colours, but the strict nesting is lost). Expose this as a toggle and show the
   lineage lines only when nesting holds.
3. **Weights.** Pixel count (classic), saliency (Lin & Hanrahan), local distinctiveness (Kang & Hwang).
   Start with count; add a saliency weight as a second mode.
4. **Representative colour.** The cluster mean (can be a colour absent from the photo), the medoid, or the
   nearest real pixel. Offer "mean / real pixel".
5. **Stopping and redundancy.** Cap at *N* (default 12) and skip splits whose children are closer than
   a ΔE00 threshold, after Gao et al.
6. **Display.** Rows of swatches, wider at the base, joined parent-to-children by the same connecting lines
   the curves instrument uses between its bars. Click a node to highlight its pixels in the photo.
7. **Bridge to the other instruments.** Each row can be sent to app 3 (fit a Bézier through it) or plotted
   in the HSL cylinder.

**Evaluation**, shown live: mean ΔE00 between each pixel and its palette colour (reconstruction), minimum
pairwise ΔE00 inside the palette (diversity), and the image re-painted with each row's palette (the classic
quantization view).

## 7. Questions for the owner

1. Is strict nesting required, or is a smooth but not strictly nested sequence acceptable if its colours
   are better (k-means per level, hull simplification)?
2. Which representative: averages (cluster means) or colours that actually occur in the photo?
3. Should the geometric "extremes" view (convex-hull simplification) sit beside the clustering view as a
   second pyramid?
4. Is the photo loaded locally only (nothing uploaded) and processed in the browser? That is the default
   assumption.
5. Should it accept several photos at once (a series, a film) and give one shared pyramid?

## References

Verification: entries marked ✓ were checked against an online record on 2026-11-13. The others are
standard references cited from memory; check their details before publishing.

- Chang, H., Fried, O., Liu, Y., DiVerdi, S., Finkelstein, A. (2015). Palette-based photo recoloring.
  *ACM TOG (SIGGRAPH)* 34(4):139. ✓ <https://pixl.cs.princeton.edu/pubs/Chang_2015_PPR/>
- Celebi, M. E. (2011). Improving the performance of k-means for color quantization. *Image and Vision
  Computing* 29(4). arXiv:1101.0395. ✓ (via Material Color Utilities' documentation)
- Comaniciu, D., Meer, P. (2002). Mean shift: a robust approach toward feature space analysis. *IEEE TPAMI* 24(5).
- Dekker, A. H. (1994). Kohonen neural networks for optimal colour quantization. *Network: Computation in
  Neural Systems* 5(3).
- Delon, J., Desolneux, A., Lisani, J.-L., Petro, A. B. (2005). Automatic color palette. *IEEE ICIP*. ✓
  <https://desolneux.perso.math.cnrs.fr/papers/DDLPicip05.pdf>; (2007) *Inverse Problems and Imaging*
  1(2):265–287. ✓ <https://desolneux.perso.math.cnrs.fr/papers/DDLP_ColorIPI_07.pdf>
- Gao et al. (2025). Color palette generation from digital images: a review. *Color Research & Application*.
  <https://onlinelibrary.wiley.com/doi/full/10.1002/col.22975> (record found, not read in full)
- Gervautz, M., Purgathofer, W. (1988). A simple method for color quantization: octree quantization.
  *New Trends in Computer Graphics*, Springer.
- Heckbert, P. (1982). Color image quantization for frame buffer display. *SIGGRAPH '82*.
- Jeong, T., Yang, M., Shin, H. J. (2019). Succinct palette and color model generation and manipulation
  using hierarchical representation. *Computer Graphics Forum* 38(7):1–10. ✓ <https://diglib.eg.org/handle/10.1111/cgf13811>
- Kang, J. M., Hwang, Y. (2018). Hierarchical palette extraction based on local distinctiveness and cluster
  validation for image recoloring. *IEEE ICIP*, 2252–2256. ✓ <https://ieeexplore.ieee.org/document/8451526/>
- Karim et al. (2022). Improving user experience of color palette extraction by using interactive
  visualization based on hierarchical color model. *Int. J. Human-Computer Studies*. ✓
  <https://www.sciencedirect.com/science/article/abs/pii/S1071581922001446>
- Lin, S., Hanrahan, P. (2013). Modeling how people extract color themes from images. *CHI '13*, 3101–3110. ✓
  <https://researchr.org/publication/LinH13>
- Lisani, J.-L., Petro, A. B. (2021). Automatic color palette, an IPOL implementation. *Image Processing
  On Line*. ✓ <https://ipol.im/pub/art/2021/344>
- Material Color Utilities (Google): Wu, WSMeans and Celebi quantizers. ✓
  <https://github.com/material-foundation/material-color-utilities>
- O'Donovan, P., Agarwala, A., Hertzmann, A. (2011). Color compatibility from large datasets. *ACM TOG* 30(4).
- Orchard, M. T., Bouman, C. A. (1991). Color quantization of images. *IEEE Trans. Signal Processing*
  39(12):2677–2690. ✓ <https://engineering.purdue.edu/~bouman/software/color_quantization>
- Phan, H. Q., Fu, H., Chan, A. B. (2018). Color Orchestra: ordering color palettes for interpolation and
  prediction. *IEEE TVCG* 24(6).
- Tan, J., Lien, J.-M., Gingold, Y. (2016). Decomposing images into layers via RGB-space geometry.
  *ACM TOG* 36(1). ✓ <https://cragl.cs.gmu.edu/singleimage/>
- Tan, J., Echevarria, J., Gingold, Y. (2018). Efficient palette-based decomposition and recoloring of
  images via RGBXY-space geometry. *ACM TOG (SIGGRAPH Asia)*. ✓ arXiv:1804.01225
- Wang et al. (2019). An improved geometric approach for palette-based image decomposition
  and recoloring. *Computer Graphics Forum* 38(7). ✓ <https://diglib.eg.org/handle/10.1111/cgf13812>
- Ward, J. H. (1963). Hierarchical grouping to optimize an objective function. *JASA* 58(301).
- Wu, X. (1991). Efficient statistical computations for optimal color quantization. *Graphics Gems II*.
