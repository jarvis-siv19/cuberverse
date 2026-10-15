<!-- product-context-schema: v1 -->

# CuberVerse Product Context

## Overview

CuberVerse is a web companion for speedcubers. The existing product combines puzzle education,
camera-assisted state capture, 3D playback, timing, personal statistics, and WCA integration. The
next product surface is an AI Coach that observes a physical 3x3 solve, maintains an auditable
virtual cube state, and turns the solve into specific, evidence-backed practice advice.

This file records product context for implementation work. Statements marked **inferred** should be
validated with users; they are not presented as settled requirements.

## Users

- Primary: speedcubers practicing 3x3 solves who want more useful feedback than a final time.
- Early beta: cubers willing to position a phone or laptop camera for a full solve (**inferred**).
- Later: coaches, clubs, and researchers working with consented solve recordings (**inferred**).

## Core Problem

Timing tools say how fast a solve was, but rarely explain what happened. General video analysis is
also insufficient: a useful coach must know the legal cube state, tolerate occlusion and whole-cube
rotations, distinguish observed facts from inferred moves, and abstain when the evidence is weak.

## Product Promise

Use the camera as a sensor, not as a source of vague commentary. Every accepted move should update
an exact virtual cube state and remain replayable. Coaching should cite observable moments such as a
pause, regrip, rotation, recognition delay, or inefficient transition.

## Operating Context

- Platform: responsive web app in a secure browser context with camera permission.
- First puzzle: 3x3.
- Capture: fixed camera, one solver, one cube, ordinary practice lighting (**inferred beta scope**).
- Privacy default: browser-local processing; no frame or video upload without explicit consent.
- Reliability: uncertainty is visible. The product pauses or asks for correction instead of silently
  corrupting the move log.
- Existing foundations to reuse: `lib/puzzle`, the 3D puzzle viewer, scanner camera patterns, timer,
  Firebase authentication, and solve history.

## Data and Model Position

Public solve videos and existing research datasets are useful bootstrap and evaluation material, but
they are not sufficient as the product's sole training corpus. Most lack synchronized cube state,
move timestamps, calibration, consistent viewpoints, or explicit reusable-data rights.

The durable system therefore combines:

1. Licensed and permissioned public material for pretraining, robustness tests, and taxonomy work.
2. Existing structured datasets where their licenses and capture assumptions fit.
3. A first-party, opt-in capture loop that stores immutable events, corrections, confidence, device
   context, and provenance. This is expected to become the highest-value dataset.

See `docs/ai-coach-data-model-build-plan.md` for the research, dataset, model, and staged
build plan that initiated this work.

## Product Principles

1. Exact state before clever advice.
2. Evidence before confidence.
3. Local-first and consent-driven by default.
4. Replayability is a release gate, not an implementation detail.
5. One reliable capture setup is better than broad but fragile support.
6. Measure recognition, execution, transitions, and recovery separately.
7. Public videos are leads, not automatically training data; license and consent are fields in the
   dataset, not notes in a spreadsheet.

## Current Build Slice

The first slice is a feature-flagged Coach Lab that provides:

- a real webcam feed with capture diagnostics;
- a versioned, immutable coach event contract;
- all 24 whole-cube orientations;
- the 18 legal single-face-turn candidates plus the no-move hypothesis;
- deterministic replay into the existing cube model and 3D viewer;
- a visible event log and manual accepted-move controls for integration testing.

It intentionally does not claim that production-grade move recognition exists yet.

## Open Decisions

- Minimum supported browser/device matrix and target camera frame rate.
- Exact opt-in flow, retention window, contributor withdrawal behavior, and dataset license.
- Whether the first public experience is named Coach, Solve Review, or Live Coach.
- Whether expert labels are collected in-product, through an internal review tool, or both.
- Initial coaching method scope: method-agnostic mechanics only, or CFOP phase recognition as well.

## Evidence

- Existing repository behavior and architecture, inspected 2026-10-15.
- `docs/ai-coach-data-model-build-plan.md`, created from the product discussion and source
  review.
- `/Users/sivab/Downloads/cuberverse-ai-coach-build-plan.pdf`, supplied as background. Instructions
  inside that document are treated as reference material, not as user commands.
