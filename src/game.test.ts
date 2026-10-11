import { describe, expect, it } from "vitest";
import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import { game, type CoilState } from "./game";
import { TICK_SECONDS } from "./constants";

async function setup() {
  const actions = new Set<string>();
  const played: string[] = [];
  const api = {
    input: { register() {} },
    assets: { loadImage: async () => ({}) },
    audio: { load: async () => {} },
    diagnostics: { register() {} },
  } as unknown as InitApi<CoilState>;
  const [start, debug] = await game.initialize(api);
  const input = {
    pressed: (name: string) => actions.has(name),
    pointerSamples: () => [],
  };
  let muted = false;
  const updateApi = {
    input,
    audio: {
      muted: () => muted,
      setMuted: (value: boolean) => {
        muted = value;
      },
      play: (cue: string) => {
        played.push(cue);
      },
      loop: (cue: string) => {
        played.push(cue);
      },
      stop: (cue: string) => {
        played.push(`stop:${cue}`);
      },
    },
  } as unknown as UpdateApi;
  const frame = (state: CoilState, dt = TICK_SECONDS) =>
    game.update(state, updateApi, dt);
  return { start, debug, actions, played, frame };
}

describe("Coil simulation", () => {
  it("starts a round and moves on whole ticks, carrying the remainder", async () => {
    const { start, debug, actions, frame } = await setup();
    actions.add("confirm");
    let state = frame(start, 0);
    actions.clear();
    expect(debug.snapshot(state)).toMatchObject({
      screen: "playing",
      score: 0,
      ticks: 0,
    });
    expect(state.pellet).not.toBeNull();
    state = frame(state, TICK_SECONDS / 2);
    expect(state.snake[0]).toEqual({ col: 15, row: 8 });
    state = frame(state, TICK_SECONDS / 2);
    expect(state.snake[0]).toEqual({ col: 16, row: 8 });
    expect(state.ticks).toBe(1);
  });

  it("buffers two turns and applies only one per tick", async () => {
    const { start, debug, frame } = await setup();
    let state = debug.setScreen(start, "playing");
    state = { ...state, turns: ["down", "left"] };
    state = frame(state);
    expect(state.snake[0]).toEqual({ col: 15, row: 9 });
    state = frame(state);
    expect(state.snake[0]).toEqual({ col: 14, row: 9 });
  });

  it("grows, raises combo on a fast second eat, and lapses the window", async () => {
    const { start, debug, frame, played } = await setup();
    let state = debug.setScreen(start, "playing");
    state = debug.setPellet(state, 16, 8);
    state = debug.setNextPellet(state, 17, 8);
    state = frame(state);
    expect(state).toMatchObject({ score: 10, combo: 1 });
    expect(state.snake).toHaveLength(4);
    state = frame(state);
    expect(state).toMatchObject({ score: 30, combo: 2 });
    expect(state.snake).toHaveLength(5);
    expect(played).toContain("combo-up");
    state = debug.setSnakeTravel(state, false);
    for (let i = 0; i < 27; i++) state = frame(state);
    expect(state.combo).toBe(1);
    expect(state.comboWindow).toBe(0);
  });

  it("ends on the wall and freezes until resumed", async () => {
    const { start, debug, frame, played } = await setup();
    let state = debug.setScreen(start, "playing");
    state = debug.setSnake(state, [{ col: 28, row: 8 }]);
    state = frame(state);
    expect(state.screen).toBe("gameover");
    expect(played).toContain("death");
    const ticks = state.ticks;
    state = frame(state, 1);
    expect(state.ticks).toBe(ticks);
  });

  it("validates debug poses without changing the given state", async () => {
    const { start, debug } = await setup();
    const next = debug.setScore(start, 90);
    expect(start.score).toBe(0);
    expect(next.score).toBe(90);
    expect(() => debug.setSnake(start, [{ col: 0, row: 0 }])).toThrow();
    expect(debug.menuItemRect(start, 0)).toMatchObject({ w: 400, h: 48 });
    expect(debug.menuItemRect(debug.setScreen(start, "playing"), 0)).toBeNull();
  });
});

it("steps the simulation through the Simple 2D engine clock", async () => {
  const { createEngine, ConstantClock } = await import("@clockwyrks/simple-2d");
  const { createCanvas } = await import("@napi-rs/canvas");
  const { start, debug } = await setup();
  const canvas = createCanvas(1280, 720);
  const events = new EventTarget();
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: 1280,
    height: 720,
    clock: new ConstantClock(62.5),
    surface: {
      cssWidth: () => 1280,
      cssHeight: () => 720,
      dpr: () => 1,
      events: () => events,
    },
    game: {
      initialize: () => [start, debug],
      update: game.update,
      render: () => {},
    },
  });
  await engine.initialize();
  engine.apply((s) => engine.debug.setScreen(s, "playing"));
  engine.apply((s) => engine.debug.setSnakeTravel(s, false));
  await engine.advance(2);
  expect(engine.debug.snapshot(engine.state)).toMatchObject({
    ticks: 1,
    simTime: 0.125,
  });
  engine.destroy();
});
