import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

it("gates normal rendering on scheduled draws and retains native layout caching", () => {
  const runtime = readFileSync(
    path.resolve(process.cwd(), "lime-rs/crates/tui/src/runtime.rs"),
    "utf8",
  );
  const normalDraw = runtime.slice(
    runtime.indexOf("if std::mem::take(&mut draw_requested)"),
    runtime.indexOf("if app.chat_widget.external_editor_state()"),
  );
  expect(normalDraw).toContain("render::draw(&mut terminal, &app)?");
  expect(normalDraw).not.toContain("handle_paste_burst_tick(");
  expect(runtime).toContain("render::prepare_draw(");
  expect(runtime).toMatch(
    /if !is_draw\s*\{\s*frame_requester\.schedule_frame\(\);/u,
  );
  const preparation = runtime.slice(
    runtime.indexOf("let action = if is_draw"),
    runtime.indexOf(
      "if connected {",
      runtime.indexOf("let action = if is_draw"),
    ),
  );
  expect(preparation.indexOf("render::prepare_draw(")).toBeLessThan(
    preparation.indexOf("draw_requested = true;"),
  );
  expect(preparation).toMatch(/else\s*\{\s*continue;\s*\}/u);
  const render = readFileSync(
    "lime-rs/crates/tui/src/runtime/render.rs",
    "utf8",
  );
  expect(
    render.indexOf("handle_paste_burst_tick(frames, input_at)"),
  ).toBeGreaterThanOrEqual(0);
  expect(
    render.indexOf("handle_paste_burst_tick(frames, input_at)"),
  ).toBeLessThan(render.indexOf("app.pre_draw_tick(now)"));
  expect(render).toContain(".draw(");
  expect(render).toContain("finish_draw(app, &terminal.frame_requester())");
  const finish = render.split("fn finish_draw(")[1].split("#[cfg(test)]")[0];
  expect(finish).toContain("app.transcript_search_needs_frame()");
  expect(finish).not.toMatch(
    /pre_draw_tick|handle_paste_burst_tick|flush_paste/u,
  );
  const routing = readFileSync(
    "lime-rs/crates/tui/src/app/interaction.rs",
    "utf8",
  );
  expect(routing).not.toContain("self.pre_draw_tick(");
  for (const owner of [
    "bottom_pane/mod.rs",
    "bottom_pane/request_user_input/mod.rs",
  ]) {
    const code = readFileSync(`lime-rs/crates/tui/src/${owner}`, "utf8");
    const tick = code.split("fn pre_draw_tick(")[1].split("\n    }")[0];
    expect(tick).not.toContain("flush_paste_burst_if_due");
  }
  for (const boundary of [
    "if resume_picker_load_rx.is_some()",
    "if session.is_some()",
    "if reconnect.is_some()",
  ]) {
    expect(runtime).toContain(
      `${boundary} => {\n                    frame_requester.schedule_frame();`,
    );
  }
  const manifest = readFileSync(
    path.resolve(process.cwd(), "lime-rs/Cargo.toml"),
    "utf8",
  );
  const ratatui = manifest.match(/^ratatui = .*$/mu)?.[0];
  expect(ratatui).toContain('"layout-cache"');
  expect(ratatui).toContain("default-features = false");
});

it("uses one source-idle paste clock for queued keys and scheduled draws", () => {
  const source = (file) =>
    readFileSync(`lime-rs/crates/tui/src/${file}`, "utf8");
  const events = source("tui/event_stream.rs");
  const runtime = source("runtime.rs");
  const routing = source("app/interaction.rs");
  expect(events).toContain("self.input_clock.ready(Instant::now())");
  expect(events).toContain("self.input_clock.pending(Instant::now())");
  expect(events).toContain("self.poll_draw_first = !self.poll_draw_first");
  expect(runtime).toContain("let input_at = input.input_time()");
  expect(runtime).toContain(
    "app.handle_tui_event_runtime(event, connected, input_at)",
  );
  expect(routing).toMatch(/\.handle_event_at\(event, input_at\)/u);
  expect(routing).not.toMatch(/\.handle_event\(event(?:\.clone\(\))?\)/u);
  for (const file of [
    "runtime.rs",
    "tui.rs",
    "tui/event_stream.rs",
    "bottom_pane/paste_burst.rs",
    "bottom_pane/chat_composer/paste_input.rs",
  ]) {
    expect(source(file)).not.toContain("input_timing");
    expect(source(file)).not.toContain("LIME_TEST_INPUT_STALL");
    expect(source(file)).not.toContain("LIME_TEST_INPUT_TRACE_ROOT");
  }
  expect(existsSync("lime-rs/crates/tui/src/input_timing.rs")).toBe(false);
});

it("resizes the PTY observer before parsing the first repaint at the new geometry", () => {
  const fixture = readFileSync(
    path.resolve(
      process.cwd(),
      "lime-rs/crates/tui/tests/suite/focus_palette.rs",
    ),
    "utf8",
  );
  const resize = fixture.slice(fixture.indexOf("pub(super) fn resize("));
  expect(
    resize.indexOf("self.parser.screen_mut().set_size(rows, cols)"),
  ).toBeGreaterThanOrEqual(0);
  expect(
    resize.indexOf("self.parser.screen_mut().set_size(rows, cols)"),
  ).toBeLessThan(resize.indexOf("self.master.resize("));
});

it("resolves event geometry once in Tui and renders with the reserved size", () => {
  const runtime = readFileSync(
    path.resolve(process.cwd(), "lime-rs/crates/tui/src/runtime.rs"),
    "utf8",
  );
  expect(runtime).not.toContain(".sync_viewport()");
  expect(runtime).toContain("terminal.screen_size_for_event(&event)?");
  expect(runtime).not.toContain(".terminal_mut()");
  const host = readFileSync(
    path.resolve(process.cwd(), "lime-rs/crates/tui/src/tui.rs"),
    "utf8",
  );
  const draw = host
    .split("pub(crate) fn draw(")[1]
    .split("pub(crate) fn draw_for_handoff(")[0];
  expect(host).not.toContain("fn sync_viewport(");
  expect(
    draw.indexOf("self.take_event_screen_size()?;"),
  ).toBeGreaterThanOrEqual(0);
  expect(draw.indexOf("self.take_event_screen_size()?;")).toBeLessThan(
    draw.indexOf("self.terminal.draw(render)?;"),
  );
  const handoff = host
    .split("pub(crate) fn draw_for_handoff(")[1]
    .split("fn refresh_terminal_title(")[0];
  expect(handoff).toContain("self.draw(cursor_style, terminal_title,");
  const geometry = readFileSync(
    "lime-rs/crates/tui/src/tui/screen_size.rs",
    "utf8",
  );
  expect(geometry).toContain("Viewport::Fixed(size.into())");
  const picker = readFileSync(
    "lime-rs/crates/tui/src/resume_picker/host.rs",
    "utf8",
  );
  expect(picker).toContain("terminal.screen_size_for_event(&event)?");
  expect(host).toContain("self.schedule_screen_size_recheck(Duration::ZERO)");
  const broker = readFileSync(
    "lime-rs/crates/tui/src/tui/event_stream.rs",
    "utf8",
  );
  expect(broker).toContain("monitor.set_active(false)");
  expect(broker).toContain("monitor.set_active(true)");
  expect(broker).toContain("SizeMonitor::take_resize");
});
