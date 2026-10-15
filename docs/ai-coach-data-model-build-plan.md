# CuberVerse AI Coach: Data, Model Training, and Build Plan

Date: 2026-10-15

Status: Recommended implementation strategy

## Decision

**Yes, CuberVerse needs to build its own system and its own dataset.** Existing public resources are valuable accelerators, but none is sufficient by itself for a production camera coach.

The recommended product is a hybrid system:

- Deterministic cube state, move permutations, legal-state search, scramble verification, replay, and coaching metrics.
- Classical computer vision for geometry, color sampling, motion/stability, and simple pose cues where it works reliably.
- Small trained models for the parts that measurably outperform deterministic methods: cube/keypoint detection, occlusion/read-quality scoring, motion boundaries, and later phase/case classification.
- Confidence gates and abstention rather than an end-to-end model that guesses a move from every frame.

Do not begin with a large “video-to-coaching” model. First build the replayable event pipeline and collect exact move-aligned evidence. The initial coach can be entirely rule-based once reliable moves and timestamps exist.

## Are the existing datasets good enough?

They are good enough to start engineering and establish baselines. They are not good enough to claim generalization or ship the final tracker.

| Resource | Use now | What it cannot provide |
|---|---|---|
| `cubed-data-v1` | Build ingestion, synchronization, replay, move-window extraction, and early model baselines | Diversity: it contains one solver, one cube, and one camera/setup family |
| Cubed Core | Study its state-constrained reconstruction approach and evidence boundaries | Direct product reuse without reviewing its AGPL-3.0 obligations; browser real-time performance is not established |
| reco.nz and reconstruction archives | Symbolic solves, scrambles, phases, algorithms, TPS, and candidate video discovery | Automatically licensed video files or consistent frame-level timestamps |
| YouTube and competition videos | Discover real-world failure cases and creators to contact | Default permission to download, store, annotate, or train on the files |
| Synthetic cube video | Unlimited exact labels for states, poses, moves, and occlusion experiments | Real hands, motion blur, glare, camera processing, grip diversity, and human turning dynamics |
| CuberVerse opt-in captures | The production-quality data moat: exact capture conditions, consent, corrections, and smart-cube truth | This does not exist yet and must be built |

The correct strategy is: **bootstrap with existing licensed data, build the product instrumentation, then grow a consented CuberVerse corpus.**

## What CuberVerse should build

### System architecture

```text
Camera / replay file
        |
        v
Frame scheduler -> geometry/keypoints -> visible sticker evidence
        |                                      |
        |                                      v
        +---------------------------> confidence/read-quality
                                               |
                                               v
Known prior cube state -> legal move candidates -> state estimator
                                               |
                          +--------------------+-------------------+
                          |                    |                   |
                          v                    v                   v
                     3D mirror          immutable recorder   scramble verifier
                                                                   |
                                                                   v
                                                        analytics + rule coach
```

The virtual cube remains authoritative. Models provide observations and scores; they do not directly mutate cube state.

### Fit with the current repository

Keep new code aligned with the current root-level `app`, `components`, and `lib` layout rather than introducing an unrelated `src` hierarchy:

```text
app/coach-lab/page.tsx
components/coach/
  camera-preview.tsx
  tracking-overlay.tsx
  mirror-panel.tsx
  review-timeline.tsx
lib/coach/
  contracts.ts
  events.ts
  orientation.ts
  candidates.ts
  estimator.ts
  recorder.ts
  analytics.ts
  coaching.ts
workers/
  coach-vision.worker.ts
scripts/dataset/
  validate-manifest.ts
  extract-move-windows.py
  verify-replay.ts
research/
  manifests/
  evaluations/
  model-cards/
```

Reuse `lib/puzzle`, the existing notation parser, scramble generation, and the 3D `PuzzleController`. Extract the current timer lifecycle and solve persistence into reusable modules instead of building a second timer.

## Build and training roadmap

### Phase 0 — contracts and replay harness

Build before training anything:

- Versioned observation, orientation, accepted-move, correction, tracking-loss, and solve-record schemas.
- One frame-source interface implemented by both webcam and local replay files.
- Dataset manifest validator, SHA-256 verification, license/rights fields, and deterministic train/validation/test grouping.
- Exact 24-orientation transforms and the 19 one-step hypotheses: no move plus 18 face turns.
- Replay tests proving that accepted events reproduce the final cube state.
- `/coach-lab` behind a feature flag with frame latency, confidence, and dropped-frame diagnostics.

