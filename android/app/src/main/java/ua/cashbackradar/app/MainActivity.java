package ua.cashbackradar.app;

import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int FORBIDDEN_URI_GRANT_FLAGS =
        Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION;

    private static final int DARK_SURFACE_COLOR = Color.parseColor("#09090B");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        sanitizeIncomingIntent(getIntent());

        SystemBarStyle darkBarStyle = SystemBarStyle.dark(DARK_SURFACE_COLOR);
        EdgeToEdge.enable(this, darkBarStyle, darkBarStyle);

        super.onCreate(savedInstanceState);

        configureEdgeToEdgeSystemBars();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        sanitizeIncomingIntent(intent);
        if (intent != null) {
            setIntent(intent);
        }
        super.onNewIntent(intent);
    }

    private void configureEdgeToEdgeSystemBars() {
        Window window = getWindow();
        if (window == null) {
            return;
        }

        WindowCompat.setDecorFitsSystemWindows(window, false);
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }
    }

    private void sanitizeIncomingIntent(Intent incomingIntent) {
        if (incomingIntent == null) {
            return;
        }

        // Strip URI grant flags and nested selector intents from external callers
        incomingIntent.setFlags(incomingIntent.getFlags() & ~FORBIDDEN_URI_GRANT_FLAGS);
        incomingIntent.setSelector(null);
        incomingIntent.removeExtra(Intent.EXTRA_INTENT);
    }
}
