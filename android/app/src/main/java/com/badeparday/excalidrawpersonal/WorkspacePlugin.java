package com.badeparday.excalidrawpersonal;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "Workspace")
public class WorkspacePlugin extends Plugin {
    private WorkspaceFiles files;
    private final AtomicBoolean selecting = new AtomicBoolean();
    @Override public void load() { files = new WorkspaceFiles(getContext()); }

    @PluginMethod public void getWorkspace(PluginCall call) {
        synchronized (WorkspaceFiles.LOCK) { call.resolve(files.status()); }
    }
    @PluginMethod public void resetWorkspace(PluginCall call) {
        synchronized (WorkspaceFiles.LOCK) {
            try { files.reset(); call.resolve(files.status()); }
            catch (Exception ex) { call.reject("Could not reset workspace", ex); }
        }
    }
    @PluginMethod public void selectWorkspace(PluginCall call) {
        if (!selecting.compareAndSet(false, true)) { call.reject("Folder picker is already open"); return; }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Uri initial = DocumentsContract.buildDocumentUri(WorkspaceFiles.LOCAL_AUTHORITY, "primary:Documents");
            try {
                String selected = files.selected();
                if (selected != null && WorkspaceFiles.LOCAL_AUTHORITY.equals(Uri.parse(selected).getAuthority())
                    && DocumentsContract.isTreeUri(Uri.parse(selected))) {
                    initial = DocumentsContract.buildDocumentUriUsingTree(Uri.parse(selected), DocumentsContract.getTreeDocumentId(Uri.parse(selected)));
                }
            } catch (IllegalArgumentException ignored) { /* An invalid hint must not prevent re-selection. */ }
            intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, initial);
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        try { startActivityForResult(call, intent, "workspaceSelected"); }
        catch (Exception ex) { selecting.set(false); call.reject("Local folder picker is unavailable", ex); }
    }
    @ActivityCallback private void workspaceSelected(PluginCall call, ActivityResult result) {
        selecting.set(false);
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            bridge.execute(() -> {
                synchronized (WorkspaceFiles.LOCK) { call.resolve(files.status().put("cancelled", true)); }
            });
            return;
        }
        Uri uri = data.getData();
        // EXTRA_LOCAL_ONLY is advisory. Enforce the local provider at the boundary.
        if (!WorkspaceFiles.LOCAL_AUTHORITY.equals(uri.getAuthority()) || !DocumentsContract.isTreeUri(uri)) {
            call.reject("Choose a folder on this device or an SD card"); return;
        }
        int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        if (flags != (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION)) {
            call.reject("Workspace needs persistent read and write access"); return;
        }
        bridge.execute(() -> {
            synchronized (WorkspaceFiles.LOCK) {
                try {
                    getContext().getContentResolver().takePersistableUriPermission(uri, flags);
                    for (String folder : new String[] {"canvases", "libraries", "exports", "backups"}) {
                        files.operation(uri.toString(), "mkdir", "Excalidraw/" + folder, null, null, null);
                    }
                    files.select(uri.toString());
                    call.resolve(files.status());
                } catch (Exception ex) { call.reject("Cannot use this local folder. Check access and free space", ex); }
            }
        });
    }
    @PluginMethod public void filesystem(PluginCall call) {
        synchronized (WorkspaceFiles.LOCK) {
            try {
                call.resolve(files.operation(call.getString("treeUri"), call.getString("operation", ""),
                    call.getString("path"), call.getString("destination"), call.getString("data"), call.getString("encoding")));
            } catch (Exception ex) { call.reject("Workspace operation failed. Check folder access, filename and free space", ex); }
        }
    }
    @PluginMethod public void openDirectory(PluginCall call) {
        try {
            Uri uri;
            synchronized (WorkspaceFiles.LOCK) { uri = files.root(files.selected()); }
            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, DocumentsContract.Document.MIME_TYPE_DIR);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getActivity().runOnUiThread(() -> {
                try { getActivity().startActivity(intent); call.resolve(new JSObject().put("opened", true)); }
                catch (Exception ex) { call.reject("Cannot open the selected folder", ex); }
            });
        } catch (Exception ex) { call.reject("Workspace access expired. Select the folder again", ex); }
    }
}