Deliverable: recorded input can run repeatedly and produce identical observations and metrics.

### Phase 1 — deterministic perception baseline

Before training a model, measure a tailored baseline:

- Downscaled frame processing and region-of-interest tracking.
- Sticker/lattice candidates using edges, chroma gradients, quadrilateral geometry, and temporal consistency.
- Center-color calibration and probabilistic sticker-color likelihoods.
- Motion start/end detection and stable-frame windows.
- Pose/orientation scoring against the known cube state.
- Explicit `uncertain` and `reacquiring` outputs.

This baseline tells us which failures actually need machine learning. It also generates pre-labels for the annotation tool.

### Phase 2 — CuberVerse capture and labeling tool

Build this early because data collection will take longer than model code:

- Show a generated scramble and record the known start state.
- Record ordinary phone video at the highest stable supported frame rate.
- Optionally pair a supported Bluetooth smart cube for timestamped move and orientation ground truth.
- Capture camera/device characteristics, cube type, lighting, placement, and calibration.
- Align smart-cube timestamps to frames, then let a reviewer correct the alignment.
- Provide frame scrubbing, cube bounding box/keypoint correction, visible-face labels, motion boundaries, occlusion flags, and move-event verification.
- Collect consent before recording or upload; let contributors preview, redact, and withdraw captures.

Deliverable: every accepted capture has a replay-verified scramble and move stream, a rights record, and leakage-safe grouping identifiers.

### Phase 3 — train only the components that need it

Recommended model tasks, in order:

1. **Cube/keypoint detector** — cube region, visible face polygons, and/or sticker centers. Start from a small mobile-friendly detector or keypoint model.
2. **Read-trust classifier** — predicts whether a frame/window is sharp, sufficiently visible, and safe to use. This is as important as sticker classification because it teaches the system when to abstain.
3. **Motion-boundary classifier** — identifies stable-before, turning/occluded, and stable-after windows.
4. **Visible sticker likelihood model** — only if calibrated color features fail across devices and lighting. Output probabilities, not hard colors.
5. **Orientation/turn ranker** — ranks legal hypotheses using observation features. The legal cube engine still constrains its output.
6. **Phase/case classifier** — add after move reconstruction is reliable; use cube-state sequences rather than raw video whenever possible.

Do not train the coaching layer first. Pause, TPS, rotations, stage transitions, and repeated-case problems can initially be derived deterministically from verified events.

### Phase 4 — offline video reconstruction

Ship uploaded/self-recorded solve analysis before promising perfect live tracking if necessary. Offline processing can:

- Look ahead and behind in time.
- Search deeper candidate paths.
- Re-run difficult windows at higher resolution.
- Ask for one or two manual corrections.
- Produce a replay, confidence timeline, pauses, TPS, and coaching evidence.

This is a strong intermediate product: “record a solve and receive analysis.” It uses the same contracts as the eventual live coach while tolerating more compute and latency.

### Phase 5 — live mirror and verified scramble

Move the proven components into a Web Worker and connect accepted events to the existing 3D viewer and timer. Start with a constrained beta: 3x3, stable phone placement, supported lighting, deliberate-to-intermediate turning speed, and clear recovery prompts.

### Phase 6 — coaching and personalization

Begin with explainable rules:

- Largest verified pauses and their move windows.
- Execution TPS versus active turning TPS.
- Rotation count and duration.
- Recognition-to-execution split for last-layer cases when phase labels are reliable.
- Trend comparisons against the user's own previous sessions.

Only train a recommendation-ranking or personalization model after there is enough user-confirmed outcome data to test whether its advice improves the next sessions.

## Training pipeline

```text
Rights-cleared captures
        -> validate manifests and hashes
        -> replay-verify scramble + move stream
        -> align move timestamps to frames
        -> extract stable frames and move windows
        -> annotate/correct
        -> split by solver + cube + device + session
        -> train component model
        -> evaluate on untouched groups
        -> export browser-compatible artifact
        -> benchmark latency, memory, thermal load, and accuracy
        -> shadow-mode evaluation in Coach Lab
        -> gated release
```

Each released model needs a model card containing:

- Dataset versions and licenses.
- Train/validation/test grouping rules.
- Supported camera/cube conditions.
- Per-condition precision, recall, abstention, and latency.
- Known failures and excluded uses.
- Artifact hash and the exact preprocessing contract.

