package com.badeparday.excalidrawpersonal;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ImportPayloadTest {
    @Test public void multiFilePayloadSerializesWithoutReferencingItsEnvelope() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.badeparday.excalidrawpersonal", context.getPackageName());
        ArrayList<Uri> uris = new ArrayList<>();
        ArrayList<File> files = new ArrayList<>();
        try {
            for (int i = 0; i < 2; i++) {
                File file = File.createTempFile("intake-", ".json", context.getCacheDir());
                files.add(file);
                try (FileOutputStream stream = new FileOutputStream(file)) {
                    stream.write("{}".getBytes(StandardCharsets.UTF_8));
                }
                uris.add(Uri.fromFile(file));
            }
            Intent intent = new Intent(Intent.ACTION_SEND_MULTIPLE);
            intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
            Method build = DrawBridgePlugin.class.getDeclaredMethod(
                "buildPendingOpenPayload", Context.class, Intent.class);
            build.setAccessible(true);
            JSObject payload = (JSObject) build.invoke(null, context, intent);
            assertNotNull(payload);
            assertEquals(4, payload.optLong("totalBytes"));
            assertEquals(2, payload.getJSONArray("files").length());
            assertFalse(payload.getJSONArray("files").getJSONObject(0).has("files"));
            assertNotNull(payload.toString());
        } finally {
            for (File file : files) file.delete();
        }
    }
}
