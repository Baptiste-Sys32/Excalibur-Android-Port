package com.badeparday.excalidrawpersonal;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.WindowManager;
import android.view.MotionEvent;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private final WritingWakeState writingWake = new WritingWakeState();
    private final Handler wakeHandler = new Handler(Looper.getMainLooper());
    private boolean wakeScheduled;
    private boolean wakeActive;
    private final Runnable expireWake = () -> {
        wakeScheduled = false;
        updateWritingWake();
    };

    public void setWritingWakeEnabled(boolean enabled) {
        writingWake.enable(enabled);
        updateWritingWake();
    }

    private void updateWritingWake() {
        long remaining = writingWake.remaining(SystemClock.uptimeMillis());
        boolean active = remaining > 0;
        if (active != wakeActive) {
            wakeActive = active;
            if (active) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        if (active) {
            if (!wakeScheduled) {
                wakeScheduled = true;
                wakeHandler.postDelayed(expireWake, remaining);
            }
        } else {
            wakeHandler.removeCallbacks(expireWake);
            wakeScheduled = false;
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        writingWake.resume(true);
    }

    @Override
    public void onPause() {
        writingWake.resume(false);
        updateWritingWake();
        super.onPause();
    }

    @Override
    public void onDestroy() {
        writingWake.resume(false);
        updateWritingWake();
        super.onDestroy();
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DrawBridgePlugin.class);
        super.onCreate(savedInstanceState);
        DrawBridgePlugin.pushPendingOpen(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        DrawBridgePlugin.pushPendingOpen(this, intent);
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        int action = event.getActionMasked();
        if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN
            || action == MotionEvent.ACTION_MOVE) {
            for (int i = 0; i < event.getPointerCount(); i++) {
                int tool = event.getToolType(i);
                if ((tool == MotionEvent.TOOL_TYPE_STYLUS || tool == MotionEvent.TOOL_TYPE_ERASER)
                    && event.getPressure(i) > 0) {
                    writingWake.contact(SystemClock.uptimeMillis());
                    updateWritingWake();
                    break;
                }
            }
        }
        DrawBridgePlugin.pushStylusSnapshot(event);
        return super.dispatchTouchEvent(event);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent event) {
        DrawBridgePlugin.pushStylusSnapshot(event);
        return super.dispatchGenericMotionEvent(event);
    }
}