## Release gates

The exact targets should be re-baselined after the first pilot, but the philosophy must be explicit:

- Optimize accepted-move precision before recall. For a roughly 60-move solve, 99% independent per-move precision leaves only about a 55% chance of no false accepted move; the target should be approximately 99.9% or better in supported conditions.
- A missed move may trigger bounded recovery. An invented move must never be silently accepted.
- Evaluate complete-solve integrity, not only per-frame or per-move accuracy.
- Report results separately by unseen solver, unseen cube, unseen phone/camera, lighting, speed bracket, and occlusion severity.
- Keep the test set grouped by person, device, physical cube, and recording session to prevent near-duplicate leakage.
- Validate steady-state browser latency and thermal behavior on the target phone matrix.
- Coaching claims require sufficient tracking integrity and must point to the exact event window supporting the advice.

Suggested pilot gates:

| Gate | Initial target |
|---|---|
| Accepted-move precision | ≥99.9% in the supported setup |
| Complete solves with no false accepted move | ≥90% |
| Reacquisition without state corruption | ≥95% of scripted loss cases |
| Move commit latency | p95 under 400 ms after a stable post-turn observation |
| Main-thread responsiveness | No steady-state task over 50 ms caused by vision |
| Unsupported-condition behavior | Abstain/reacquire rather than guess |

## Data flywheel

The product should improve without silently turning every user into a data source:

1. Solve processing stays local by default.
2. A user may explicitly choose “Help improve tracking.”
3. CuberVerse shows the exact clip, labels, and metadata proposed for upload.
4. The user can trim/redact, remove audio, choose attribution, and approve a license/consent record.
5. Corrections are kept as auditable events rather than overwriting the original inference.
6. Accepted contributions enter a quarantined review area, pass rights and replay checks, and only then enter a versioned dataset.
7. New models are tested against frozen holdouts before entering shadow mode in the app.

This opt-in loop is more valuable than a large scraped corpus because it couples real target-device footage with exact failure reports and user corrections.

## Dataset strategy

Build a CuberVerse solve-video dataset, but separate three things that are easy to confuse:

1. **A discovery catalog** may contain links and public metadata for relevant videos.
2. **A research/evaluation corpus** may contain files only when the license or creator permission allows local use.
3. **A training corpus** should contain only rights-cleared files with reproducible labels, provenance, and deletion/withdrawal handling.

Public competition and home-solve videos are extremely useful for discovering real failure modes: different grips, cube brands, sticker shades, lighting, backgrounds, camera angles, frame rates, motion blur, occlusion, turning styles, pauses, regrips, and rotations. They are usually weak training examples unless the original file and move-level ground truth are available. YouTube compression, edits, uncertain scrambles, missing frames, and unclear reuse rights limit what can safely be learned from them.

The best long-term dataset will come from an opt-in CuberVerse capture program that records normal phone video alongside a Bluetooth smart-cube move log. The smart cube is development ground truth; the released CuberVerse product can remain camera-only.

## Rights and platform boundary

“Publicly viewable” does not mean “licensed for downloading or model training.”

- YouTube's API policies prohibit downloading, importing, caching, or storing audiovisual content without prior written approval: <https://developers.google.com/youtube/terms/developer-policies>
- YouTube's third-party training setting is off by default. Training eligibility requires the applicable rights holders to allow it: <https://support.google.com/youtube/answer/15509945>
- A YouTube URL may therefore be stored in the discovery catalog, along with manually observed technical notes. Do not download the video or extract frames unless CuberVerse has creator/rightsholder permission and the platform terms permit the acquisition path.
- Competition footage can include spectators, judges, and minors. Flag identifiable people, remove audio when not needed, minimize retained imagery, and obtain contributor/guardian consent where applicable.
- Record the license or permission at the individual artifact level. A dataset-level license cannot grant rights that the dataset creator did not possess for each included video.

This is a product/data-engineering recommendation, not legal advice. Have counsel review the final contributor release and platform workflow before collecting at scale.

## What each data source is good for

