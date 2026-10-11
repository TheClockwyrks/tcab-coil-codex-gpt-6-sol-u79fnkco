import type {
  Game,
  InitApi,
  UpdateApi,
  RenderApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import {
  ACTIONS,
  BINDINGS,
  BEST_LABEL,
  BITE_SECONDS,
  BOARD_X,
  BOARD_Y,
  CELL,
  CLEARED_TEXT,
  COIL_DEBUG_VERSION,
  COMBO_MAX,
  COMBO_WINDOW,
  CUES,
  CUE_PATHS,
  DIRECTIONS,
  GAMEOVER_TEXT,
  GRID_COLS,
  GRID_ROWS,
  HEAD_FRAMES,
  INTERIOR_MAX_COL,
  INTERIOR_MAX_ROW,
  INTERIOR_MIN_COL,
  INTERIOR_MIN_ROW,
  MODE,
  MODE_LABEL,
  OBSTACLE_CELLS,
  OVER_ITEMS,
  PAUSE_ITEMS,
  PELLET_POINTS,
  SCORE_LABEL,
  SCREENS,
  SPRITE_PATHS,
  STAGE_H,
  STAGE_W,
  START_CELLS,
  START_DIR,
  TAGLINE_TEXT,
  TICK_SECONDS,
  TITLE_ITEMS,
  TITLE_TEXT,
  TURN_QUEUE_MAX,
  type Cell,
  type Direction,
  type Screen,
} from "./constants";

export const BACKGROUND = "#070b19";
type Rect = { x: number; y: number; w: number; h: number };
type Sprites = {
  head: ImageBitmap[];
  body: ImageBitmap;
  corner: ImageBitmap;
  tail: ImageBitmap;
};
export interface CoilState {
  screen: Screen;
  menuIndex: number;
  titleIndex: number;
  score: number;
  best: number;
  combo: number;
  comboWindow: number;
  muted: boolean;
  ticks: number;
  simTime: number;
  accumulator: number;
  dir: Direction;
  turns: Direction[];
  snake: Cell[];
  pellet: Cell | null;
  obstacles: Cell[];
  steering: boolean;
  travel: boolean;
  pelletRespawn: boolean;
  nextPellet: Cell | null;
  bite: number;
  pointerStarts: Record<number, number>;
  sprites?: Sprites;
}
export interface CoilDebugApi {
  version: number;
  reset(s: DeepReadonly<CoilState>): CoilState;
  reconcile(s: DeepReadonly<CoilState>): CoilState;
  snapshot(s: DeepReadonly<CoilState>): object;
  menuItemRect(s: DeepReadonly<CoilState>, index: number): Rect | null;
  setScreen(s: DeepReadonly<CoilState>, screen: Screen): CoilState;
  setMenuIndex(s: DeepReadonly<CoilState>, index: number): CoilState;
  setScore(s: DeepReadonly<CoilState>, points: number): CoilState;
  setBest(s: DeepReadonly<CoilState>, points: number): CoilState;
  setCombo(s: DeepReadonly<CoilState>, multiplier: number): CoilState;
  setComboWindow(s: DeepReadonly<CoilState>, seconds: number): CoilState;
  setSnake(s: DeepReadonly<CoilState>, cells: Cell[]): CoilState;
  setDirection(s: DeepReadonly<CoilState>, dir: Direction): CoilState;
  clearTurns(s: DeepReadonly<CoilState>): CoilState;
  setSnakeSteering(s: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setSnakeTravel(s: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setPellet(s: DeepReadonly<CoilState>, col: number, row: number): CoilState;
  clearPellet(s: DeepReadonly<CoilState>): CoilState;
  setPelletRespawn(s: DeepReadonly<CoilState>, enabled: boolean): CoilState;
  setNextPellet(
    s: DeepReadonly<CoilState>,
    col: number,
    row: number,
  ): CoilState;
  drawPelletCell(s: DeepReadonly<CoilState>): Cell | null;
}
const same = (a: Cell, b: Cell) => a.col === b.col && a.row === b.row;
const interior = (c: Cell) =>
  Number.isInteger(c.col) &&
  Number.isInteger(c.row) &&
  c.col >= INTERIOR_MIN_COL &&
  c.col <= INTERIOR_MAX_COL &&
  c.row >= INTERIOR_MIN_ROW &&
  c.row <= INTERIOR_MAX_ROW;
const assert = (v: boolean, msg: string): void => {
  if (!v) throw new Error(`Coil debug: ${msg}`);
};
const whole = (n: number) => Number.isInteger(n) && n >= 0;
const copy = (s: DeepReadonly<CoilState>): CoilState => ({
  ...s,
  turns: [...s.turns],
  snake: s.snake.map((c) => ({ ...c })),
  obstacles: s.obstacles.map((c) => ({ ...c })),
  pellet: s.pellet && { ...s.pellet },
  nextPellet: s.nextPellet && { ...s.nextPellet },
  pointerStarts: { ...s.pointerStarts },
  sprites: s.sprites
    ? {
        head: [...s.sprites.head],
        body: s.sprites.body,
        corner: s.sprites.corner,
        tail: s.sprites.tail,
      }
    : undefined,
});
const initial = (muted = false, sprites?: Sprites): CoilState => ({
  screen: "title",
  menuIndex: 0,
  titleIndex: 0,
  score: 0,
  best: 0,
  combo: 1,
  comboWindow: 0,
  muted,
  ticks: 0,
  simTime: 0,
  accumulator: 0,
  dir: START_DIR as Direction,
  turns: [],
  snake: START_CELLS.map((c) => ({ ...c })),
  pellet: null,
  obstacles: OBSTACLE_CELLS.map((c) => ({ ...c })),
  steering: true,
  travel: true,
  pelletRespawn: true,
  nextPellet: null,
  bite: 0,
  pointerStarts: {},
  sprites,
});
const valid = (s: DeepReadonly<CoilState>): Cell[] => {
  const out: Cell[] = [];
  for (let row = INTERIOR_MIN_ROW; row <= INTERIOR_MAX_ROW; row++)
    for (let col = INTERIOR_MIN_COL; col <= INTERIOR_MAX_COL; col++) {
      const c = { col, row };
      if (
        !s.snake.some((x) => same(x, c)) &&
        !s.obstacles.some((x) => same(x, c)) &&
        (!s.pellet || !same(s.pellet, c))
      )
        out.push(c);
    }
  return out;
};
const drawCell = (s: DeepReadonly<CoilState>): Cell | null => {
  const cells = valid(s);
  return cells.length ? cells[Math.floor(Math.random() * cells.length)] : null;
};
const spawn = (s: CoilState): Cell | null => {
  const cells = valid(s);
  const posed = s.nextPellet;
  s.nextPellet = null;
  return (
    cells.find((c) => posed && same(c, posed)) ??
    (cells.length ? cells[Math.floor(Math.random() * cells.length)] : null)
  );
};
const menu = (screen: Screen): readonly string[] =>
  screen === "title"
    ? TITLE_ITEMS
    : screen === "paused"
      ? PAUSE_ITEMS
      : screen === "gameover" || screen === "cleared"
        ? OVER_ITEMS
        : screen === "howto"
          ? ["BACK"]
          : [];
const menuRect = (screen: Screen, index: number): Rect | null => {
  if (!whole(index) || index >= menu(screen).length) return null;
  const y =
    screen === "title"
      ? 438
      : screen === "howto"
        ? 606
        : screen === "paused"
          ? 362
          : 486;
  return { x: 440, y: y + index * 58, w: 400, h: 48 };
};
const debug: CoilDebugApi = {
  version: COIL_DEBUG_VERSION,
  reset: (s) =>
    initial(
      s.muted,
      s.sprites
        ? {
            head: [...s.sprites.head],
            body: s.sprites.body,
            corner: s.sprites.corner,
            tail: s.sprites.tail,
          }
        : undefined,
    ),
  reconcile: copy,
  snapshot: (s) => ({
    version: COIL_DEBUG_VERSION,
    screen: s.screen,
    menuIndex: s.menuIndex,
    titleIndex: s.titleIndex,
    mode: MODE,
    score: s.score,
    best: s.best,
    combo: s.combo,
    comboWindow: s.comboWindow,
    muted: s.muted,
    ticks: s.ticks,
    simTime: s.simTime,
    dir: s.dir,
    turns: [...s.turns],
    snake: s.snake.map((c) => ({ ...c })),
    pellet: s.pellet && { ...s.pellet },
    obstacles: s.obstacles.map((c) => ({ ...c })),
    steering: s.steering,
    travel: s.travel,
    pelletRespawn: s.pelletRespawn,
    nextPellet: s.nextPellet && { ...s.nextPellet },
  }),
  menuItemRect: (s, i) => menuRect(s.screen, i),
  setScreen: (s, screen) => {
    assert((SCREENS as readonly string[]).includes(screen), "invalid screen");
    return { ...copy(s), screen };
  },
  setMenuIndex: (s, index) => {
    assert(
      whole(index) &&
        (s.screen === "playing" ? index === 0 : index < menu(s.screen).length),
      "invalid menu index",
    );
    return { ...copy(s), menuIndex: index };
  },
  setScore: (s, points) => {
    assert(whole(points), "invalid score");
    return { ...copy(s), score: points };
  },
  setBest: (s, points) => {
    assert(whole(points), "invalid best");
    return { ...copy(s), best: points };
  },
  setCombo: (s, multiplier) => {
    assert(
      Number.isInteger(multiplier) &&
        multiplier >= 1 &&
        multiplier <= COMBO_MAX,
      "invalid combo",
    );
    return { ...copy(s), combo: multiplier };
  },
  setComboWindow: (s, seconds) => {
    assert(
      Number.isFinite(seconds) && seconds >= 0 && seconds <= COMBO_WINDOW,
      "invalid combo window",
    );
    return { ...copy(s), comboWindow: seconds };
  },
  setSnake: (s, cells) => {
    assert(Array.isArray(cells) && cells.length > 0, "invalid snake");
    const seen = new Set<string>();
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      assert(
        interior(c) && !s.obstacles.some((o) => same(o, c)),
        "invalid snake cell",
      );
      const k = `${c.col},${c.row}`;
      assert(!seen.has(k), "repeated snake cell");
      seen.add(k);
      if (i)
        assert(
          Math.abs(c.col - cells[i - 1].col) +
            Math.abs(c.row - cells[i - 1].row) ===
            1,
          "disconnected snake",
        );
    }
    return { ...copy(s), snake: cells.map((c) => ({ ...c })) };
  },
  setDirection: (s, dir) => {
    assert(
      (DIRECTIONS as readonly string[]).includes(dir),
      "invalid direction",
    );
    return { ...copy(s), dir };
  },
  clearTurns: (s) => ({ ...copy(s), turns: [] }),
  setSnakeSteering: (s, enabled) => {
    assert(typeof enabled === "boolean", "invalid steering");
    return {
      ...copy(s),
      steering: enabled,
      turns: enabled ? [...s.turns] : [],
    };
  },
  setSnakeTravel: (s, enabled) => {
    assert(typeof enabled === "boolean", "invalid travel");
    return { ...copy(s), travel: enabled };
  },
  setPellet: (s, col, row) => {
    const c = { col, row };
    assert(
      interior(c) &&
        !s.snake.some((x) => same(x, c)) &&
        !s.obstacles.some((x) => same(x, c)),
      "invalid pellet",
    );
    return { ...copy(s), pellet: c };
  },
  clearPellet: (s) => ({ ...copy(s), pellet: null }),
  setPelletRespawn: (s, enabled) => {
    assert(typeof enabled === "boolean", "invalid respawn");
    return { ...copy(s), pelletRespawn: enabled };
  },
  setNextPellet: (s, col, row) => {
    assert(
      whole(col) && col < GRID_COLS && whole(row) && row < GRID_ROWS,
      "invalid next pellet",
    );
    return { ...copy(s), nextPellet: { col, row } };
  },
  drawPelletCell: drawCell,
};
const delta: Record<Direction, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};
const perpendicular = (a: Direction, b: Direction) =>
  delta[a].col !== delta[b].col && delta[a].row !== delta[b].row;
function tick(s: CoilState, api: UpdateApi): void {
  s.ticks++;
  if (s.steering && s.turns.length) {
    const turn = s.turns.shift()!;
    if (perpendicular(s.dir, turn)) s.dir = turn;
  }
  if (s.travel) {
    const h = s.snake[0],
      d = delta[s.dir],
      next = { col: h.col + d.col, row: h.row + d.row };
    const eat = !!s.pellet && same(next, s.pellet);
    const occupied = s.snake.some((c, i) =>
      i !== s.snake.length - 1 || eat ? same(c, next) : false,
    );
    if (!interior(next) || s.obstacles.some((c) => same(c, next)) || occupied) {
      s.screen = "gameover";
      s.menuIndex = 0;
      s.accumulator = 0;
      api.audio.play(CUES.death);
      api.audio.stop(CUES.music);
      return;
    }
    s.snake = [next, ...s.snake.slice(0, eat ? undefined : -1)];
    if (eat) {
      const before = s.combo;
      s.combo = s.comboWindow > 0 ? Math.min(COMBO_MAX, s.combo + 1) : 1;
      s.score += PELLET_POINTS * s.combo;
      s.best = Math.max(s.best, s.score);
      s.comboWindow = COMBO_WINDOW;
      s.bite = BITE_SECONDS;
      api.audio.play(CUES.eat);
      if (s.combo > before) api.audio.play(CUES.comboUp);
      s.pellet = null;
      if (s.pelletRespawn) {
        s.pellet = spawn(s);
        if (!s.pellet) {
          s.screen = "cleared";
          s.menuIndex = 0;
          s.accumulator = 0;
          api.audio.stop(CUES.music);
          return;
        }
      }
    }
  }
  s.comboWindow = Math.max(
    0,
    Math.round((s.comboWindow - TICK_SECONDS) * 1000000) / 1000000,
  );
  if (s.comboWindow === 0) s.combo = 1;
}
function round(s: CoilState, api: UpdateApi): CoilState {
  const next: CoilState = {
    ...s,
    screen: "playing" as Screen,
    menuIndex: 0,
    score: 0,
    combo: 1,
    comboWindow: 0,
    ticks: 0,
    simTime: 0,
    accumulator: 0,
    dir: START_DIR as Direction,
    turns: [],
    snake: START_CELLS.map((c) => ({ ...c })),
    pellet: null,
    bite: 0,
    pointerStarts: {},
  };
  next.pellet = spawn(next);
  api.audio.loop(CUES.music);
  return next;
}
function toTitle(s: CoilState, api: UpdateApi): CoilState {
  api.audio.stop(CUES.music);
  return { ...s, screen: "title", menuIndex: s.titleIndex, pointerStarts: {} };
}
function accept(s: CoilState, api: UpdateApi): CoilState {
  switch (s.screen) {
    case "title":
      s.titleIndex = s.menuIndex;
      return s.menuIndex === 0
        ? round(s, api)
        : { ...s, screen: "howto", menuIndex: 0 };
    case "howto":
      return toTitle(s, api);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: "playing", menuIndex: 0 }
        : s.menuIndex === 1
          ? round(s, api)
          : toTitle(s, api);
    case "gameover":
    case "cleared":
      return s.menuIndex === 0 ? round(s, api) : toTitle(s, api);
    default:
      return s;
  }
}
function hit(screen: Screen, x: number, y: number): number {
  for (let i = 0; i < menu(screen).length; i++) {
    const r = menuRect(screen, i)!;
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}
export const game: Game<CoilState, CoilDebugApi> = {
  async initialize(
    api: InitApi<CoilState>,
  ): Promise<[CoilState, CoilDebugApi]> {
    for (const action of ACTIONS)
      api.input.register(action, { keys: [...BINDINGS[action]] });
    const [head, body, corner, tail] = await Promise.all([
      Promise.all(SPRITE_PATHS.head.map((p) => api.assets.loadImage(p))),
      api.assets.loadImage(SPRITE_PATHS.body),
      api.assets.loadImage(SPRITE_PATHS.corner),
      api.assets.loadImage(SPRITE_PATHS.tail),
    ]);
    await Promise.all(
      Object.values(CUES).map((c) => api.audio.load(c, CUE_PATHS[c])),
    );
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("score", (s) => s.score);
    api.diagnostics.register("best", (s) => s.best);
    api.diagnostics.register(
      "combo",
      (s) => `x${s.combo} ${s.comboWindow.toFixed(2)}s`,
    );
    api.diagnostics.register("direction", (s) => s.dir);
    api.diagnostics.register("length", (s) => s.snake.length);
    api.diagnostics.register(
      "head",
      (s) => `${s.snake[0].col},${s.snake[0].row}`,
    );
    api.diagnostics.register("pellet", (s) =>
      s.pellet ? `${s.pellet.col},${s.pellet.row}` : "none",
    );
    return [initial(false, { head, body, corner, tail }), debug];
  },
  update(
    state: DeepReadonly<CoilState>,
    api: UpdateApi,
    dt: number,
  ): CoilState {
    let s = copy(state);
    if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
    s.muted = api.audio.muted();
    s.best = Math.max(s.best, s.score);
    if (s.screen === "playing") {
      if (api.input.pressed("back") || api.input.pressed("pause"))
        return { ...s, screen: "paused", menuIndex: 0 };
      if (s.steering)
        for (const dir of DIRECTIONS)
          if (api.input.pressed(dir) && s.turns.length < TURN_QUEUE_MAX)
            s.turns.push(dir);
      s.simTime += dt;
      s.accumulator += dt;
      s.bite = Math.max(0, s.bite - dt);
      while (s.accumulator + 1e-9 >= TICK_SECONDS && s.screen === "playing") {
        s.accumulator -= TICK_SECONDS;
        tick(s, api);
      }
      if (s.screen !== "playing") s.accumulator = 0;
      return s;
    }
    if (api.input.pressed("up"))
      s.menuIndex =
        (s.menuIndex + menu(s.screen).length - 1) % menu(s.screen).length;
    if (api.input.pressed("down"))
      s.menuIndex = (s.menuIndex + 1) % menu(s.screen).length;
    if (api.input.pressed("confirm")) s = accept(s, api);
    if (api.input.pressed("back")) {
      if (
        s.screen === "howto" ||
        s.screen === "gameover" ||
        s.screen === "cleared"
      )
        s = toTitle(s, api);
      else if (s.screen === "paused")
        s = { ...s, screen: "playing", menuIndex: 0 };
    } else if (s.screen === "paused" && api.input.pressed("pause"))
      s = { ...s, screen: "playing", menuIndex: 0 };
    if (s.screen !== "playing")
      for (const sample of api.input.pointerSamples()) {
        const i = hit(s.screen, sample.x, sample.y);
        if (i >= 0) s.menuIndex = i;
        const key = sample.id;
        if (sample.type === "down" && sample.button === "primary")
          s.pointerStarts[key] = i;
        if (sample.type === "up") {
          if (i >= 0 && s.pointerStarts[key] === i) s = accept(s, api);
          delete s.pointerStarts[key];
        }
      }
    return s;
  },
  render(state: DeepReadonly<CoilState>, api: RenderApi): void {
    drawScene(state, api.ctx);
  },
};

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = "#e9f8ff",
  align: CanvasTextAlign = "left",
  weight = 700,
): void {
  ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function rotated(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  c: Cell,
  angle: number,
): void {
  ctx.save();
  ctx.translate(BOARD_X + (c.col + 0.5) * CELL, BOARD_Y + (c.row + 0.5) * CELL);
  ctx.rotate(angle);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -CELL / 2, -CELL / 2, CELL, CELL);
  ctx.restore();
}
function angle(d: Direction): number {
  return d === "right"
    ? 0
    : d === "down"
      ? Math.PI / 2
      : d === "left"
        ? Math.PI
        : Math.PI * 1.5;
}
function direction(a: Cell, b: Cell): Direction {
  return b.col > a.col
    ? "right"
    : b.col < a.col
      ? "left"
      : b.row > a.row
        ? "down"
        : "up";
}
function drawScene(
  s: DeepReadonly<CoilState>,
  ctx: CanvasRenderingContext2D,
): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.fillStyle = "#0b1329";
  ctx.fillRect(BOARD_X, BOARD_Y, GRID_COLS * CELL, GRID_ROWS * CELL);
  ctx.strokeStyle = "#192545";
  ctx.lineWidth = 1;
  for (let c = 1; c < GRID_COLS; c++) {
    const x = BOARD_X + c * CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, BOARD_Y);
    ctx.lineTo(x, BOARD_Y + GRID_ROWS * CELL);
    ctx.stroke();
  }
  for (let r = 1; r < GRID_ROWS; r++) {
    const y = BOARD_Y + r * CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(BOARD_X, y);
    ctx.lineTo(BOARD_X + GRID_COLS * CELL, y);
    ctx.stroke();
  }
  for (let row = 0; row < GRID_ROWS; row++)
    for (let col = 0; col < GRID_COLS; col++)
      if (
        row === 0 ||
        col === 0 ||
        row === GRID_ROWS - 1 ||
        col === GRID_COLS - 1
      ) {
        const x = BOARD_X + col * CELL,
          y = BOARD_Y + row * CELL;
        ctx.fillStyle = "#172747";
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = "#315478";
        ctx.fillRect(x + 3, y + 3, CELL - 6, 2);
        ctx.fillStyle = "#0d182e";
        ctx.fillRect(x + 3, y + CELL - 5, CELL - 6, 2);
      }
  ctx.strokeStyle = "#39c6e6";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    BOARD_X + CELL,
    BOARD_Y + CELL,
    (GRID_COLS - 2) * CELL,
    (GRID_ROWS - 2) * CELL,
  );
  for (const c of s.obstacles) {
    ctx.fillStyle = "#ef5d86";
    ctx.fillRect(
      BOARD_X + c.col * CELL + 3,
      BOARD_Y + c.row * CELL + 3,
      CELL - 6,
      CELL - 6,
    );
  }
  if (s.pellet) {
    const x = BOARD_X + (s.pellet.col + 0.5) * CELL,
      y = BOARD_Y + (s.pellet.row + 0.5) * CELL;
    ctx.shadowColor = "#ffb64f";
    ctx.shadowBlur = 17;
    ctx.fillStyle = "#ffb342";
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff4cb";
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.sprites) {
    for (let i = s.snake.length - 1; i >= 0; i--) {
      const c = s.snake[i];
      if (i === 0) {
        const frame =
          s.bite > 0
            ? Math.min(
                HEAD_FRAMES - 1,
                1 + Math.floor((1 - s.bite / BITE_SECONDS) * 3),
              )
            : 0;
        rotated(ctx, s.sprites.head[frame], c, angle(s.dir));
      } else if (i === s.snake.length - 1) {
        rotated(ctx, s.sprites.tail, c, angle(direction(c, s.snake[i - 1])));
      } else {
        const a = direction(c, s.snake[i - 1]),
          b = direction(c, s.snake[i + 1]);
        if ((a === "left" && b === "right") || (a === "right" && b === "left"))
          rotated(ctx, s.sprites.body, c, 0);
        else if ((a === "up" && b === "down") || (a === "down" && b === "up"))
          rotated(ctx, s.sprites.body, c, Math.PI / 2);
        else {
          const pair = [a, b];
          const rotation =
            pair.includes("right") && pair.includes("down")
              ? 0
              : pair.includes("down") && pair.includes("left")
                ? 1
                : pair.includes("left") && pair.includes("up")
                  ? 2
                  : 3;
          rotated(ctx, s.sprites.corner, c, (rotation * Math.PI) / 2);
        }
      }
    }
  }
  ctx.fillStyle = "#0d1830";
  ctx.fillRect(0, 0, STAGE_W, BOARD_Y - 3);
  ctx.fillStyle = "#39c6e6";
  ctx.fillRect(BOARD_X, BOARD_Y - 4, GRID_COLS * CELL, 2);
  text(ctx, SCORE_LABEL, 164, 32, 17, "#7f9bb6");
  text(ctx, String(s.score).padStart(4, "0"), 164, 85, 43);
  text(ctx, BEST_LABEL, 390, 32, 17, "#7f9bb6");
  text(ctx, String(s.best).padStart(4, "0"), 390, 85, 43);
  if (s.combo >= 2) {
    text(ctx, `x${s.combo} COMBO`, 665, 49, 28, "#ffb342");
    ctx.fillStyle = "#23324e";
    ctx.fillRect(665, 70, 202, 9);
    ctx.fillStyle = "#ffb342";
    ctx.fillRect(665, 70, (202 * s.comboWindow) / COMBO_WINDOW, 9);
  }
  text(ctx, MODE_LABEL, 1014, 41, 20, "#75e6ec", "right");
  text(
    ctx,
    s.muted ? "SOUND OFF" : "SOUND ON",
    1118,
    83,
    16,
    s.muted ? "#ef5d86" : "#7398b6",
    "right",
  );
  if (s.screen !== "playing") {
    ctx.fillStyle = "rgba(3,8,23,.77)";
    ctx.fillRect(0, BOARD_Y, STAGE_W, STAGE_H - BOARD_Y);
    const title = s.screen === "title";
    const how = s.screen === "howto";
    const panelY = title ? 190 : how ? 174 : 245;
    ctx.fillStyle = "#111d37";
    ctx.fillRect(340, panelY, 600, how ? 490 : title ? 426 : 370);
    ctx.strokeStyle = "#3fcce8";
    ctx.lineWidth = 2;
    ctx.strokeRect(340, panelY, 600, how ? 490 : title ? 426 : 370);
    if (title) {
      text(ctx, TITLE_TEXT, 640, 292, 106, "#77f9f0", "center");
      text(ctx, TAGLINE_TEXT, 640, 334, 23, "#ffa94d", "center");
      text(ctx, BEST_LABEL, 640, 374, 16, "#91a9bf", "center");
      text(
        ctx,
        String(s.best).padStart(4, "0"),
        640,
        410,
        34,
        "#e9f8ff",
        "center",
      );
    } else if (how) {
      text(ctx, "HOW TO PLAY", 640, 225, 35, "#77f9f0", "center");
      const lines = [
        "The serpent never stops. Turns happen on the next beat.",
        "Turn only across your path — never double back.",
        "Eat a spark to grow one cell longer.",
        "Walls and your own coil end the run.",
        "Eat again quickly to climb the combo. Let it drain,",
        "and your multiplier falls back to x1.",
        "",
        "MOVE   Arrow keys / W A S D",
        "SELECT   Enter / Space       BACK   Esc",
        "PAUSE   P                  MUTE   M",
      ];
      lines.forEach((line, i) =>
        text(
          ctx,
          line,
          382,
          276 + i * 30,
          18,
          i === 7 || i === 8 || i === 9 ? "#77f9f0" : "#d9e8fa",
          "left",
          500,
        ),
      );
    } else {
      text(
        ctx,
        s.screen === "paused"
          ? "PAUSED"
          : s.screen === "cleared"
            ? CLEARED_TEXT
            : GAMEOVER_TEXT,
        640,
        318,
        45,
        s.screen === "gameover" ? "#ff789e" : "#77f9f0",
        "center",
      );
      if (s.screen !== "paused") {
        text(
          ctx,
          `${SCORE_LABEL}  ${s.score}     ${BEST_LABEL}  ${s.best}`,
          640,
          379,
          24,
          "#d9e8fa",
          "center",
        );
      }
    }
    menu(s.screen).forEach((item, i) => {
      const r = menuRect(s.screen, i)!;
      ctx.fillStyle = i === s.menuIndex ? "#2b6780" : "#182742";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = i === s.menuIndex ? "#7ff8ed" : "#3a5875";
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      text(
        ctx,
        item,
        r.x + r.w / 2,
        r.y + 33,
        22,
        i === s.menuIndex ? "#ffffff" : "#b3cbe0",
        "center",
      );
    });
  }
}
