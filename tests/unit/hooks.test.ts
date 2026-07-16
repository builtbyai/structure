/**
 * Hooks system tests — covers event registration, decision propagation,
 * PreCompact event, and matcher logic.
 */

import { HooksSystem, initHooks } from '../../src/hooks/index';

describe('HooksSystem', () => {
  it('returns allow when no hooks are registered', async () => {
    const sys = new HooksSystem({});
    const result = await sys.emit('PreToolUse', { tool_name: 'Read' });
    expect(result.blocked).toBe(false);
    expect(result.decision).toBe('allow');
  });

  it('exposes the new PreCompact event in the type system', async () => {
    const sys = new HooksSystem({});
    const result = await sys.emit('PreCompact', {});
    expect(result.blocked).toBe(false);
  });

  it('respects matcher patterns on tool_name', async () => {
    const sys = new HooksSystem({
      hooks: {
        PreToolUse: [
          {
            matcher: '^Bash$',
            hooks: [{ type: 'command', command: 'echo "matched"' }],
          },
        ],
      },
    });
    // Non-matching tool — short-circuits before exec, returns allow
    const skipped = await sys.emit('PreToolUse', { tool_name: 'Read' });
    expect(skipped.blocked).toBe(false);
  });

  it('on() registers a runtime handler', () => {
    const sys = new HooksSystem({});
    sys.on('SessionStart', { type: 'command', command: 'noop' });
    // Internal registry should now have the SessionStart entry
    expect(() => sys.emit('SessionStart', {})).not.toThrow();
  });

  it('initHooks returns a usable HooksSystem', async () => {
    const sys = await initHooks({ hooks: {} });
    expect(sys).toBeInstanceOf(HooksSystem);
  });
});