| Source class | Primary value | Ground truth | Default handling |
|---|---|---|---|
| Self-recorded video + smart cube | Move inference, timing, pose, occlusion, coaching metrics | Excellent: timestamped moves and often orientation | Store and train with explicit contributor license |
| Self-recorded ordinary cube + manual reconstruction | Real target environment | Good after replay verification | Store and train with explicit contributor license |
| Licensed public research dataset | Bootstrap models and replay tests | Varies; inspect its card and sidecars | Pin version, preserve license and attribution |
| YouTube/competition video | Diversity discovery and qualitative failure analysis | Usually weak or reconstructed later | Link and catalog only until permission is obtained |
| Reconstruction database | Move sequences, scrambles, phases, solver metadata | Often strong symbolic data | Use only under its stated terms; link if license is unclear |
| Synthetic renderer | Unlimited exact pose/state/move labels | Perfect but visually synthetic | Use for pretraining and unit/replay tests, never as sole validation |

## Existing resources found

### 1. Cubed Solve Captures (`cubed-data-v1`) — highest-priority starting corpus

- URL: <https://huggingface.co/datasets/cubed-core/cubed-data-v1>
- Contents: 35 self-recorded portrait videos, 1080×1920 H.264 at approximately 120 fps, about 3.15 GB total.
- Labels: GAN 12 ui Bluetooth-cube move logs with relative timestamps; scramble/start-state records; phone IMU for 29 captures; replay verification; checksums; per-artifact rights records.
- License: CC-BY-SA-4.0 at the dataset level, with per-artifact `rights_record.json` files described as authoritative.
- Quality: technically excellent for bootstrapping alignment and move-event work.
- Limitations: one solver, one cube, one camera/setup family; some videos end early; no per-capture color calibration; the project's own published benchmark shows that complete camera-only reconstruction is still difficult.
- Action: mirror a pinned revision only after reviewing the per-artifact rights files and share-alike implications. Keep the dataset isolated from proprietary data until the licensing approach is approved.

Related research software: <https://github.com/KingBobJoeIV/cubed-core>. The code is AGPL-3.0 and should be treated separately from the dataset license.

### 2. reco.nz reconstruction catalog — high-value symbolic catalog

- URL: <https://reco.nz/>
- Secondary index/explanation: <https://www.speedcubing.com/Reconstructions.html>
- Contents: searchable official and unofficial reconstructions across puzzles, solvers, methods, records, cross colors, OLL/PLL cases, move counts, and TPS. Many entries link back to source videos.
- Value: excellent for discovering videos that already have scramble and move reconstructions, and for building coaching heuristics from symbolic solve data.
- Limitation: no bulk-reuse license was verified during this review. Linked videos retain their own rights.
- Action: catalog selected URLs and contact the maintainers/reconstructors before bulk ingestion or redistribution.

### 3. Speedcubing video-analysis data — useful coaching baseline, not raw video

- Repository: <https://github.com/KeplerBoyce/speedcubing-analysis>
- Paper: “Rubik's cube: What separates the fastest solvers from the rest?”
- Contents: a TSV derived by frame-by-frame analysis of 69 YouTube solves from 16 solvers, including solve time, TPS, CFOP stage times, pauses, move counts, regrips, rotations, tilts, and unnecessary AUFs.
- Value: directly relevant to the first coaching-rule set and annotation definitions.
- Limitations: the repository does not show a license; the source YouTube files are not included and should not be reconstructed as a local video corpus without permission.
- Action: use as a methodology reference; request permission or licensing clarification before incorporating the TSV into a distributed or commercial dataset.

### 4. SupaKewber downloadable speedcubing data — aggregate coaching benchmarks

- URL: <https://supakewber.com/speedcubing-data/>
- Contents: CSV/JSON resources for CFOP stage percentages, TPS by solve-time bracket, recognition versus execution time, pauses between stages, smart-cube practice metrics, and improvement over solve counts.
- Value: useful for validating whether CuberVerse coaching ranges are plausible.
- Limitation: aggregate metrics are not a move-labeled video corpus; verify each download's terms before reuse.

### 5. Rotating Rubik's Cube dataset — tracking/occlusion research lead

- Thesis: <https://gupea.ub.gu.se/server/api/core/bitstreams/82dc787a-222e-481a-8754-c7af0e9b83a2/content>
- Contents described in the thesis: 18 cube videos across eight sticker constellations and four angles, including six externally occluded videos; a YOLO training set of 454 train, 131 validation, and 64 test images.
- Value: cube localization, point tracking, and occlusion evaluation.
- Limitation: this is rotating-cube tracking rather than complete speedsolves, and a public downloadable artifact/license was not verified.
- Action: contact the authors or Wiretronic before assuming availability.

