# Proguard rules for Kharch Companion
-keepattributes *Annotation*
-keepclassmembers class * {
    @androidx.room.* <methods>;
}
