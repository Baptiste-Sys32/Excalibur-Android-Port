package com.badeparday.excalidrawpersonal;

import org.junit.Test;
import static org.junit.Assert.*;

public class ImportPolicyTest {
    @Test public void stripsPathsControlsAndDotNames() {
        assertEquals("notes.excalidraw", ImportPolicy.displayName("../notes.excalidraw"));
        assertEquals("notes.json", ImportPolicy.displayName("C:\\folder\\notes.json"));
        assertEquals("notes.json", ImportPolicy.displayName("notes\u0000.json\n"));
        assertNull(ImportPolicy.displayName(".."));
        assertNull(ImportPolicy.displayName(null));
        assertEquals(255, ImportPolicy.displayName("a".repeat(300)).length());
    }
    @Test public void enforcesCountAndByteBoundariesWithoutOverflow() {
        assertTrue(ImportPolicy.fits(31, ImportPolicy.MAX_TOTAL_BYTES - 1, 1));
        assertFalse(ImportPolicy.fits(32, 0, 1));
        assertFalse(ImportPolicy.fits(0, ImportPolicy.MAX_TOTAL_BYTES, 1));
        assertFalse(ImportPolicy.fits(0, Long.MAX_VALUE, 1));
        assertFalse(ImportPolicy.fits(0, 0, -1));
    }
}