### 6. Egocentric GoPro RGB + IMU Rubik's Cube sample — secondary evaluation lead

- URL: <https://huggingface.co/datasets/Hubdata/egocentric-gopro-rgb-imu/tree/main/%2314_GoPro_Rubiks_Cube>
- Contents: approximately 956 MB for the Rubik's Cube sample, including RGB video, MCAP data, and IMU files.
- License shown: `hub-egocentric-eval`, a custom license that must be reviewed.
- Value: egocentric viewpoint and sensor-fusion experiments.
- Limitation: not presented as a labeled speedsolve corpus.

### 7. Robot cube-manipulation datasets — low priority

Example: <https://huggingface.co/datasets/leninangelov/eval_rubiks-cube_02> contains 28 robot episodes at 30 fps under Apache-2.0. These can help with generic cube localization or motion augmentation, but robot manipulation does not match human speedcubing grips, occlusion, or turn dynamics.

## Recommended CuberVerse dataset layers

### Layer A: deterministic synthetic fixtures

Generate exact cube states, camera poses, lighting changes, motion blur, hands/occluder masks, and individual turns. Use these for unit tests and early pretraining. Keep a separate synthetic test slice so improvements cannot be hidden by overfitting to generated imagery.

### Layer B: licensed bootstrap corpus

Start with the rights-cleared `cubed-data-v1` revision and any other datasets whose individual artifacts permit the intended use. Do not mix data with incompatible licenses into a single redistributable bundle.

### Layer C: CuberVerse opt-in captures

Create a contributor capture mode with:

- Normal phone video, preferably 60 or 120 fps when available.
- A generated, saved scramble and exact initial state.
- Optional Bluetooth smart-cube connection for timestamped move and orientation truth.
- Device/camera capabilities, resolution, nominal and measured fps, exposure/lighting category, cube brand/model, sticker/stickerless, and camera placement.
- A short six-color calibration sequence.
- Consent covering research, model training, redistribution status, retention, deletion, attribution preference, and whether hands/face/audio may appear.
- An immediate local preview and redaction step before upload.

Target the first internal corpus at **500 complete solves from at least 10 people**, not 500 solves from one person. Split by person, physical cube, camera, and recording session so the test set measures generalization.

### Layer D: permissioned creator and competition footage

Use the discovery catalog to identify creators whose originals would add missing conditions. Ask for the original file, not a YouTube download. Request the scramble, result, event, recording device if known, and permission to annotate and use the recording. Prioritize clips with an existing reconstruction.

## Minimum data record

Store one manifest row per video/capture. JSON or Parquet should be canonical; CSV can be an exported view.

| Field | Meaning |
|---|---|
| `dataset_id`, `capture_id` | Stable identifiers; never depend on filenames alone |
| `source_type` | `self_capture`, `licensed_dataset`, `creator_original`, `youtube_link`, `reconstruction_link`, `synthetic` |
| `source_url`, `creator_url` | Discovery/provenance links |
| `title`, `creator`, `published_at` | Source metadata |
| `rights_status` | `cleared`, `link_only`, `permission_requested`, `rejected`, `unknown`, `withdrawn` |
| `license_spdx`, `permission_record` | License identifier or stored release/permission evidence |
| `rights_verified_at` | Date terms were last checked |
| `local_file` | Relative path only when storage is authorized; otherwise blank |
| `original_filename`, `container`, `codec`, `file_bytes`, `sha256` | File identity and integrity |
| `duration_ms`, `width`, `height`, `nominal_fps`, `measured_fps`, `variable_fps` | Technical video properties |
| `audio_present`, `audio_retained` | Privacy and processing state |
| `puzzle`, `method`, `skill_bracket` | Solve context |
| `competition`, `round`, `attempt`, `wca_result_ms` | Optional competition context |
| `scramble`, `start_facelets`, `final_facelets` | Reproducible state |
| `move_log_path`, `move_log_source` | BLE, reconstruction, manual, inferred, or absent |
| `move_timestamps_available`, `orientation_log_available`, `imu_available` | Ground-truth capabilities |
| `camera_view` | Tripod/front, overhead, side, handheld, egocentric, broadcast |
| `cube_visibility`, `hand_occlusion`, `motion_blur`, `lighting`, `background_clutter` | Controlled quality labels |
| `other_people_visible`, `possible_minor`, `face_visible` | Privacy review flags |
| `technical_quality_score`, `label_quality_score` | Separate 0–100 scores |
| `split_group_solver`, `split_group_device`, `split_group_session` | Leakage-safe splitting |
| `notes` | Verifiable observations only |

