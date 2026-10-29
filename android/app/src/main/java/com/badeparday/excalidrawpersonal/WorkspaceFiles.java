package com.badeparday.excalidrawpersonal;

import android.content.Context;
import android.content.ContentResolver;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.JSONObject;

/** Local SAF transport. Call under LOCK; no Activity or WebView references. */
final class WorkspaceFiles {
    static final Object LOCK = new Object();
    static final int MAX_BYTES = 64 * 1024 * 1024;
    static final String LOCAL_AUTHORITY = "com.android.externalstorage.documents";
    private final Context context;
    private final ContentResolver resolver;
    private final SharedPreferences prefs;

    WorkspaceFiles(Context context) {
        this.context = context.getApplicationContext();
        resolver = this.context.getContentResolver();
        prefs = this.context.getSharedPreferences("excalibur-workspace", Context.MODE_PRIVATE);
    }

    String selected() { return prefs.getString("selected", null); }
    void select(String root) throws IOException {
        if (!prefs.edit().putString("selected", root).commit()) throw new IOException("Could not save workspace");
    }
    void reset() throws IOException {
        if (!prefs.edit().remove("selected").commit()) throw new IOException("Could not reset workspace");
    }
    Uri root(String value) throws IOException {
        if (value == null) throw new IOException("No workspace selected");
        Uri tree = Uri.parse(value);
        if (!"content".equals(tree.getScheme()) || !LOCAL_AUTHORITY.equals(tree.getAuthority())
            || !DocumentsContract.isTreeUri(tree)) throw new IOException("Choose a local device or SD card folder");
        boolean granted = false;
        for (UriPermission permission : resolver.getPersistedUriPermissions()) {
            if (permission.getUri().equals(tree) && permission.isReadPermission() && permission.isWritePermission()) granted = true;
        }
        if (!granted) throw new IOException("Workspace access expired. Select the folder again");
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }
    JSObject status() {
        JSObject result = new JSObject();
        String selected = selected();
        result.put("name", "Documents/Excalidraw").put("available", true);
        if (selected != null) {
            result.put("treeUri", selected).put("name", "Selected local folder");
            try { result.put("name", info(root(selected)).optString("name")); }
            catch (Exception ex) { result.put("available", false); }
        }
        return result;
    }
    private JSObject info(Uri uri) throws IOException {
        try (Cursor cursor = resolver.query(uri, new String[] {
            DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED
        }, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) throw new IOException("File is unavailable");
            return new JSObject().put("name", cursor.getString(0)).put("type",
                DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(1)) ? "directory" : "file")
                .put("size", cursor.getLong(2)).put("mtime", cursor.getLong(3)).put("ctime", cursor.getLong(3))
                .put("uri", uri.toString());
        }
    }
    static String[] parts(String path) throws IOException {
        if (path == null) throw new IOException("Missing workspace path");
        String[] parts = path.split("/", -1);
        if (parts.length == 0 || !"Excalidraw".equals(parts[0])) throw new IOException("Path outside workspace");
        for (String part : parts) {
            if (part.isEmpty() || part.equals(".") || part.equals("..") || part.contains("\\")
                || part.startsWith(".excalibur-") || part.chars().anyMatch(Character::isISOControl) || part.length() > 200)
                throw new IOException("Invalid workspace filename (maximum 200 characters)");
        }
        return parts;
    }
    private Uri child(Uri parent, String name) throws IOException {
        Uri listing = DocumentsContract.buildChildDocumentsUriUsingTree(parent, DocumentsContract.getDocumentId(parent));
        try (Cursor cursor = resolver.query(listing, new String[] {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME
        }, null, null, null)) {
            if (cursor == null) throw new IOException("Folder is unavailable");
            while (cursor.moveToNext()) {
                if (name.equals(cursor.getString(1))) return DocumentsContract.buildDocumentUriUsingTree(parent, cursor.getString(0));
            }
        }
        return null;
    }
    private Uri resolve(String root, String path, boolean createDirectories) throws IOException {
        Uri current = root(root);
        for (String part : parts(path)) {
            Uri next = child(current, part);
            if (next == null && createDirectories) next = DocumentsContract.createDocument(resolver, current,
                DocumentsContract.Document.MIME_TYPE_DIR, part);
            if (next == null) throw new FileNotFoundException("Workspace file is unavailable");
            if (createDirectories && !"directory".equals(info(next).optString("type"))) throw new IOException("Folder path is a file");
            current = next;
        }
        return current;
    }
    private Uri parent(String root, String path, boolean create) throws IOException {
        parts(path);
        int slash = path.lastIndexOf('/');
        if (slash < 0) throw new IOException("Cannot modify workspace root");
        return resolve(root, path.substring(0, slash), create);
    }
    private String name(String path) { return path.substring(path.lastIndexOf('/') + 1); }
    private byte[] read(Uri uri) throws IOException {
        if (info(uri).optLong("size") > MAX_BYTES) throw new IOException("Workspace file exceeds 64 MiB");
        try (InputStream in = resolver.openInputStream(uri); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw new IOException("Cannot read workspace file");
            byte[] buffer = new byte[8192];
            int size;
            while ((size = in.read(buffer)) != -1) {
                if (out.size() > MAX_BYTES - size) throw new IOException("Workspace file exceeds 64 MiB");
                out.write(buffer, 0, size);
            }
            return out.toByteArray();
        }
    }
    private void deleteIfPresent(Uri parent, String name) throws IOException {
        Uri file = child(parent, name);
        if (file != null) {
            if (!"file".equals(info(file).optString("type"))) throw new IOException("Transaction path is a folder; previous data preserved");
            if (!DocumentsContract.deleteDocument(resolver, file)) throw new IOException("Cannot clean workspace transaction");
        }
    }
    private Uri rename(Uri uri, String name) throws IOException {
        Uri result = DocumentsContract.renameDocument(resolver, uri, name);
        if (result == null) throw new IOException("Provider cannot safely rename files");
        return result;
    }
    // A per-root, synchronously committed journal precedes any existing-file rename.
    // If killed in the rename gap, the next operation on this root restores the old file.
    private void recover(String root) throws Exception {
        String key = "transaction:" + root;
        String json = prefs.getString(key, null);
        if (json == null) return;
        JSONObject tx = new JSONObject(json);
        Uri parent = parent(root, tx.getString("path"), false);
        String target = name(tx.getString("path"));
        String backup = tx.getString("backup"), temp = tx.getString("temp");
        if (!backup.startsWith(".excalibur-") || !temp.startsWith(".excalibur-")) throw new IOException("Invalid transaction journal");
        Uri current = child(parent, target);
        if (current != null && !"file".equals(info(current).optString("type"))) throw new IOException("Transaction target is a folder; previous data preserved");
        if (current == null) {
            Uri old = child(parent, backup);
            if (old != null) rename(old, target);
        }
        deleteIfPresent(parent, temp);
        deleteIfPresent(parent, backup);
        if (!prefs.edit().remove(key).commit()) throw new IOException("Could not finish workspace recovery");
    }
    private void write(String root, String path, byte[] bytes) throws Exception {
        if (bytes.length > MAX_BYTES) throw new IOException("Workspace file exceeds 64 MiB");
        Uri parent = parent(root, path, true);
        Uri existing = child(parent, name(path));
        if (existing != null && !"file".equals(info(existing).optString("type"))) throw new IOException("A folder already has this filename");
        String token = UUID.randomUUID().toString();
        String tempName = ".excalibur-" + token + ".tmp";
        String backupName = ".excalibur-" + token + ".previous";
        Uri temp = DocumentsContract.createDocument(resolver, parent, "application/octet-stream", tempName);
        if (temp == null) throw new IOException("Cannot stage workspace file");
        boolean journaled = false;
        try {
            try (OutputStream out = resolver.openOutputStream(temp, "wt")) {
                if (out == null) throw new IOException("Cannot write workspace file");
                out.write(bytes);
            }
            if (info(temp).optLong("size", -1) != bytes.length) throw new IOException("Staged file size mismatch");
            JSObject tx = new JSObject().put("path", path).put("temp", tempName).put("backup", backupName);
            if (!prefs.edit().putString("transaction:" + root, tx.toString()).commit()) throw new IOException("Cannot journal workspace write");
            journaled = true;
            Uri old = child(parent, name(path));
            if (old != null) {
                if (!"file".equals(info(old).optString("type"))) throw new IOException("A folder already has this filename");
                rename(old, backupName);
            }
            rename(temp, name(path));
            recover(root);
        } catch (Exception ex) {
            if (journaled) {
                try { recover(root); } catch (Exception recovery) { ex.addSuppressed(recovery); }
            } else {
                try { DocumentsContract.deleteDocument(resolver, temp); } catch (Exception ignored) { /* staged copy only */ }
            }
            throw ex;
        }
    }
    JSObject operation(String root, String op, String path, String destination, String data, String encoding) throws Exception {
        root(root);
        parts(path);
        recover(root);
        switch (op) {
            case "mkdir": return new JSObject().put("uri", resolve(root, path, true).toString());
            case "write":
                if (data == null || data.length() > (MAX_BYTES / 3L + 1) * 4) throw new IOException("Workspace file exceeds 64 MiB");
                write(root, path, Base64.decode(data, Base64.DEFAULT));
                return new JSObject();
            case "readFile": {
                byte[] bytes = read(resolve(root, path, false));
                return new JSObject().put("data", "utf8".equals(encoding)
                    ? new String(bytes, StandardCharsets.UTF_8) : Base64.encodeToString(bytes, Base64.NO_WRAP));
            }
            case "stat": return info(resolve(root, path, false));
            case "getUri": return new JSObject().put("uri", resolve(root, path, false).toString());
            case "deleteFile": {
                Uri uri = resolve(root, path, false);
                if (!"file".equals(info(uri).optString("type"))) throw new IOException("Only individual files can be deleted");
                if (!DocumentsContract.deleteDocument(resolver, uri)) throw new IOException("Cannot delete workspace file");
                return new JSObject();
            }
            case "rename": {
                parts(destination);
                if (!path.substring(0, path.lastIndexOf('/')).equals(destination.substring(0, destination.lastIndexOf('/'))))
                    throw new IOException("Cross-folder rename is unsupported");
                if (child(parent(root, destination, false), name(destination)) != null) throw new IOException("File already exists");
                Uri source = resolve(root, path, false);
                if (!"file".equals(info(source).optString("type"))) throw new IOException("Only individual files can be renamed");
                rename(source, name(destination));
                return new JSObject();
            }
            case "copy": write(root, destination, read(resolve(root, path, false))); return new JSObject();
            case "readdir": {
                Uri dir = resolve(root, path, false);
                Uri listing = DocumentsContract.buildChildDocumentsUriUsingTree(dir, DocumentsContract.getDocumentId(dir));
                JSArray files = new JSArray();
                try (Cursor cursor = resolver.query(listing, new String[] {DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
                    if (cursor == null) throw new IOException("Folder is unavailable");
                    while (cursor.moveToNext()) {
                        if (!cursor.getString(1).startsWith(".excalibur-")) files.put(info(
                            DocumentsContract.buildDocumentUriUsingTree(dir, cursor.getString(0))));
                    }
                }
                return new JSObject().put("files", files);
            }
            case "prepareShare": {
                byte[] bytes = read(resolve(root, path, false));
                File dir = new File(context.getCacheDir(), "workspace-shares");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Cannot prepare share cache");
                File[] entries = dir.listFiles();
                if (entries != null) {
                    Arrays.sort(entries, Comparator.comparingLong(File::lastModified));
                    long total = 0; for (File f : entries) total += f.length();
                    int count = entries.length;
                    for (File f : entries) if (count >= 5 || total + bytes.length > MAX_BYTES) {
                        long size = f.length();
                        if (!f.delete()) throw new IOException("Cannot clear share cache");
                        total -= size; count--;
                    }
                }
                File file = new File(dir, UUID.randomUUID() + "-" + name(path));
                try (FileOutputStream out = new FileOutputStream(file)) { out.write(bytes); }
                return new JSObject().put("uri", Uri.fromFile(file).toString());
            }
            default: throw new IOException("Unsupported workspace operation");
        }
    }
}
