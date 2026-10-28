package com.badeparday.excalidrawpersonal;

import org.junit.Test;
import static org.junit.Assert.*;

public class WritingWakeStateTest {
    @Test public void requiresOptInAndForegroundAndExpiresFromLastContact() {
        WritingWakeState state = new WritingWakeState();
        state.resume(true);
        state.contact(100);
        assertEquals(0, state.remaining(101));
        state.enable(true);
        state.contact(100);
        assertEquals(120000, state.remaining(100));
        state.contact(200);
        assertEquals(1, state.remaining(120199));
        assertEquals(0, state.remaining(120200));
        state.resume(false);
        state.resume(true);
        assertEquals(0, state.remaining(201));
        state.contact(300);
        state.enable(false);
        assertEquals(0, state.remaining(301));
    }
}
