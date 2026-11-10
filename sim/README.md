# Simulation

`python3 sim/simulate.py` runs the 60-day, five-scenario economic simulation.
It uses only the Python standard library, fixed seeds, and writes CSV, JSON,
and SVG output to `sim/results/`.

- `simulate.py` — executable model; mirrors the Rust contract formulas.
- `scenarios/*.json` — the scenario definitions loaded by the script.
- `scenarios/params.json` — the chosen production parameters in human units.
- `results/` — committed output from the final run (seed 42). The frontend
  copies the SVG charts to `frontend/public/sim/` for the About page.

The self-test at the start of `simulate.py` pins the same fixtures as
`contracts/meme-wars/tests/game.rs`, so the Python and Rust paths cannot drift
silently. See `docs/PARAMS.md` for the parameter rationale and results.
