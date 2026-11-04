plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.kapt")
}

android {
    namespace = "com.kharch.companion"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.kharch.companion"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            // Signing credentials can be provided via Gradle properties, environment variables,
            // or default to local kharch-release.jks if present.
            val propPath = project.findProperty("KHARCH_KEYSTORE_PATH") as? String
            val envPath = System.getenv("KHARCH_KEYSTORE_PATH")
            val defaultJks = rootProject.file("kharch-release.jks")

            val keystoreFile = when {
                !propPath.isNullOrEmpty() -> file(propPath)
                !envPath.isNullOrEmpty() -> file(envPath)
                defaultJks.exists() -> defaultJks
                else -> null
            }

            val keystorePass = (project.findProperty("KHARCH_KEYSTORE_PASS") as? String)
                ?: System.getenv("KHARCH_KEYSTORE_PASS")
                ?: "kharch_store_pass"

            val keyAlias = (project.findProperty("KHARCH_KEY_ALIAS") as? String)
                ?: System.getenv("KHARCH_KEY_ALIAS")
                ?: "kharch"

            val keyPass = (project.findProperty("KHARCH_KEY_PASS") as? String)
                ?: System.getenv("KHARCH_KEY_PASS")
                ?: "kharch_store_pass"

            if (keystoreFile != null && keystoreFile.exists()) {
                storeFile = keystoreFile
                storePassword = keystorePass
                this.keyAlias = keyAlias
                keyPassword = keyPass
            }

            // Enable all signing schemes so Play Protect v3/v4 device signature checks pass.
            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = true
        }
    }

    buildTypes {
        release {
            // Keep code un-obfuscated — Play Protect heuristics flag heavily
            // shrunk/obfuscated sideloaded APKs as suspected trojans.
            isMinifyEnabled = false
            isShrinkResources = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Room Database
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")

    // WorkManager for background sync
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    // QR Code scanner for pairing with PWA
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")

    // Minimal HTTP client for backend sync
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
