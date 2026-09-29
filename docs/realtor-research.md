# Realtor workflow research and feature report

Research date: September 28, 2026. Product: Nook & Nest. Sources below are official product documentation, first-party product pages, NAR research, or an MLS rule document. Vendor feature descriptions establish what a competitor offers; they are not independent evidence that a feature increases sale prices or speed.

## Product decision

Build a **Listing Studio** around the existing editable home: prepare the layout, walk through it, save useful viewpoints, add real property photos, and produce a listing presentation and marketing pack. Add optional AI video as a separate, explicitly requested step. Preserve the existing warm design editor and its original editable furniture assets.

The most valuable distinction is between three outputs:

- A **3D design walkthrough** explores the editable geometry. It is not a photographed or scanned digital twin.
- A **listing presentation** combines supplied property facts, real photos, design views, room captions and floor plans.
- An **AI marketing video** is a generated visualization requiring comparison with its source images. Photorealistic appearance does not establish dimensional or photographic accuracy.

## What buyers and agents are doing

NAR's 2025 Home Buyers and Sellers Generational Trends Report, exhibit 3-6 on page 56, asks buyers who used the internet which website features were very useful: photos **83%**, detailed property information **79%**, floor plans **57%**, agent contact information **47%**, virtual tours **41%**, and videos **29%**. This supports making good listing images, facts and a floor plan dependable, with video as another output rather than the only offering. [NAR buyer report](https://cms.nar.realtor/sites/default/files/2025-03/2025-home-buyers-and-sellers-generational-trends-report-04-01-2025.pdf)

NAR's dated September 18, 2025 technology survey announcement reports that **75%** of agents use social media, **52%** use drone photography/video, and **46%** use AI-generated content. Its survey is evidence of reported adoption, not a guarantee of return on investment. The practical opportunity is reducing repetitive work preparing media for channels agents already use. [NAR technology announcement](https://www.nar.realtor/press-releases/realtors-embrace-ai-digital-tools-to-enhance-client-service-nar-survey-finds)

## Competitor comparison