Never convert `unknown` into a guessed value. Preserve the source and the reviewer who made each annotation.

## Quality rubric

Keep technical quality separate from rights clearance. A perfect-looking video with unclear rights is still `link_only`.

Technical quality score, 0–100:

- Cube visible and large enough to read: 0–25
- Frame rate and temporal continuity: 0–20
- Low motion blur/compression damage: 0–15
- Useful camera angle and stability: 0–15
- Lighting and color separability: 0–10
- Limited occlusion/interruption: 0–10
- Complete solve boundaries: 0–5

Label quality score, 0–100:

- Exact timestamped smart-cube log: 100
- Replay-verified move reconstruction with timestamps: 85–95
- Replay-verified move reconstruction without timestamps: 65–80
- Scramble and final time only: 25–50
- Visual video with no reproducible state: 0–20

Recommended grades:

- **A:** technical ≥80 and label ≥80 — train/evaluate if rights-cleared.
- **B:** technical ≥65 and label ≥50 — useful for robustness and partial labels.
- **C:** technically difficult but intentionally useful as a hard case.
- **D:** link/reference only or insufficient evidence.

## Dataset milestones

### Dataset v0: replay engineering

- Pin and inspect `cubed-data-v1`.
- Build manifest validation, checksums, rights records, and replay verification.
- Add synthetic single-turn, rotation, occlusion, and two-move fixtures.
- Establish solver/camera/session-separated splits.

### Dataset v1: generalization pilot

- 500 complete rights-cleared solves.
- At least 10 solvers, 5 physical cubes, 5 camera models, 4 lighting groups, 3 camera placements, and 3 speed brackets.
- At least 20% intentionally difficult captures: glare, low light, partial framing, heavy grip occlusion, or rapid last-layer algorithms.
- Smart-cube ground truth for most captures; manually reconstructed and replay-verified truth for a smaller ordinary-cube subset.

### Public-video discovery catalog

- 200–500 candidate links.
- No downloaded YouTube media.
- Favor videos with an existing reconstruction and a reachable creator.
- Rank creator-permission outreach by missing dataset conditions, not view count.

## Prompt for Muse / Instinct

Copy the prompt below as-is. Replace the output directory only if needed.

