# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ---------------------------------------------------------------------------
# Clinic-Nurse kiosk: R8 optimize was rewriting Expo Modules Kotlin inline/reified
# DSL (KioskModule$definition$…$$inlined$Function*) so runtime hit
# Intrinsics.throwUndefinedForReified → ReactInstance never starts (blank UI).
# AGP 9 forbids proguard-android.txt; disable optimization here instead.
# ---------------------------------------------------------------------------
-dontoptimize

-keepattributes *Annotation*, InnerClasses, EnclosingMethod, Signature, Exception
-keep class kotlin.Metadata { *; }
-keep class kotlin.reflect.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

-keep class expo.modules.** { *; }
-keepclassmembers class expo.modules.** { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

-keep class online.era365.nurse.** { *; }
-keep class expo.modules.kiosk.** { *; }

# Synthetic classes produced by inlining Expo ModuleDefinition DSL
-keep class **$$inlined$** { *; }
-keepclassmembers class **$$inlined$** { *; }

# Expo Module subclasses must keep definition() body intact (override consumer allowoptimization)
-keep class * extends expo.modules.kotlin.modules.Module {
  <init>();
  *;
}
