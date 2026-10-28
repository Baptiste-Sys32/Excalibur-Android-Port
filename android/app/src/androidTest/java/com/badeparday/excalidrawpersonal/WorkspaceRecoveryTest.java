package com.badeparday.excalidrawpersonal;

import android.content.Context;
import android.content.ContentResolver;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.Test;
import org.junit.Assume;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class WorkspaceRecoveryTest {
    @Test public void recoversInterruptedReplacementAndFinishesCommittedReplacement() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WorkspaceFiles files = new WorkspaceFiles(context);
        String root = files.selected();
        Assume.assumeNotNull(root); // Select a disposable local workspace before this device test.
        ContentResolver resolver = context.getContentResolver();
        String path = "Excalidraw/canvases/recovery-test-" + UUID.randomUUID() + ".excalidraw";
        String oldData = "{\"test\":\"old\"}", newData = "{\"test\":\"new\"}";
        synchronized (WorkspaceFiles.LOCK) {
            android.content.SharedPreferences prefs = context.getSharedPreferences("excalibur-workspace", Context.MODE_PRIVATE);
            Assume.assumeFalse(prefs.contains("transaction:" + root));
            try {
                files.operation(root, "write", path, null, Base64.encodeToString(oldData.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP), null);
                for (boolean committed : new boolean[] {false, true}) {
                    Uri target = Uri.parse(files.operation(root, "getUri", path, null, null, null).getString("uri"));
                    String id = DocumentsContract.getDocumentId(target);
                    Uri parent = DocumentsContract.buildDocumentUriUsingTree(Uri.parse(root), id.substring(0, id.lastIndexOf('/')));
                    String token = UUID.randomUUID().toString();
                    String tempName = ".excalibur-" + token + ".tmp", backupName = ".excalibur-" + token + ".previous";
                    Uri temp = DocumentsContract.createDocument(resolver, parent, "application/octet-stream", tempName);
                    assertNotNull(temp);
                    try (OutputStream out = resolver.openOutputStream(temp, "wt")) {
                        assertNotNull(out);
                        out.write(newData.getBytes(StandardCharsets.UTF_8));
                    }
                    assertTrue(prefs.edit().putString("transaction:" + root, new JSObject()
                        .put("path", path).put("temp", tempName).put("backup", backupName).toString()).commit());
                    assertNotNull(DocumentsContract.renameDocument(resolver, target, backupName));
                    if (committed) assertNotNull(DocumentsContract.renameDocument(resolver, temp, path.substring(path.lastIndexOf('/') + 1)));
                    // This is a fresh helper, like process recreation: the journal is on disk.
                    WorkspaceFiles restarted = new WorkspaceFiles(context);
                    String actual = restarted.operation(root, "readFile", path, null, null, "utf8").getString("data");
                    assertEquals(committed ? newData : oldData, actual);
                    assertFalse(prefs.contains("transaction:" + root));
                }
            } finally {
                files.operation(root, "deleteFile", path, null, null, null);
            }
        }
    }

    @Test public void replacementNeverDeletesAConflictingFolder() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WorkspaceFiles files = new WorkspaceFiles(context);
        String root = files.selected();
        Assume.assumeNotNull(root);
        String folder = "Excalidraw/canvases/collision-test-" + UUID.randomUUID();
        String child = folder + "/preserved.json";
        synchronized (WorkspaceFiles.LOCK) {
            Uri directory = Uri.parse(files.operation(root, "mkdir", folder, null, null, null).getString("uri"));
            try {
                files.operation(root, "write", child, null, "e30=", null);
                try {
                    files.operation(root, "write", folder, null, "e30=", null);
                    fail("A directory must never be replaced by a file");
                } catch (java.io.IOException expected) { /* original folder must survive */ }
                assertEquals("directory", files.operation(root, "stat", folder, null, null, null).getString("type"));
                assertEquals("{}", files.operation(root, "readFile", child, null, null, "utf8").getString("data"));
            } finally {
                // Only this UUID-named test directory is removed.
                DocumentsContract.deleteDocument(context.getContentResolver(), directory);
            }
        }
    }

    @Test public void rejectsRemoteProvidersAndUnselectedTrees() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WorkspaceFiles files = new WorkspaceFiles(context);
        String localButNotGranted = DocumentsContract.buildTreeDocumentUri(WorkspaceFiles.LOCAL_AUTHORITY,
            "primary:Documents/unselected-" + UUID.randomUUID()).toString();
        for (String root : new String[] {"content://remote.provider/tree/id", localButNotGranted}) {
            try {
                files.operation(root, "readFile", "Excalidraw/canvases/test.excalidraw", null, null, null);
                fail("Provider/grant boundary must be enforced natively");
            } catch (java.io.IOException expected) { /* no provider read is allowed */ }
        }
    }
}
