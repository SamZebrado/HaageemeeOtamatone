# Bugfix Note: “Second press silent” issue

## Symptom
After the first manual press on the ribbon, the next press produced no sound unless syllables were enabled (most noticeable outside fish mode).

## Root Cause
The audio graph includes a `syllableGateGain` node after the post‑mix.  
On `gate(false)` and `stopAll()`, we were setting `syllableGateGain` to **0**, which permanently muted the entire post‑mix path.  
When syllables are **off**, there is no later syllable envelope to reopen this gain, and `gate(true)` only reopens `oscGain`—so the path stayed muted and the next press was silent.

## Fix
Keep `syllableGateGain` **open (1.0)** on `gate(false)` and `stopAll()`.  
The actual note on/off is already controlled by `oscGain`, so closing the post‑mix gate is unnecessary and harmful.

## Lesson Learned
If a shared gain sits **after** the main synth mix, never close it as a general “note off” unless there’s guaranteed logic to reopen it on every note.  
Use the per‑voice or per‑note gain (`oscGain`) for note gating; reserve post‑mix gates only for temporary effects that also have a clear re‑open path.
