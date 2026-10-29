package com.badeparday.excalidrawpersonal;
import org.junit.Test;
import static org.junit.Assert.*;

public class WorkspacePathTest {
    @Test public void acceptsOnlyRelativeAppSubtree() throws Exception {
        assertEquals(3, WorkspaceFiles.parts("Excalidraw/canvases/notes.excalidraw").length);
        for (String path : new String[] {"../notes", "Excalidraw/../notes", "Excalidraw//notes", "/Excalidraw",
            "Excalidraw/a\\b", "Excalidraw/.excalibur-test", "Excalidraw/a\n\nb", "Excalidraw/" + "a".repeat(201)}) {
            try { WorkspaceFiles.parts(path); fail("Unsafe path accepted"); }
            catch (java.io.IOException expected) { /* rejected before provider I/O */ }
        }
    }
}