```text
You are conducting a source-verification and dataset-discovery audit for CuberVerse AI Coach, a camera-based 3x3 speedcubing tracker. Your job is to find existing datasets and public solve-video candidates, then produce a rights-aware catalog. Do not download, rip, cache, transcode, or extract frames from YouTube or any other video platform. Publicly viewable is not the same as licensed for training.

Research date: use today's date and record it in every output.

Objectives:
1. Find existing downloadable datasets containing Rubik's Cube / 3x3 solve video, cube rotation/tracking video, human cube manipulation, smart-cube move logs, IMU, move timestamps, scrambles, facelet states, or manually reconstructed solves.
2. Find public YouTube or competition solve videos that would be valuable candidates for a future permissioned dataset.
3. Find reconstruction databases or papers that connect a video to a scramble, move sequence, CFOP phases, TPS, pauses, regrips, rotations, or timing.
4. Verify licenses and usage terms from primary sources. Never infer a license because a repository or video is public.

Search primary sources first: Hugging Face dataset cards/files, Zenodo, Figshare, Kaggle dataset pages, Roboflow Universe, GitHub repositories and LICENSE files, Papers With Code, university repositories, WCA pages, reco.nz, speedcubing.com, creator websites, and official YouTube metadata/policies.

Known leads to verify and expand:
- https://huggingface.co/datasets/cubed-core/cubed-data-v1
- https://github.com/KingBobJoeIV/cubed-core
- https://reco.nz/
- https://www.speedcubing.com/Reconstructions.html
- https://github.com/KeplerBoyce/speedcubing-analysis
- https://supakewber.com/speedcubing-data/
- https://gupea.ub.gu.se/server/api/core/bitstreams/82dc787a-222e-481a-8754-c7af0e9b83a2/content
- https://huggingface.co/datasets/Hubdata/egocentric-gopro-rgb-imu/tree/main/%2314_GoPro_Rubiks_Cube

Video discovery categories:
- WCA competition 3x3 singles and averages
- Home solves with fixed phone/tripod camera
- Overhead solves
- Side/front solves resembling a laptop or phone camera
- Smart-cube solves with synchronized move logs
- Slow/intermediate solves with visible pauses
- Elite high-TPS solves and last-layer bursts
- Low light, glare, stickerless and stickered cubes, unusual color schemes
- Heavy occlusion, regrips, rotations, cube leaving frame, and recovery
- Videos with a published scramble and full reconstruction

For each existing dataset, collect:
- name and canonical URL
- maintainer/creator
- description and relevance
- number of videos/episodes/images
- total duration and size if stated
- resolution, fps, codec/container if stated
- camera view and whether the subject is human or robot
- puzzle types
- annotations: scramble, moves, per-move timestamps, facelets, orientation, IMU, phases, bounding boxes, masks
- file formats and actual downloadable file names
- license exactly as stated, plus URL to the license
- whether individual artifact rights are documented
- privacy/consent notes
- known limitations
- last verified date
- recommendation: use now, contact owner, metadata only, or reject

For each YouTube/public video candidate, collect metadata only:
- canonical URL and video ID
- title, channel, published date
- what it contains: competition single, average, home solve, tutorial/example solve, smart-cube capture, reconstruction, etc.
- duration
- puzzle and solve time if verifiable
- competition/round/solver/WCA link if verifiable
- scramble and reconstruction URL if available
- visible camera angle
- estimated technical quality: resolution, fps only when explicitly available, motion blur, occlusion, cube size in frame, camera stability, lighting, interruptions
- privacy flags: face visible, other people visible, possible minor, audio present
- rights status: always `link_only` unless a primary source explicitly grants CuberVerse the required use
- contact route for the creator when publicly provided
- why this video adds a missing condition
- do not invent file size, codec, fps, scramble, license, or permission

Use separate fields for:
- `technical_quality_score` from 0 to 100
- `label_quality_score` from 0 to 100
- `rights_status`: cleared, link_only, permission_requested, rejected, unknown, withdrawn
- `recommended_action`: use_now, request_permission, catalog_only, investigate, reject

Deliver these files:
1. `cuberverse-dataset-inventory.md` — concise findings, licenses, risks, and ranked recommendations.
2. `cuberverse-existing-datasets.csv` — one row per dataset/resource.
3. `cuberverse-video-candidates.csv` — one row per public video candidate; links and metadata only.
4. `cuberverse-source-log.md` — every search query, source checked, access date, and unresolved question.
5. `cuberverse-outreach-shortlist.md` — 20–30 highest-value creators/dataset owners to contact, with the specific data gap each could fill.

Minimum target:
- verify at least 15 dataset/reconstruction/research resources
- catalog at least 100 diverse video candidates
- include at least 20 videos with a published scramble or reconstruction
- include beginner/intermediate/advanced/elite solves rather than only world records
- include a diversity matrix by camera angle, apparent speed bracket, lighting, cube type/finish, occlusion, and recording context

Evidence rules:
- Cite the exact page supporting every license, size, count, resolution, duration, or annotation claim.
- Mark unavailable facts `unknown`; never estimate them silently.
- Prefer original dataset cards, repositories, papers, creator uploads, WCA pages, and platform policies over blogs or aggregators.
- If a dataset bundles videos from third parties, verify artifact-level rights; the collection license alone is insufficient.
- Treat YouTube as discovery unless explicit permission and a compliant acquisition path are documented.
- Flag dead links, removed videos, duplicate uploads, compilations, edits, slow motion, overlays, cropped footage, and variable-frame-rate media.
- Do not contact anyone, send messages, request permission, or download media. Prepare the outreach shortlist only.

End with a go/no-go table naming which sources can enter a local training corpus today, which are evaluation-only, which require permission, and which should remain link-only.
```

## Immediate recommendation

Use `cubed-data-v1` to build the ingestion and replay path, then create CuberVerse's own opt-in smart-cube synchronized capture program. Use YouTube and competition footage as a discovery and outreach funnel, not as an automatically scraped training set. The proprietary advantage will come from diverse, consented recordings with exact move timestamps—not from accumulating the largest pile of unlabeled compressed videos.
