# Targeted ProGuard / R8 rules for КешбекРадар (Capacitor 7 + R8 Full Mode)
# Consumer keep rules from :capacitor-android already preserve @CapacitorPlugin and Plugin subclasses.

# Preserve @JavascriptInterface methods exposed to the Capacitor WebView bridge
-keepclassmembers class com.getcapacitor.MessageHandler {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.getcapacitor.plugin.CapacitorCookies {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.getcapacitor.plugin.CapacitorHttp {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve MainActivity entry point
-keep public class ua.cashbackradar.app.MainActivity {
    public <init>();
}

# Optional Capacitor SSL pinning class checked via Class.forName when plugin is absent
-dontwarn io.ionic.sslpinning.SSLPinning

# Preserve line numbers and obfuscate source filename for Play Console crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