| Product | Verified workflow | Feature to carry into Nook & Nest |
| --- | --- | --- |
| Matterport | A digital twin yields 3D experiences, photography and floor plans. Auto-Tours proposes editable stops, angles and descriptions. | Reuse the same home and saved camera viewpoints across tours and listing media; let the agent control the sequence. [Property marketing](https://matterport.com/solutions/property-marketing), [Auto-Tours](https://matterport.com/en-gb/blog/from-scan-to-story-auto-tours-in-matterport) |
| Zillow 3D Home | Compatible 360-camera capture produces an interactive tour and floor plan. Agents can distribute an unbranded link through MLS, email or social channels. | Named room views, mobile viewing and unbranded presentations. An exported Nook & Nest presentation does not imply native Zillow placement or automatic syndication. [Zillow 3D Home](https://www.zillow.com/3d-home/floor-plans/) |
| CubiCasa | Hosted, mobile-friendly plans with floor switching, links and embeds; optional listing photos. Downloads include JPG, PNG, PDF and SVG. | A portable listing package, labeled floor drawings and ordered photos. CubiCasa's capture requires its app and spatial information; a normal phone video is not equivalent. [Hosted plan](https://help.cubi.casa/en/articles/11394715-hosted-floor-plan), [Scan FAQ](https://help.cubi.casa/en/articles/3352314-frequently-asked-questions-scanning-and-floor-plans) |
| Floorplanner | Photorealistic renders with lighting/background choices; higher-resolution exports, alternate designs and interactive tours. | Keep editable furniture and geometry, while offering separate marketing viewpoints and presentation formats. [Render examples](https://floorplanner.com/3d-render-examples), [Project levels](https://floorplanner.com/project-levels) |
| RoomSketcher | Flyover and first-person camera modes, synchronized snapshots, 360 views and AI renders; shared Live 3D works in a browser. | Walking, photography and presentation should share the same camera and saved home. [Live 3D](https://www.roomsketcher.com/features/live-3d-floor-plans/) |
| Apply Design | Staging, furniture removal, multi-angle consistency and panorama staging. Its video workflow uses 3–15 images with reorderable clips, editable narration, captions, vertical/widescreen formats and an optional branded ending. | A storyboard with replaceable shots, disclosure, duration, captions and format controls. [Features](https://www.applydesign.io/features), [Property video](https://www.applydesign.io/ai-property-video) |

## Implementation worklist and acceptance criteria

| Priority | Task | Completion means |
| --- | --- | --- |
| P0 | Realtor entry point | Listing Studio is clearly reachable without compromising the existing floor-plan and furnishing tools. |
| P0 | Property details | Title, optional address, price text, bedrooms, bathrooms, area, highlights, description and agent details can be edited and retained per project. No facts are invented. |
| P0 | Walkthrough | Eye-height movement and look controls work using the current floor's geometry. Entry/exit preserves editor framing and does not mutate the plan. Keyboard and visible touch controls are supported. |
| P0 | Saved viewpoints | Capture a clean render, save its camera/floor and room label, revisit the view, and reorder or remove it without changing architecture. |
| P0 | Real photo intake | Accept bounded local JPG/PNG/WebP files; retain original bytes alongside browser-sized previews. Distinguish property photos, design renders, staged images and AI concepts. |
| P0 | Slideshow | Ordered images have editable captions and timing; preview supports next/previous and play/pause in landscape, portrait or square format. |
| P0 | Marketing pack | Download a real ZIP containing media and supplied originals, individual floor-plan SVGs, a printable property sheet, listing text, provenance, an offline HTML slideshow and a Seedance storyboard brief. |
| P0 | Branded / unbranded exports | Omit dedicated agent/contact/brokerage fields from every file in unbranded output, including metadata and storyboard. Disclosures remain. Free-form text and baked-in image branding require review. |
| P0 | Floor-plan accuracy | Use measured and polygonal floor footprints, actual wall segments and openings. Preserve holes and diagonal walls. State that area/dimensions are planning estimates, not certified living area. |
| P0 | Persistence and backup | Listing data is separate from room geometry and retains local offline use. Backups validate input before import; opening one never changes a home implicitly. |
| P1 | Seedance generation | A server-side, authenticated integration submits selected reference images only after an explicit generation action; jobs have truthful status, errors and completed output. Credentials never enter browser code. The interface distinguishes unavailable/configuration-required service from a working generator. |
| P1 | Optional Luna recognition | Add Luna as an explicit alternative only through verified provider model configuration. Keep the default recognition flow, scale uncertainty, review-before-apply and manual correction. A model being selectable does not demonstrate improved recognition accuracy. |
| P1 | Listing readiness | Show missing title/photos/description/basic facts and staged-original pairing. This helps preparation without claiming universal MLS compliance. |

The marketing-pack implementation is in `src/listingExport.ts`. Its focused tests cover actual ZIP extraction, file references, branded-field omission, script injection protection, original-image pairing, slideshow controls/timing, exact measured geometry, diagonal walls and empty plans. Runtime camera, import, persistence, AI provider and release evidence belong to their corresponding implementation and integration checks.

## Acceptance status

The worklist above is implemented locally. Automated checks and partial browser review have been performed; the final integrated browser and release checks remain separate acceptance gates.

| Area | Evidence and remaining limits |
| --- | --- |
| Listing details, photos, saved views, backup and exports | Local implementation and automated coverage exist. Export tests extract the actual ZIP, exercise slideshow behavior, inspect floor geometry and check disclosure, original/source separation, escaping and unbranded output. Browser review of the complete workflow is partial. |
| Walkthrough and guided views | Implemented in the existing scene with automated geometry/control coverage. Final visual and touch review belongs to the integrated browser pass. |
| Seedance video | Client/server contracts and mocked provider behavior are tested, including no-charge validation, interrupted-request recovery, hidden-page polling, storage failures and concurrent tabs. No live paid generation was submitted, and provider entitlement, generated quality and live download must still be verified with a configured account. |
| Optional Luna recognition | Configuration and review-before-apply integration are implemented. No fresh real-scan benchmark establishes that Luna recognition accuracy has improved. |
| Publication | Requires successful Validate checks, merge, the exact successful master release artifact and live Sites verification. Local test results alone do not establish publication. |

## Marketing pack contents

- `index.html`: offline slideshow with responsive formats, keyboard arrows/space, swipe navigation, per-slide timings, pause, captions and visible media provenance. It starts paused; hiding the page pauses playback.
- `property-sheet.html`: printable property details, selected images, paired originals, disclosures and floor plans. Browser printing can produce a PDF; no pre-generated PDF is claimed.
- `media/`: selected images, unchanged uploaded source files (`-source`) and explicitly paired unaltered comparison images (`-original`). Uploading an already-staged image does not make that file an unaltered comparison. Raw exported image pixels are not automatically stamped; accompanying text and the presentation carry disclosures.
- `floorplans/`: per-floor SVG drawings with verified source geometry, room labels when geometry remains current, openings and a measurement disclaimer.
- `listing.txt`: editable copy assembled only from supplied facts, captions and disclosures.
- `provenance.json`: export details, media type, file pairing, slide timings and floor references. No raw project, source floor-plan references, account data or hidden fields are copied.
- `seedance-storyboard.txt`: shot sequence and a reviewable video brief. This file is an export for a video service, not a generated video or proof that one was submitted.
- `README.txt`: extraction instructions and precise limitations. The offline presentation needs the complete extracted folder; opening one HTML file inside a ZIP is not the supported workflow.

## Disclosure, accuracy and privacy requirements

Keep originals paired with altered images and distinguish existing property photographs from proposed designs. CRMLS's 2026 rule changes provide one concrete example: digitally altered images require an adjacent original and accurate alteration labeling in the listing photo text field. Requirements differ by location and MLS; a preset must not be called universally “MLS compliant.” [CRMLS rule changes](https://go.crmls.org/wp-content/uploads/2026/02/2026_CRMLS_Rules_And_Policy_Changes_Jan.pdf)

Separate brand-free exports from agent marketing output. Accepted file formats, dimensions and branding restrictions vary by MLS, as CubiCasa's own guidance explains. Our exports support this preparation but do not upload to or certify compatibility with an MLS. [CubiCasa MLS guidance](https://help.cubi.casa/en/articles/15862814-how-to-use-cubicasa-floor-plans-that-are-mls-compliant)

Preserve permanent features, dimensions and visible condition in realistic imagery. Generated furniture should explain a possible use of the room; it must not quietly enlarge rooms, invent openings, conceal damage or imply completed renovations. NAR emphasizes truthful presentation and transparent alteration disclosure. [NAR photo guidance](https://www.nar.realtor/news/real-estate-news/sales-marketing/are-you-catfishing-buyers-with-picture-perfect-real-estate-photos)

Users need authority to publish their supplied photos. A listing URL is not permission to reuse another photographer's work. [NAR photograph policy](https://www.nar.realtor/about-nar/policies/mls-policy/use-of-photographs-in-a-multiple-listing-service)

Keep uploads on the device until the user selects a cloud save or generation action. Explain which chosen images go to the generation provider. Keep private floor-plan reference pages, notes and account information out of public presentations. The unchanged original files may retain their original embedded metadata; unbranded output cannot remove text or logos already baked into a photograph.

## Explicit product limits

- Editing and exported design geometry are not a camera/LiDAR property scan or a Matterport reconstruction.
- Photorealistic generation is an optional output, not a global replacement for the accepted furniture catalog or Blender originals.
- Automatic AI floor-plan recognition must remain reviewable; no performance improvement is asserted without real-scan comparison.
- Provider configuration, successful live generation and image quality must be verified separately from unit tests.
- Paid video requests use a no-charge validation preflight, then preserve the exact selected image bytes and settings in device storage before submission. An atomic per-home reservation prevents concurrent tabs from creating separate new paid requests; old responses and stale tabs cannot overwrite or clear a newer request. An interrupted request retains its ID and exact payload; known ambiguous provider acceptance cannot silently create a second job. Status polling pauses when hidden and resumes when the page becomes visible.
- The downloadable presentation is offline media, not a hosted public page or MLS syndication.
- Narration generation, a licensed music library, a CRM, lead automation, IDX search, appraisals, transaction management and native 360 scanning are separate future products. They are not needed to complete the focused Listing Studio workflow.
- Deployment completion requires the repository's normal Validate, master artifact and Sites verification process. Passing export tests is not deployment evidence.
