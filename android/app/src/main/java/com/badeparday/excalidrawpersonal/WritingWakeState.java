package com.badeparday.excalidrawpersonal;

final class WritingWakeState {
    static final long IDLE_MS = 120_000;
    private boolean enabled;
    private boolean resumed;
    private long deadline;

    void enable(boolean value) { enabled = value; if (!value) deadline = 0; }
    void resume(boolean value) { resumed = value; if (!value) deadline = 0; }
    void contact(long now) { if (enabled && resumed) deadline = now + IDLE_MS; }
    long remaining(long now) { return enabled && resumed ? Math.max(0, deadline - now) : 0; }
}
