package com.badeparday.excalidrawpersonal;

/** Transport limits, independent of Android APIs so boundary cases run on the JVM. */
final class ImportPolicy {
    static final int MAX_FILES = 32;
    static final long MAX_TOTAL_BYTES = 64L * 1024 * 1024;

    static boolean fits(int count, long total, long next) {
        return count < MAX_FILES && total >= 0 && next >= 0
            && next <= MAX_TOTAL_BYTES && total <= MAX_TOTAL_BYTES - next;
    }

    static String displayName(String name) {
        if (name == null) return null;
        String cleaned = name.replace('\\', '/');
        cleaned = cleaned.substring(cleaned.lastIndexOf('/') + 1)
            .replaceAll("[\\p{Cntrl}]", "").trim();
        if (cleaned.isEmpty() || cleaned.equals(".") || cleaned.equals("..")) return null;
        return cleaned.length() <= 255 ? cleaned : cleaned.substring(cleaned.length() - 255);
    }
}
